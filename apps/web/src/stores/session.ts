import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { ApiError, getJson, postJson } from "@/lib/api";

/** Shape of server.js `/api/me`. */
export type Me = {
  username: string;
  name: string;
  role: string;
  /** null = full access; otherwise the legacy view keys this user may open. */
  perms: string[] | null;
  canEdit: boolean;
  editAreas: string[] | null;
  salesId: string | null;
};

type Status = "idle" | "loading" | "signed-in" | "signed-out" | "error";

export const useSessionStore = defineStore("session", () => {
  const me = ref<Me | null>(null);
  const status = ref<Status>("idle");

  const isAdmin = computed(() => me.value?.role === "admin");

  async function load(): Promise<void> {
    status.value = "loading";
    try {
      me.value = await getJson<Me>("/api/me");
      status.value = "signed-in";
    } catch (e) {
      me.value = null;
      status.value = e instanceof ApiError && e.status === 401 ? "signed-out" : "error";
    }
  }

  /** POST /api/login. server.js sets the `sess` cookie; throws ApiError with the server's message. */
  async function signIn(username: string, password: string): Promise<void> {
    me.value = await postJson<Me>("/api/login", { username, password });
    status.value = "signed-in";
  }

  /** POST /api/logout. Clears local state even if the request fails: the user asked to leave. */
  async function signOut(): Promise<void> {
    try { await postJson("/api/logout", {}); } finally {
      me.value = null;
      status.value = "signed-out";
    }
  }

  return { me, status, isAdmin, load, signIn, signOut };
});
