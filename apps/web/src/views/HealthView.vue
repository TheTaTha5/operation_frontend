<script setup lang="ts">
import { config } from "@/lib/config";
import { useSessionStore } from "@/stores/session";

const session = useSessionStore();
</script>

<template>
  <section class="card">
    <p class="muted">System check</p>
    <h1>Healthy</h1>
    <dl class="details">
      <dt>Environment</dt>
      <dd>{{ config.environment }}</dd>
      <dt>Legacy app</dt>
      <dd>{{ config.legacyUrl }}</dd>
      <dt>Session (/api/me)</dt>
      <dd data-testid="session-status">{{ session.status }}</dd>
    </dl>
  </section>
</template>
