import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { addDays, localYmd } from "@/lib/date";
import { ob, type ObAgentSummary, type ObBooking, type ObRoute, type ObSeatLock } from "@/lib/ob";
import {
  DEFAULT_FILTERS, filterLocks, groupLocks, holderOptions, lockKpis, locksOn, lookupOf, releasePlan, type LockFilters,
} from "@/features/seat-locks/model";

type Status = "idle" | "loading" | "ready" | "error";
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * The Seat Locks tab (legacy bkV2RenderLocks). Filters and the day being looked at live here so they
 * survive leaving the page; open rows and dialogs stay in the components.
 */
export const useSeatLocksStore = defineStore("seatLocks", () => {
  const locks = ref<ObSeatLock[]>([]);
  const routes = ref<ObRoute[]>([]);
  const agents = ref<ObAgentSummary[]>([]);
  const status = ref<Status>("idle");
  const error = ref("");
  const today = ref(localYmd());
  const filters = ref<LockFilters>({ ...DEFAULT_FILTERS });
  /** The day table's date as an offset from today; legacy opens on tomorrow. */
  const dayOffset = ref(1);
  /** One day's bookings, for a lock's claims and coverage. Loaded when a lock's detail opens. */
  const dayBookings = ref(new Map<string, { status: "loading" | "ready" | "error"; rows: ObBooking[]; error?: string }>());

  const lookup = computed(() => lookupOf(routes.value, agents.value));
  const day = computed(() => addDays(today.value, dayOffset.value));
  const filtered = computed(() => filterLocks(locks.value, filters.value, lookup.value));
  const groups = computed(() => groupLocks(filtered.value, filters.value.groupBy, lookup.value));
  const dayLocks = computed(() => locksOn(locks.value, day.value, lookup.value));
  const kpis = computed(() => lockKpis(locks.value, today.value, lookup.value));
  const holders = computed(() => holderOptions(locks.value, lookup.value));
  const byId = (id: string) => locks.value.find((l) => l.id === id);

  async function load(force = false): Promise<void> {
    if (status.value === "loading" || (status.value === "ready" && !force)) return;
    status.value = "loading";
    error.value = "";
    try {
      // Inactive agents too: an old lock can still name one.
      const [ls, rs, as] = await Promise.all([ob.seatLocks(), ob.routes(), ob.agents("all")]);
      locks.value = ls;
      routes.value = rs;
      agents.value = as;
      today.value = localYmd();
      status.value = "ready";
    } catch (e) {
      error.value = errText(e);
      status.value = "error";
    }
  }

  function put(l: ObSeatLock) {
    const i = locks.value.findIndex((x) => x.id === l.id);
    if (i < 0) locks.value = [...locks.value, l];
    else locks.value = locks.value.map((x, k) => (k === i ? l : x));
  }

  // Writes throw ApiError with the backend's message (e.g. "Insufficient available seats"); the dialog shows it.
  async function create(input: { route_id: string; service_date: string; pax: number; agent_id?: string }): Promise<ObSeatLock> {
    const l = await ob.createSeatLock(input);
    put(l);
    return l;
  }
  /** bkV2LockAddSeats. Only offered on active locks: the backend doesn't reactivate a released one. */
  async function addSeats(id: string, n: number): Promise<void> {
    const l = byId(id);
    if (!l || n <= 0) return;
    put(await ob.amendSeatLock(id, { pax: l.pax + n }));
  }
  /** bkV2ReleaseLock: give back `n` of the held seats (see releasePlan). */
  async function giveBack(id: string, n: number): Promise<void> {
    const l = byId(id);
    const plan = l && releasePlan(l, n);
    if (!plan) return;
    put(plan.kind === "release" ? await ob.releaseSeatLock(id) : await ob.amendSeatLock(id, { pax: plan.pax }));
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
    locks, routes, agents, status, error, today, filters, dayOffset, dayBookings,
    lookup, day, filtered, groups, dayLocks, kpis, holders, byId,
    load, create, addSeats, giveBack, loadDay, resetFilters,
  };
});
