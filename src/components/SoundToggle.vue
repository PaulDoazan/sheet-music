<script setup lang="ts">
import { mdiVolumeHigh, mdiVolumeOff } from '@mdi/js'
import { setSoundOn, soundOn } from '@/music/audio/soundPref'
</script>

<template>
  <button
    class="bos-btn small round"
    type="button"
    :aria-label="soundOn ? 'Couper le son' : 'Activer le son'"
    :title="soundOn ? 'Couper le son' : 'Activer le son'"
    :aria-pressed="soundOn"
    @click="setSoundOn(!soundOn)"
  >
    <v-icon :icon="soundOn ? mdiVolumeHigh : mdiVolumeOff" size="22" />
  </button>
</template>
