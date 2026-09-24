<script setup lang="ts">
import type { Tone } from './model';

defineProps<{ tone: Tone; title?: string; muted?: boolean }>();
</script>

<template>
  <span
    class="chip"
    :class="[tone, { muted }]"
    :title="title"
  ><slot /></span>
</template>

<style scoped>
.chip {
  display: inline-block;
  margin: 1px 3px 1px 0;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
}
.g { background: var(--ts-g-bg); color: var(--ts-g); }
.r { background: var(--ts-r-bg); color: var(--ts-r); }
.a { background: var(--ts-a-bg); color: var(--ts-a); }
.n { background: var(--ts-n-bg); color: var(--ts-n); }
.e { background: var(--ts-e-bg); color: var(--ts-e); }
.b { background: var(--ts-b-bg); color: var(--ts-b); }
.p { background: var(--ts-p-bg); color: var(--ts-p); }
/* §tsNoBoard · van/boat chip for someone who did not board */
.muted { opacity: 0.45; text-decoration: line-through; }
</style>
