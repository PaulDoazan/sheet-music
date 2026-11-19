<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { SOLFEGE, STEPS, type Step } from '@/music/model'

const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ answer: [Step] }>()

const flash = ref<{ step: Step; ok: boolean } | null>(null)
let t: ReturnType<typeof setTimeout> | undefined

/** Appelé par le parent après vérification, pour colorer brièvement le bouton. */
function showResult(step: Step, ok: boolean) {
  flash.value = { step, ok }
  clearTimeout(t)
  t = setTimeout(() => (flash.value = null), 260)
}

// Clavier : notation anglaise C…B, ou 1…7
const KEYS: Record<string, Step> = { c: 'C', d: 'D', e: 'E', f: 'F', g: 'G', a: 'A', b: 'B' }
function onKey(e: KeyboardEvent) {
  if (props.disabled || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
  const k = e.key.toLowerCase()
  const step = KEYS[k] ?? (/^[1-7]$/.test(k) ? STEPS[Number(k) - 1] : undefined)
  if (step) {
    e.preventDefault()
    emit('answer', step)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

defineExpose({ showResult })
</script>

<template>
  <div class="note-buttons" role="group" aria-label="Nom de la note">
    <button
      v-for="(step, i) in STEPS"
      :key="step"
      type="button"
      class="bos-btn note-btn"
      :class="{ ok: flash?.step === step && flash.ok, ko: flash?.step === step && !flash.ok }"
      :disabled="disabled"
      :aria-keyshortcuts="`${step} ${i + 1}`"
      @pointerdown.prevent="emit('answer', step)"
      @keydown.enter.prevent="emit('answer', step)"
    >
      {{ SOLFEGE[step] }}
    </button>
  </div>
</template>

<style scoped>
.note-buttons { display: grid; grid-template-columns: repeat(7, 1fr); gap: clamp(4px, 1.2vw, 12px); }
.note-btn {
  min-height: clamp(48px, 13dvh, 72px); padding: 0 2px; font-size: clamp(0.95rem, 2.6vw, 1.3rem); font-weight: 800;
}
.note-btn.ok { background: var(--good); color: #fff; }
.note-btn.ko { background: var(--bad); color: #fff; }
</style>
