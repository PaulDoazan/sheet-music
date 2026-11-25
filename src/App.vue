<script setup lang="ts">
import { watch } from 'vue'
import { useTheme } from 'vuetify'

const theme = useTheme()
watch(
  () => theme.global.current.value.colors.background,
  (bg) => document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg),
  { immediate: true },
)
</script>

<template>
  <v-app>
    <!-- L'invitation à tourner le téléphone n'apparaît que dans la partie et l'éditeur (RotateHint inline) -->
    <router-view />
  </v-app>
</template>
