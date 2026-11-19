<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ remainingMs: number; totalMs: number }>()
const ratio = computed(() => Math.max(0, Math.min(1, props.remainingMs / props.totalMs)))
const hurry = computed(() => props.remainingMs <= 15_000)
const label = computed(() => {
  const s = Math.ceil(props.remainingMs / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})
</script>

<template>
  <div class="timer" :class="{ hurry }" role="timer" :aria-label="`Temps restant ${label}`">
    <div class="timer-fill" :style="{ transform: `scaleX(${ratio})` }" />
    <span class="mono">{{ label }}</span>
  </div>
</template>

<style scoped>
.timer {
  position: relative; flex: 1; height: 30px; border-radius: 999px; background: var(--paper-2);
  border: 1.5px solid var(--line); overflow: hidden;
}
.timer-fill { position: absolute; inset: 0; background: var(--ink); transform-origin: left; }
.timer.hurry .timer-fill { background: var(--accent); }
.timer span {
  position: absolute; inset: 0; display: grid; place-items: center; color: #fff;
  mix-blend-mode: difference; font-weight: 700; font-size: 0.9rem;
}
</style>
