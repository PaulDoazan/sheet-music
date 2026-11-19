<script setup lang="ts">
import { computed, ref, watch } from 'vue'

// Jauge de score : se remplit vers l'objectif ; rebond vert/rouge quand le score change.
const props = defineProps<{ score: number; target: number }>()
const root = ref<HTMLDivElement>()
const ratio = computed(() => Math.min(1, props.score / props.target))
const bump = ref<'up' | 'down' | null>(null)
let t: ReturnType<typeof setTimeout> | undefined

function flash(kind: 'up' | 'down') {
  bump.value = null
  requestAnimationFrame(() => {
    bump.value = kind
    clearTimeout(t)
    t = setTimeout(() => (bump.value = null), 380)
  })
}
watch(
  () => props.score,
  (v, old) => {
    if (v !== old) flash(v > old ? 'up' : 'down')
  },
)

defineExpose({ el: root, flash })
</script>

<template>
  <div ref="root" class="gauge" :class="bump" role="status" :aria-label="`Score ${score}`">
    <div class="gauge-fill" :style="{ transform: `scaleX(${ratio})` }" />
    <span class="mono value">{{ score }}</span>
  </div>
</template>

<style scoped>
.gauge {
  position: relative; width: clamp(92px, 16vw, 160px); height: 30px; border-radius: 999px;
  background: var(--paper-2); border: 2px solid var(--ink); overflow: hidden; flex: none;
}
.gauge-fill {
  position: absolute; inset: 0; background: var(--good); transform-origin: left;
  transition: transform 0.3s cubic-bezier(0.3, 0.7, 0.3, 1.3);
}
.value {
  position: absolute; inset: 0; display: grid; place-items: center; font-weight: 700;
  color: var(--ink); font-size: 1rem;
}
.gauge.up { animation: up 0.38s ease-out; }
.gauge.down { animation: down 0.38s ease-out; }
.gauge.down .gauge-fill { background: var(--bad); }
@keyframes up { 40% { transform: scale(1.12); } }
@keyframes down { 25% { transform: translateX(-4px); } 50% { transform: translateX(4px); } 75% { transform: translateX(-2px); } }
</style>
