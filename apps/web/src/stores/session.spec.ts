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

  it("signs in with POST /api/login", async () => {
    const fetch = respond(200, { username: "ops", name: "ops", role: "admin", perms: null });
    vi.stubGlobal("fetch", fetch);
    const s = useSessionStore();
    await s.signIn("ops", "pw");
    expect(fetch).toHaveBeenCalledWith("/api/login", expect.objectContaining({ method: "POST", body: '{"username":"ops","password":"pw"}' }));
    expect(s.status).toBe("signed-in");
    expect(s.me?.username).toBe("ops");
  });

  it("surfaces the server's message when sign-in is refused", async () => {
    vi.stubGlobal("fetch", respond(401, { error: "wrong password" }));
    const s = useSessionStore();
    await expect(s.signIn("ops", "x")).rejects.toThrow("wrong password");
    expect(s.status).toBe("idle");
  });

  it("is signed out after sign-out, even if the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const s = useSessionStore();
    s.status = "signed-in";
    await expect(s.signOut()).rejects.toThrow("offline");
    expect(s.status).toBe("signed-out");
    expect(s.me).toBeNull();
  });
});
