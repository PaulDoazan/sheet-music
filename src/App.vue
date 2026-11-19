<script setup lang="ts">
import { watch } from 'vue'
import { useTheme } from 'vuetify'
import RotateHint from './components/RotateHint.vue'

const theme = useTheme()
watch(
  () => theme.global.current.value.colors.background,
  (bg) => document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg),
  { immediate: true },
)
</script>

<template>
  <v-app>
    <router-view />
    <RotateHint v-if="$route.name !== 'play'" />
  </v-app>
</template>
