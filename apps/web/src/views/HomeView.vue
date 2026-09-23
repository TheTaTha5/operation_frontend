<script setup lang="ts">
import { computed } from "vue";

import { groupBySection, legacyUrl, legacyViews } from "@/lib/legacy";
import { useSessionStore } from "@/stores/session";

const session = useSessionStore();

// The legacy app still enforces per-user perms when the link opens; here we only drop admin-only screens.
const sections = computed(() =>
  groupBySection(legacyViews.filter((v) => !v.adminOnly || session.isAdmin)),
);
</script>

<template>
  <section v-if="session.status === 'loading' || session.status === 'idle'">
    <p>Loading…</p>
  </section>

  <section v-else-if="session.status === 'signed-out'" class="card">
    <h1>ยังไม่ได้เข้าสู่ระบบ</h1>
    <p>Sign in through the legacy app, then come back here.</p>
    <a class="button" :href="legacyUrl()">Sign in</a>
  </section>

  <section v-else-if="session.status === 'error'" class="card">
    <h1>Cannot reach the server</h1>
    <button class="button" type="button" @click="session.load()">Retry</button>
  </section>

  <section v-else>
    <h1>Pages</h1>
    <p class="muted">These pages still open in the legacy app. They move here one at a time.</p>
    <div class="sections">
      <div v-for="[section, views] in sections" :key="section" class="card">
        <h2>{{ section }}</h2>
        <ul>
          <li v-for="v in views" :key="v.view">
            <a :href="legacyUrl(v.view)">{{ v.label }}</a>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
