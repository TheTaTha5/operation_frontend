import { defineStore } from "pinia";
import { ref } from "vue";

import { ApiError } from "@/lib/api";
import { ob, type ObVanBoard, type ObVanTrip } from "@/lib/ob";

/** `missing` = operation-backend does not serve /operations/van-board yet (404). */
type Status = "idle" | "loading" | "ready" | "missing" | "error";

/**
 * The day's van board for the By-trip tab's Van mode (read-only, phase 1 of
 * apps/web/docs/porting/van-mode.md). Kept in a store so switching modes or tabs does not refetch.
 */
export const useVanBoardStore = defineStore("vanBoard", () => {
  const board = ref<ObVanBoard | null>(null);
  const date = ref("");
  const status = ref<Status>("idle");
  const error = ref("");
  let seq = 0;

  /** Loads `d`, unless it is already loaded (pass `force` to refetch). Stale answers are dropped. */
  async function load(d: string, force = false): Promise<void> {
    if (!force && date.value === d && (status.value === "ready" || status.value === "loading")) return;
    const my = ++seq;
    date.value = d;
    status.value = "loading";
    error.value = "";
    board.value = null;
    try {
      const b = await ob.vanBoard(d);
      if (my !== seq) return;
      board.value = b;
      status.value = "ready";
    } catch (e) {
      if (my !== seq) return;
      if (e instanceof ApiError && e.status === 404) status.value = "missing";
      else { status.value = "error"; error.value = e instanceof Error ? e.message : String(e); }
    }
  }

  const tripOf = (routeId: string): ObVanTrip | undefined => board.value?.trips.find((t) => t.route_id === routeId);

  return { board, date, status, error, load, tripOf };
});
