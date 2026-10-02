<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

// A modal over a dimmed page (styles in styles/components.css .dialog). Esc and a backdrop click
// close it, Tab stays inside it, and focus goes back where it was on close. Mount it with v-if.
withDefaults(defineProps<{ eyebrow?: string; title: string; sub?: string; tone?: 'lock' | 'ok'; width?: string }>(), {
  eyebrow: '', sub: '', tone: 'lock', width: '440px',
});
const emit = defineEmits<{ close: [] }>();

const box = ref<HTMLElement>();
let returnTo: HTMLElement | null = null;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const focusables = () => [...(box.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.stopPropagation(); emit('close'); return; }
  if (e.key !== 'Tab') return;
  const els = focusables();
  if (!els.length) return;
  const first = els[0]!, last = els[els.length - 1]!;
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

onMounted(async () => {
  returnTo = document.activeElement as HTMLElement | null;
  await nextTick();
  // The first field if there is one, else the close button.
  (box.value?.querySelector<HTMLElement>('.dialog__body input, .dialog__body select') ?? focusables()[0])?.focus();
});
onBeforeUnmount(() => returnTo?.focus?.());
</script>

<template>
  <Teleport to="body">
    <div class="dialog" @click.self="emit('close')" @keydown="onKey">
      <div ref="box" class="dialog__box" role="dialog" aria-modal="true" :aria-label="title" :style="{ '--dialog-w': width }">
        <div class="dialog__head">
          <div class="dialog__titles">
            <div v-if="eyebrow" class="dialog__eyebrow" :class="{ 'dialog__eyebrow--ok': tone === 'ok' }">{{ eyebrow }}</div>
            <h2 class="dialog__title">{{ title }}</h2>
            <div v-if="sub" class="dialog__sub">{{ sub }}</div>
          </div>
          <button type="button" class="dialog__close" aria-label="Close" @click="emit('close')">&times;</button>
        </div>
        <div class="dialog__body"><slot /></div>
        <div v-if="$slots.foot" class="dialog__foot"><slot name="foot" /></div>
      </div>
    </div>
  </Teleport>
</template>
