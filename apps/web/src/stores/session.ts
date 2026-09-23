import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { ApiError, getJson } from "@/lib/api";

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

  return { me, status, isAdmin, load };
});
