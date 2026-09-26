import { defineStore } from "pinia";
import { ref } from "vue";

import { ApiError } from "@/lib/api";
import {
  ob, type ObAgent, type ObAgentActivity, type ObAgentSummary, type ObBooking, type ObMarket, type ObRateTypeSummary,
  type ObRoute, type ObSalesPerson,
} from "@/lib/ob";

/** `missing` = operation-backend does not serve /v1/agents yet (404). */
type Status = "idle" | "loading" | "ready" | "missing" | "error";
/** Per-agent load state; `forbidden` = outside the caller's sales scope (403). */
type Detail = { status: "loading" | "ready" | "missing" | "forbidden" | "error"; agent?: ObAgent; error?: string };

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * The Agent List (phase 1 of apps/web/docs/porting/agents.md: read-only). Filters, the selected agent
 * and the tab live in the URL, not here.
 */
export const useAgentsStore = defineStore("agents", () => {
  const summaries = ref<ObAgentSummary[]>([]);
  const markets = ref<ObMarket[]>([]);
  const salesPeople = ref<ObSalesPerson[]>([]);
  const rateTypes = ref<ObRateTypeSummary[]>([]);
  const routes = ref<ObRoute[]>([]);
  const status = ref<Status>("idle");
  const error = ref("");
  const details = ref(new Map<string, Detail>());
  const bookings = ref(new Map<string, { rows: ObBooking[]; cursor?: string; status: "loading" | "ready" | "error" }>());
  const activity = ref(new Map<string, { rows: ObAgentActivity[]; status: "loading" | "ready" | "error" }>());

  /** The list and its reference data, in parallel. Loads once unless `force`. */
  async function load(force = false): Promise<void> {
    if (!force && (status.value === "ready" || status.value === "loading")) return;
    status.value = "loading";
    error.value = "";
    try {
      const [a, m, s, rt, r] = await Promise.all([ob.agents(), ob.markets(), ob.salesPeople(), ob.rateTypes(), ob.routes()]);
      summaries.value = a; markets.value = m; salesPeople.value = s; rateTypes.value = rt; routes.value = r;
      status.value = "ready";
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) status.value = "missing";
      else { status.value = "error"; error.value = errText(e); }
    }
  }

  async function loadAgent(id: string, force = false): Promise<void> {
    const cur = details.value.get(id);
    if (!force && cur && (cur.status === "ready" || cur.status === "loading")) return;
    details.value.set(id, { status: "loading" });
    try {
      details.value.set(id, { status: "ready", agent: await ob.agent(id) });
    } catch (e) {
      const st = e instanceof ApiError ? e.status : 0;
      details.value.set(id, st === 404 ? { status: "missing" } : st === 403 ? { status: "forbidden" } : { status: "error", error: errText(e) });
    }
  }

  /** First page, or the next one after the cursor already loaded. */
  async function loadBookings(id: string, more = false): Promise<void> {
    const cur = bookings.value.get(id);
    if (!more && cur && cur.status !== "error") return;
    const rows = more && cur ? cur.rows : [];
    bookings.value.set(id, { rows, cursor: cur?.cursor, status: "loading" });
    try {
      const page = await ob.agentBookings(id, more ? cur?.cursor : undefined);
      bookings.value.set(id, { rows: [...rows, ...page.bookings], cursor: page.next_cursor, status: "ready" });
    } catch {
      bookings.value.set(id, { rows, cursor: cur?.cursor, status: "error" });
    }
  }

  async function loadActivity(id: string): Promise<void> {
    if (activity.value.get(id)?.status === "ready") return;
    activity.value.set(id, { rows: [], status: "loading" });
    try {
      activity.value.set(id, { rows: await ob.agentActivity(id), status: "ready" });
    } catch {
      activity.value.set(id, { rows: [], status: "error" });
    }
  }

  const marketOf = (id: string | null | undefined) => (id ? markets.value.find((m) => m.id === id) : undefined);
  const salesOf = (id: string | null | undefined) => (id ? salesPeople.value.find((s) => s.id === id) : undefined);
  const rateTypeOf = (id: string | null | undefined) => (id ? rateTypes.value.find((r) => r.id === id) : undefined);
  const routeName = (id: string) => routes.value.find((r) => r.id === id)?.name || id;

  return {
    summaries, markets, salesPeople, rateTypes, routes, status, error, details, bookings, activity,
    load, loadAgent, loadBookings, loadActivity, marketOf, salesOf, rateTypeOf, routeName,
  };
});
