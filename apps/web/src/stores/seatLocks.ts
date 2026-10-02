import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { ApiError } from "@/lib/api";
import { addDays, localYmd } from "@/lib/date";
import {
  ob, type ObAgentSummary, type ObBooking, type ObLockGroupResult, type ObReleaseRule, type ObRoute, type ObSeatLock, type ObSeatLockGroup,
  type ObSkippedDay,
} from "@/lib/ob";
import {
  buildRows, childrenIndex, DEFAULT_FILTERS, filterRows, groupRows, holderOptions, lockKpis, locksOn, lookupOf, releasePlan, type LockFilters,
} from "@/features/seat-locks/model";

type Status = "idle" | "loading" | "ready" | "error";
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** What the last group write did, shown above the table until dismissed. */
export interface LockNotice { text: string; skipped: ObSkippedDay[] }

/**
 * The Seat Locks tab (legacy bkV2RenderLocks). Filters and the day being looked at live here so they
 * survive leaving the page; open rows and dialogs stay in the components.
 */
export const useSeatLocksStore = defineStore("seatLocks", () => {
  const locks = ref<ObSeatLock[]>([]);
  const groups = ref<ObSeatLockGroup[]>([]);
  /** false until operation-backend serves /v1/seat-lock-groups: bulk locks and sub-groups stay off. */
  const bulkReady = ref(false);
  const routes = ref<ObRoute[]>([]);
  const agents = ref<ObAgentSummary[]>([]);
  const status = ref<Status>("idle");
  const error = ref("");
  const today = ref(localYmd());
  const now = ref(Date.now());
  const filters = ref<LockFilters>({ ...DEFAULT_FILTERS });
  /** The day table's date as an offset from today; legacy opens on tomorrow. */
  const dayOffset = ref(1);
  const notice = ref<LockNotice | null>(null);
  /** One day's bookings, for a lock's claims and coverage. Loaded when a lock's detail opens. */
  const dayBookings = ref(new Map<string, { status: "loading" | "ready" | "error"; rows: ObBooking[]; error?: string }>());

  const lookup = computed(() => lookupOf(routes.value, agents.value));
  const kids = computed(() => childrenIndex(locks.value));
  const rows = computed(() => buildRows(locks.value, groups.value));
  const day = computed(() => addDays(today.value, dayOffset.value));
  const filtered = computed(() => filterRows(rows.value, filters.value, lookup.value));
  const grouped = computed(() => groupRows(filtered.value, filters.value.groupBy, lookup.value));
  const dayLocks = computed(() => locksOn(locks.value, day.value, lookup.value));
  const kpis = computed(() => lockKpis(rows.value, locks.value, today.value, now.value, lookup.value));
  const holders = computed(() => holderOptions(rows.value, lookup.value));
  const byId = (id: string) => locks.value.find((l) => l.id === id);
  const groupById = (id: string) => groups.value.find((g) => g.id === id);
  const kidsOf = (id: string) => kids.value.get(id) ?? [];

  async function load(force = false): Promise<void> {
    if (status.value === "loading" || (status.value === "ready" && !force)) return;
    status.value = "loading";
    error.value = "";
    try {
      // Inactive agents too: an old lock can still name one. A backend without bulk locks answers 404.
      const [ls, gs, rs, as] = await Promise.all([
        ob.seatLocks(),
        ob.seatLockGroups().catch((e) => { if (e instanceof ApiError && e.status === 404) return null; throw e; }),
        ob.routes(),
        ob.agents("all"),
      ]);
      locks.value = ls;
      groups.value = gs ?? [];
      bulkReady.value = gs !== null;
      routes.value = rs;
      agents.value = as;
      today.value = localYmd();
      now.value = Date.now();
      status.value = "ready";
    } catch (e) {
      error.value = errText(e);
      status.value = "error";
    }
  }

  function put(...ls: ObSeatLock[]) {
    const next = new Map(locks.value.map((l) => [l.id, l]));
    for (const l of ls) next.set(l.id, l);
    locks.value = [...next.values()];
  }
  function putGroup(g: ObSeatLockGroup) {
    groups.value = groupById(g.id) ? groups.value.map((x) => (x.id === g.id ? g : x)) : [...groups.value, g];
  }
  /** Re-reads one day's locks: a write on a lock with sub-groups changes them too. */
  async function refreshDay(routeId: string, date: string) {
    const fresh = await ob.seatLocks({ route_id: routeId, service_date: date });
    const ids = new Set(fresh.map((l) => l.id));
    locks.value = locks.value.filter((l) => !(l.route_id === routeId && l.service_date === date && !ids.has(l.id)));
    put(...fresh);
  }
  function report(text: string, r: ObLockGroupResult) {
    notice.value = { text, skipped: r.skipped };
  }

  // Writes throw ApiError with the backend's message (e.g. "Insufficient available seats"); the dialog shows it.
  async function create(input: ObReleaseRule & { route_id: string; service_date: string; pax: number; agent_id?: string }): Promise<ObSeatLock> {
    const l = await ob.createSeatLock(input);
    put(l);
    return l;
  }
  /** A bulk lock. Days it skipped are reported in `notice`. */
  async function createGroup(input: Parameters<typeof ob.createSeatLockGroup>[0]): Promise<void> {
    const r = await ob.createSeatLockGroup(input);
    putGroup(r.group);
    put(...r.seat_locks);
    report(`สร้าง Bulk ${r.seat_locks.length} รอบ`, r);
  }
  /** bkV2LockAddSeats. Only offered on active locks: the backend doesn't reactivate a released one. */
  async function addSeats(id: string, n: number): Promise<void> {
    const l = byId(id);
    if (!l || n <= 0) return;
    put(await ob.amendSeatLock(id, { pax: l.pax + n }));
  }
  /** bkV2ReleaseLock: give back `n` seats (see releasePlan). Releasing a parent releases its sub-groups. */
  async function giveBack(id: string, n: number): Promise<void> {
    const l = byId(id);
    const plan = l && releasePlan(l, n, kidsOf(id));
    if (!l || !plan) return;
    put(plan.kind === "release" ? await ob.releaseSeatLock(id) : await ob.amendSeatLock(id, { pax: plan.pax }));
    if (plan.kind === "release" && kidsOf(id).length) await refreshDay(l.route_id, l.service_date);
  }
  async function createSubGroup(lockId: string, input: { sub_name: string; pax: number }): Promise<void> {
    put(await ob.createSubGroup(lockId, input));
  }
  /** "+ ที่นั่ง" on a bulk lock: every active departure gets `n` more. */
  async function addGroupSeats(id: string, n: number): Promise<void> {
    const g = groupById(id);
    if (!g || n <= 0) return;
    const r = await ob.amendSeatLockGroup(id, g.pax + n);
    putGroup(r.group);
    put(...r.seat_locks);
    report(`เพิ่มเป็น ${r.group.pax} ที่ต่อรอบ · ${r.seat_locks.length} รอบ`, r);
  }
  /** "คืน" on a bulk lock: fewer seats per departure, or all of them released. */
  async function giveBackGroup(id: string, n: number): Promise<void> {
    const g = groupById(id);
    if (!g || n <= 0 || n > g.pax) return;
    if (n === g.pax) {
      const r = await ob.releaseSeatLockGroup(id);
      const { seat_locks, ...group } = r;
      putGroup(group);
      put(...seat_locks);
      notice.value = { text: "ปล่อย Bulk ทั้งหมดแล้ว", skipped: [] };
      return;
    }
    const r = await ob.amendSeatLockGroup(id, g.pax - n);
    putGroup(r.group);
    put(...r.seat_locks);
    report(`ลดเป็น ${r.group.pax} ที่ต่อรอบ · ${r.seat_locks.length} รอบ`, r);
  }
  async function createGroupSubGroups(id: string, input: { sub_name: string; pax: number }): Promise<void> {
    const r = await ob.createGroupSubGroups(id, input);
    put(...r.seat_locks);
    report(`สร้างกรุ๊ปย่อย ${input.sub_name} ${r.seat_locks.length} รอบ`, r);
  }

  async function loadDay(date: string, force = false): Promise<void> {
    const cur = dayBookings.value.get(date);
    if (cur && !force && cur.status !== "error") return;
    dayBookings.value.set(date, { status: "loading", rows: [] });
    try {
      dayBookings.value.set(date, { status: "ready", rows: await ob.bookingsBetween(date, date) });
    } catch (e) {
      dayBookings.value.set(date, { status: "error", rows: [], error: errText(e) });
    }
  }

  function resetFilters() {
    filters.value = { ...DEFAULT_FILTERS };
  }

  return {
    locks, groups, bulkReady, routes, agents, status, error, today, now, filters, dayOffset, notice, dayBookings,
    lookup, rows, day, filtered, grouped, dayLocks, kpis, holders, byId, groupById, kidsOf,
    load, create, createGroup, addSeats, giveBack, createSubGroup, addGroupSeats, giveBackGroup, createGroupSubGroups, loadDay, resetFilters,
  };
});
