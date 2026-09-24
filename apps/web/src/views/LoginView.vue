<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { ApiError } from "@/lib/api";
import { useSessionStore } from "@/stores/session";

const session = useSessionStore();
const route = useRoute();
const router = useRouter();

const username = ref("");
const password = ref("");
const busy = ref(false);
const error = ref("");

/** Only an in-app path: `?next=` must not be able to send the user to another site. */
function nextPath(): string {
  const n = route.query.next;
  return typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

async function submit(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await session.signIn(username.value.trim(), password.value);
    await router.replace(nextPath());
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "เข้าสู่ระบบไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="card login">
    <h1>LOVE Andaman</h1>
    <p class="muted">เข้าสู่ระบบเพื่อใช้งาน</p>
    <form @submit.prevent="submit">
      <label>
        Username
        <input v-model="username" name="username" autocomplete="username" required autofocus />
      </label>
      <label>
        Password
        <input v-model="password" name="password" type="password" autocomplete="current-password" required />
      </label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="button" type="submit" :disabled="busy">{{ busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ" }}</button>
    </form>
  </section>
</template>

<style scoped>
.login { max-width: 340px; margin: 10vh auto 0; }
.login h1 { margin: 0 0 4px; font-size: 1.25rem; }
form { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 0.875rem; color: var(--muted); }
input { font: inherit; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); }
.error { margin: 0; color: #c0392b; font-size: 0.875rem; }
button:disabled { opacity: 0.6; cursor: default; }
</style>
