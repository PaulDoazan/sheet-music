<script setup lang="ts">
import { mdiFullscreen, mdiFullscreenExit } from '@mdi/js'
import { useFullscreen } from '@/composables/useFullscreen'

const { supported, active, toggle } = useFullscreen()
</script>

<template>
  <button
    v-if="supported"
    class="bos-btn small round"
    type="button"
    :aria-label="active ? 'Quitter le plein écran' : 'Plein écran'"
    :title="active ? 'Quitter le plein écran' : 'Plein écran'"
    :aria-pressed="active"
    @click="toggle"
  >
    <v-icon :icon="active ? mdiFullscreenExit : mdiFullscreen" size="22" />
  </button>
</template>
