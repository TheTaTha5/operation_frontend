<script setup lang="ts">
import { computed } from 'vue';

import { legacyUrl } from '@/lib/legacy';
import type { ObVanBoard } from '@/lib/ob';

import { vanChips } from './vanMode';

// The VANS card that replaces Seat Lock + Notice in van mode (legacy booking.js:9345-9410,
// 10050-10068): per trip, the vans in use with their pax per round, then what is still to arrange.
// Read-only: the grouping bar points to the legacy page until the backend can save groups.
const props = defineProps<{
  trips: readonly { rid: string; name: string; dep: string; color: string }[];
  board: ObVanBoard | null;
  status: 'idle' | 'loading' | 'ready' | 'missing' | 'error';
  error: string;
}>();
const emit = defineEmits<{ scrollTo: [rid: string, groupId: string]; retry: [] }>();

const parts = computed(() => props.trips.map((t) => {
  const trip = props.board?.trips.find((x) => x.route_id === t.rid);
  return { ...t, trip, chips: vanChips(trip, props.board?.vans || []) };
}));
const nVans = computed(() => new Set(parts.value.flatMap((p) => p.chips.map((c) => c.van.id))).size);
const firstGroup = (p: (typeof parts.value)[number], vanId: string) =>
  [...(p.trip?.groups || [])].sort((a, b) => a.number - b.number).find((g) => g.van_id === vanId)?.id || '';
</script>

<template>
  <div class="bt-c bt-vans">
    <div class="bt-ct">&#128656; Vans<span class="sp" />
      <span v-if="status === 'ready'" class="bt-cnt">{{ nVans }} van{{ nVans === 1 ? '' : 's' }} &middot; {{ trips.length }} trip{{ trips.length === 1 ? '' : 's' }}</span>
    </div>

    <div v-if="status === 'missing'" class="vans-card__note">
      <b>Van assignment is not in operation-backend yet</b>
      <span>This page can show van groups once the backend serves <code>/operations/van-board</code>. Until then, assign vans on the legacy page.</span>
      <a :href="legacyUrl('booking')">Open legacy Booking &rarr;</a>
    </div>
    <div v-else-if="status === 'error'" class="vans-card__note vans-card__note--err">
      <b>Could not load vans</b><span>{{ error }}</span>
      <button type="button" @click="emit('retry')">Retry</button>
    </div>
    <div v-else-if="status !== 'ready'" class="vans-card__note"><span>Loading vans…</span></div>

    <template v-else>
      <div class="bt-vgrid">
        <div v-for="p in parts" :key="p.rid" class="bt-vgrp">
          <div class="bt-vgrpt"><i :style="{ background: p.color }" /><b>{{ p.name }}</b><em>{{ p.dep }}</em></div>
          <div class="vans-card__chips">
            <button v-for="c in p.chips" :key="c.van.id" type="button" class="van-chip" :class="{ 'van-chip--over': c.over }"
                    :title="`Go to ${c.van.name}` + (c.roundPax.length > 1 ? ` · ${c.roundPax.length} rounds: ${c.roundPax.join(' + ')} pax` : '')"
                    @click="emit('scrollTo', p.rid, firstGroup(p, c.van.id))">
              <span class="van-chip__dot" :style="{ background: c.ink }" />
              <span class="van-chip__body">
                <span class="van-chip__name">
                  <span class="van-chip__grp" :style="{ background: c.ink }">{{ c.roundPax.length > 1 ? '↻ ' : '' }}{{ c.groupNumbers.join('+') }}</span>
                  {{ c.van.name }}<span v-if="c.van.plate" class="van-chip__plate">{{ c.van.plate }}</span>
                </span>
                <span class="van-chip__pax">{{ c.bookings }} booking &middot; <b :class="{ over: c.over }">{{ c.roundPax.join('+') }}{{ c.van.capacity ? '/' + c.van.capacity : '' }} pax</b></span>
                <span v-if="c.areas.length" class="van-chip__area" :title="`Pickup: ${c.areas.join(' · ')}`">&#128205; {{ c.areas.join(' · ') }}</span>
              </span>
            </button>
            <span v-if="p.trip && p.trip.totals.unassigned_pax > 0" class="vans-card__extra vans-card__extra--warn">&#9888; ยังไม่จัดรถ {{ p.trip.totals.unassigned_pax }} pax</span>
            <span v-if="p.trip && p.trip.totals.self_arrive_pax > 0" class="vans-card__extra">self-arrive {{ p.trip.totals.self_arrive_pax }} pax</span>
            <span v-if="!p.chips.length && !(p.trip && (p.trip.totals.unassigned_pax || p.trip.totals.self_arrive_pax))" class="bt-none2">No van assigned yet</span>
          </div>
        </div>
      </div>
      <div class="van-groupbar">
        <span class="van-groupbar__title">&#9745; Grouping</span>
        <span>Grouping and picking vans are not moved yet.</span>
        <a :href="legacyUrl('booking')">Edit on the legacy page &rarr;</a>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Legacy .bt-c / .bt-ct / .bt-cnt / .bt-vans / .bt-vgrid / .bt-vgrp / .bt-vgrpt (booking.js:8284-8295,
   8486-8520). The card's root carries ByTripView's scope, but the children do not, so the shared
   card rules are repeated here. Van chips and the grouping bar were inline styles (9365-9393). */
.bt-c { background: #fff; border: 2px solid var(--van); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;
  max-height: 268px; box-shadow: 0 0 0 2px rgba(15, 110, 86, 0.14); }
.bt-ct { font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; padding: 7px 11px 5px; display: flex; align-items: center; gap: 6px;
  color: #0C6B47; background: var(--van-soft); border-bottom: 1px solid #DFF0E8; }
.bt-ct .sp { flex: 1; }
.bt-cnt { background: #EFEBE7; color: #403833; border-radius: 999px; padding: 2px 9px; font-size: 10.5px; font-weight: 800; letter-spacing: 0; text-transform: none; }
.bt-vgrid { display: flex; flex-direction: column; overflow-y: auto; min-height: 56px; max-height: 196px; flex: 1 1 auto; }
.bt-vgrid::-webkit-scrollbar { width: 8px; }
.bt-vgrid::-webkit-scrollbar-thumb { background: #CFE3D8; border-radius: 8px; }
.bt-vgrp { padding: 6px 10px; }
.bt-vgrp + .bt-vgrp { border-top: 1px dashed #E4EFE9; }
.bt-vgrpt { display: flex; align-items: center; gap: 6px; font-size: 10px; margin-bottom: 5px; }
.bt-vgrpt i { width: 7px; height: 7px; border-radius: 50%; flex: none; }
.bt-vgrpt b { font-weight: 800; color: #1F2124; }
.bt-vgrpt em { font-style: normal; font-size: 9px; color: #8d97a4; }
.bt-none2 { display: block; padding: 6px; font-size: 11.5px; color: #a8a49c; }
.vans-card__chips { display: flex; flex-wrap: wrap; gap: 5px; }
.van-chip { background: #fff; border: 1px solid #e6e4dd; border-radius: 8px; padding: 4px 8px; display: flex; align-items: center; gap: 6px; min-width: 0; cursor: pointer; font-family: inherit; text-align: left; color: inherit; }
.van-chip--over { border-color: #E6C9C3; }
.van-chip__dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.van-chip__body { display: flex; flex-direction: column; min-width: 0; }
.van-chip__name { font-weight: 700; font-size: 11px; white-space: nowrap; display: flex; align-items: center; gap: 4px; }
.van-chip__grp { color: #fff; font-size: 8.5px; font-weight: 700; border-radius: 4px; padding: 0 5px; }
.van-chip__plate { font-size: 9px; color: #999; font-family: 'DM Mono', monospace; font-weight: 400; }
.van-chip__pax { font-size: 9px; color: #7a7a72; }
.van-chip__pax b.over { color: #A32D2D; }
.van-chip__area { font-size: 8.5px; color: #B07A1F; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
.vans-card__extra { font-size: 11px; color: #5F5E5A; background: #F1EFE8; border-radius: 8px; padding: 6px 10px; }
.vans-card__extra--warn { font-weight: 700; color: #9A5B00; background: #FFF9F0; border: 1px solid #E6B97A; }
.van-groupbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 12px; background: #F7FAFE; border-top: 1px solid #E6EEF7; color: #8a8a82; font-size: 11.5px; }
.van-groupbar__title { color: var(--sel); font-weight: 700; }
.van-groupbar a, .vans-card__note a { color: var(--sel); font-weight: 600; text-decoration: none; }
.vans-card__note { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; font-size: 11.5px; color: #5a6b62; }
.vans-card__note b { color: #0C6B47; font-size: 12px; }
.vans-card__note--err b { color: #A32D2D; }
.vans-card__note button { align-self: flex-start; border: 1px solid var(--border); background: #fff; border-radius: 6px; padding: 3px 10px; font-family: inherit; font-size: 11px; cursor: pointer; }
</style>
