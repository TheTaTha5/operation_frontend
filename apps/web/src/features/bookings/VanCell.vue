<script setup lang="ts">
import type { ObVanOnDay } from '@/lib/ob';

import { isSelfArrive, type VanGroupView, type VanRow } from './vanMode';

// The "✓ กลุ่ม" cell of a van-mode row (legacy bkV2VanCellHTML, booking.js:3247-3285), read-only:
// the tick box, split and return-van controls are shown disabled until operation-backend can save them.
const props = defineProps<{ r: VanRow; zone: string; group: VanGroupView | null; vans: readonly ObVanOnDay[] }>();

const retName = () => {
  const id = props.r.alloc?.return.van_id;
  return id ? props.vans.find((v) => v.id === id)?.name || id : '';
};
</script>

<template>
  <span v-if="isSelfArrive(zone)" class="van-cell__self">self-arrive</span>
  <span v-else class="van-cell">
    <span class="van-cell__tick" title="Grouping is not moved yet · use the legacy page" aria-hidden="true" />
    <span v-if="group" class="van-cell__chip" :style="{ background: group.colors[0], color: group.colors[1] }"
          :title="`Group ${group.group.number}${group.van ? ' · ' + group.van.name : ' · no van yet'}`">
      {{ group.group.number }}<template v-if="group.van"> &middot; {{ group.van.name }}</template>
    </span>
    <span v-else class="van-cell__none">&mdash;</span>
    <span v-if="group && retName()" class="van-cell__ret" :title="`Return van: ${retName()}`">&#8617; {{ retName() }}</span>
    <span v-if="r.alloc?.split" class="van-cell__split" :title="`Split part ${r.alloc.idx + 1}`">&#9986; {{ r.alloc.idx + 1 }}</span>
  </span>
</template>

<style scoped>
/* Legacy inline styles of bkV2VanCellHTML (booking.js:3247-3291). */
.van-cell { display: flex; gap: 4px; align-items: center; justify-content: center; white-space: nowrap; }
.van-cell__tick { width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid #C9CDD4; flex: none; opacity: 0.5; }
.van-cell__chip { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 5px; max-width: 88px; overflow: hidden; text-overflow: ellipsis; }
.van-cell__none { color: #c4c2ba; }
.van-cell__ret { font-size: 9.5px; color: var(--van-ret); border: 1px solid #C7B8E8; border-radius: 5px; padding: 0 5px; max-width: 64px; overflow: hidden; text-overflow: ellipsis; }
/* One-off, legacy split button (booking.js:3276). */
.van-cell__split { font-size: 9px; font-weight: 700; color: #5B289A; background: #F3EFFB; border: 1px solid #D9CEF0; border-radius: 5px; padding: 0 5px; }
.van-cell__self { font-style: italic; font-size: 10px; color: #8a8a82; }
</style>
