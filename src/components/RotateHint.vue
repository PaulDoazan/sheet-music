<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { mdiClose, mdiPhoneRotateLandscape } from '@mdi/js'

// Invitation (non bloquante) à passer en paysage sur téléphone en portrait.
const KEY = 'sheet-music:rotate-hint-dismissed'
defineProps<{ inline?: boolean }>()
const visible = ref(false)
let mq: MediaQueryList | undefined

function dismissed() {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
function update() {
  const touch = window.matchMedia('(pointer: coarse)').matches
  visible.value = !!mq?.matches && touch && !dismissed()
}
function close() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* ignore */
  }
  visible.value = false
}
onMounted(() => {
  mq = window.matchMedia('(orientation: portrait)')
  mq.addEventListener('change', update)
  update()
})
onBeforeUnmount(() => mq?.removeEventListener('change', update))
</script>

<template>
  <Transition name="hint">
    <div v-if="visible" class="rotate-hint card" :class="{ inline }" role="status">
      <v-icon :icon="mdiPhoneRotateLandscape" class="rotate-icon" />
      <span>Tourne ton téléphone pour plus de confort</span>
      <button class="bos-btn small round" type="button" aria-label="Fermer" @click="close">
        <v-icon :icon="mdiClose" size="18" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.rotate-hint {
  position: fixed; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom));
  z-index: 50; display: flex; align-items: center; gap: 12px; padding: 10px 10px 10px 16px;
  font-weight: 600; font-size: 0.95rem;
}
.rotate-hint.inline { position: static; flex: none; }
.rotate-hint span { flex: 1; }
.rotate-icon { color: var(--accent); animation: tilt 2.4s ease-in-out infinite; }
@keyframes tilt { 0%, 40% { transform: rotate(0); } 60%, 100% { transform: rotate(-90deg); } }
.hint-enter-active, .hint-leave-active { transition: transform 0.25s, opacity 0.25s; }
.hint-enter-from, .hint-leave-to { transform: translateY(20px); opacity: 0; }
</style>
