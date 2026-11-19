<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import { mdiWeatherNight, mdiWhiteBalanceSunny } from '@mdi/js'

const theme = useTheme()
const isDark = computed(() => theme.global.current.value.dark)

function toggle() {
  const next = isDark.value ? 'light' : 'dark'
  theme.global.name.value = next
  try {
    localStorage.setItem('sheet-music:theme', next)
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <button
    class="bos-btn small round"
    type="button"
    :aria-label="isDark ? 'Passer en mode clair' : 'Passer en mode sombre'"
    :title="isDark ? 'Mode clair' : 'Mode sombre'"
    @click="toggle"
  >
    <v-icon :icon="isDark ? mdiWhiteBalanceSunny : mdiWeatherNight" size="20" />
  </button>
</template>
