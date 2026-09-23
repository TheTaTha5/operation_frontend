<script setup lang="ts">
import { onMounted } from "vue";
import { RouterLink, RouterView } from "vue-router";

import { legacyUrl } from "@/lib/legacy";
import { useSessionStore } from "@/stores/session";

const session = useSessionStore();
onMounted(() => session.load());
</script>

<template>
  <header class="topbar">
    <RouterLink to="/" class="brand">LOVE Andaman</RouterLink>
    <nav aria-label="Primary navigation">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/health">Health</RouterLink>
      <a :href="legacyUrl()">Legacy app</a>
    </nav>
    <span v-if="session.me" class="user">{{ session.me.name || session.me.username }}</span>
  </header>
  <main>
    <RouterView />
  </main>
</template>
