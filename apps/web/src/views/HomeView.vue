<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";

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
    <RouterLink class="button" to="/login">Sign in</RouterLink>
  </section>

  <section v-else-if="session.status === 'error'" class="card">
    <h1>Cannot reach the server</h1>
    <button class="button" type="button" @click="session.load()">Retry</button>
  </section>

  <section v-else>
    <h1>New pages</h1>
    <div class="card new">
      <RouterLink to="/bookings">Bookings</RouterLink>
      <span class="muted"> · all bookings by travel month, and each booking's detail. Read-only, from operation-backend.</span>
    </div>
    <div class="card new">
      <RouterLink to="/calendar">Calendar</RouterLink>
      <span class="muted"> · seats free per route and day, from operation-backend.</span>
    </div>
    <!-- Phase 1 still reads the legacy data (/api/ck), so it cannot load without the legacy database. -->
    <div v-if="session.me?.legacyData !== false" class="card new">
      <RouterLink to="/travel-summary">Travel Summary</RouterLink>
      <span class="muted"> · phase 1, read-only: day overview and manifest. Penalty decisions, on-site money and printing are still on the <a :href="legacyUrl('travelsum')">legacy page</a>.</span>
    </div>
    <h1>Pages</h1>
    <p v-if="session.me?.legacyData === false" class="muted">
      These pages still live in the legacy app, which has no database on this deployment, so they are
      not listed. They move here one at a time.
    </p>
    <p v-else class="muted">These pages still open in the legacy app. They move here one at a time.</p>
    <div v-if="session.me?.legacyData !== false" class="sections">
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
