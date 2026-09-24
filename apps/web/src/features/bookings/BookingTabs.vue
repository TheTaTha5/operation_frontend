<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import { legacyUrl } from '@/lib/legacy';
import { useSessionStore } from '@/stores/session';

// The legacy Booking page's topbar card (bkV2RenderTopbar): tab strip · meta · "+ New booking".
// Tabs moved to this app are router links; the rest open the legacy page, but only where the legacy
// app has its database — otherwise they show disabled.
defineProps<{ active: 'bytrip' | 'all'; meta: string }>();

const session = useSessionStore();
const legacyOn = computed(() => session.me?.legacyData !== false);
const LEGACY_TABS = ['Seat Locks', 'รออนุมัติ', 'Cancellations'];
</script>

<template>
  <!-- Topbar card: tabs · meta · new booking (bkV2RenderTopbar) -->
  <div class="bkv2 bkv2-topcard">
    <div class="bkv2-topbar2">
      <div class="bkv2-utabs" role="tablist" aria-label="Booking views">
        <RouterLink class="bkv2-utab" to="/calendar">Calendar</RouterLink>
        <RouterLink class="bkv2-utab" :class="{ on: active === 'bytrip' }" to="/bookings/trips" role="tab" :aria-selected="active === 'bytrip'">By trip &middot; date</RouterLink>
        <RouterLink class="bkv2-utab" :class="{ on: active === 'all' }" to="/bookings" role="tab" :aria-selected="active === 'all'">All bookings</RouterLink>
        <template v-for="t in LEGACY_TABS" :key="t">
          <a v-if="legacyOn" class="bkv2-utab" :href="legacyUrl('booking')">{{ t }}</a>
          <button v-else type="button" class="bkv2-utab" disabled title="Not moved yet">{{ t }}</button>
        </template>
      </div>
      <div class="bkv2-topspacer" />
      <div class="bkv2-meta2">{{ meta }}</div>
      <a v-if="legacyOn" class="bkv2-newbtn2" :href="legacyUrl('booking')">+ New booking <span class="bkv2-kbd2">C</span></a>
      <button v-else type="button" class="bkv2-newbtn2" disabled title="Not moved yet">+ New booking <span class="bkv2-kbd2">C</span></button>
    </div>
  </div>
</template>

<style scoped>
/* Ported from 01-base.css #view-booking .bkv2* and the BuildAxis / liquid-glass skin in 02-skins.css.
   The colour variables come from the page wrapper (.bkw / .btw). */
.bkv2 { background: var(--white); border: 1px solid var(--border); border-radius: var(--r); overflow: hidden; margin-top: 0; box-shadow: var(--shadow); }
.bkv2-topcard { margin-bottom: 12px; overflow: visible; background: transparent !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; }

/* Topbar · floating liquid-glass islands */
.bkv2-topbar2 { display: flex; align-items: center; gap: 10px; padding: 4px 2px; flex-wrap: wrap; background: transparent; }
.bkv2-utabs, .bkv2-meta2 { backdrop-filter: blur(16px) saturate(1.4); -webkit-backdrop-filter: blur(16px) saturate(1.4); box-shadow: 0 6px 18px rgba(31, 42, 68, 0.13); border: 1px solid rgba(255, 255, 255, 0.75); }
.bkv2-utabs { display: inline-flex; align-items: center; gap: 2px; background: rgba(255, 255, 255, 0.72); border-radius: 999px; padding: 4px; max-width: 100%; overflow-x: auto; }
.bkv2-utab { font-size: 12.5px; font-weight: 500; color: #64748B; padding: 6px 15px; border: none; background: none; border-radius: 999px; cursor: pointer; font-family: inherit; line-height: 1.2; white-space: nowrap; transition: background 0.12s, color 0.12s; text-decoration: none; }
.bkv2-utab:hover { color: #3A6FF7; background: rgba(58, 111, 247, 0.12); }
.bkv2-utab:active { background: rgba(58, 111, 247, 0.22); transform: scale(0.97); }
.bkv2-utab.on { color: #fff; font-weight: 600; background: #3A6FF7; box-shadow: 0 2px 6px rgba(58, 111, 247, 0.32); cursor: default; }
.bkv2-utab:disabled { opacity: 0.45; cursor: default; background: none; color: #64748B; transform: none; }
.bkv2-topspacer { margin-left: auto; }
.bkv2-meta2 { font-size: 12px; color: #5A6478; font-variant-numeric: tabular-nums; background: rgba(255, 255, 255, 0.7); border-radius: 999px; padding: 8px 14px; }
.bkv2-newbtn2 { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: #fff; background: #1F2A44; border: none; border-radius: 999px; padding: 8px 15px; cursor: pointer; font-family: inherit; text-decoration: none; }
.bkv2-newbtn2:hover { background: #2952C8; }
.bkv2-newbtn2:disabled { opacity: 0.45; cursor: default; background: #1F2A44; }
.bkv2-kbd2 { background: rgba(255, 255, 255, 0.2); border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: 600; }
</style>
