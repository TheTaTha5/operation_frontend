<script setup lang="ts">
import { onMounted } from "vue";
import { RouterLink, RouterView, useRouter } from "vue-router";

import { legacyUrl } from "@/lib/legacy";
import { useSessionStore } from "@/stores/session";

const session = useSessionStore();
const router = useRouter();
onMounted(() => session.load());

async function signOut(): Promise<void> {
  await session.signOut();
  await router.push("/login");
}
</script>

<template>
  <header class="topbar">
    <RouterLink to="/" class="brand">LOVE Andaman</RouterLink>
    <nav aria-label="Primary navigation">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/health">Health</RouterLink>
      <a :href="legacyUrl()">Legacy app</a>
    </nav>
    <span v-if="session.me" class="user">
      {{ session.me.name || session.me.username }}
      <button type="button" class="linklike" @click="signOut">Sign out</button>
    </span>
  </header>
  <main>
    <RouterView />
  </main>
</template>
