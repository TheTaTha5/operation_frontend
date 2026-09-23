import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "./session";

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("session store", () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.unstubAllGlobals());

  it("is signed in when /api/me answers 200", async () => {
    vi.stubGlobal("fetch", respond(200, { username: "ta", name: "Ta", role: "admin", perms: null }));
    const s = useSessionStore();
    await s.load();
    expect(s.status).toBe("signed-in");
    expect(s.isAdmin).toBe(true);
  });

  it("is signed out on 401", async () => {
    vi.stubGlobal("fetch", respond(401, { error: "not logged in" }));
    const s = useSessionStore();
    await s.load();
    expect(s.status).toBe("signed-out");
    expect(s.me).toBeNull();
  });

  it("reports other failures as errors", async () => {
    vi.stubGlobal("fetch", respond(502, {}));
    const s = useSessionStore();
    await s.load();
    expect(s.status).toBe("error");
  });
});
