import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVanBoardStore } from "./vanBoard";

const board = (date: string) => ({ date, vans: [], trips: [{ route_id: "r3", pool: { outbound: [] }, groups: [], allocations: [], totals: { unassigned_pax: 0, self_arrive_pax: 0 } }],
  warnings: { no_outbound_van: [], no_return_van: [], van_on_two_routes: [] } });

describe("useVanBoardStore", () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.unstubAllGlobals());

  it("loads a day once and finds a trip", async () => {
    const fetch = vi.fn(async (url: string) => new Response(JSON.stringify(board(url.split("date=")[1]!)), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const s = useVanBoardStore();
    await s.load("2026-10-02");
    await s.load("2026-10-02");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe("/api/ob/operations/van-board?date=2026-10-02");
    expect(s.status).toBe("ready");
    expect(s.tripOf("r3")?.route_id).toBe("r3");
    await s.load("2026-10-02", true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("reports a backend without the endpoint as missing, not as an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    const s = useVanBoardStore();
    await s.load("2026-10-02");
    expect(s.status).toBe("missing");
    expect(s.board).toBeNull();
  });

  it("keeps the latest day when an older answer arrives late", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const d = url.split("date=")[1]!;
      if (d === "2026-10-01") await gate;
      return new Response(JSON.stringify(board(d)), { status: 200 });
    }));
    const s = useVanBoardStore();
    const first = s.load("2026-10-01");
    await s.load("2026-10-02");
    release();
    await first;
    expect(s.board?.date).toBe("2026-10-02");
  });
});
