<script setup lang="ts">
/**
 * Aperçu de pose d'une note (tête + lignes supplémentaires + étiquette), partagé par
 * l'éditeur (PageView) et la mini-portée (PitchPickerStaff). Coordonnées en px dans le
 * repère du parent positionné ; `scale` = px par unité VexFlow.
 */
defineProps<{ x: number; y: number; ledgers: number[]; scale: number; label: string; cancelled: boolean }>()
</script>

<template>
  <span
    v-for="(ly, k) in ledgers"
    :key="k"
    class="pv-ledger"
    :class="{ cancelled }"
    :style="{ left: `${x}px`, top: `${ly}px`, width: `${22 * scale}px` }"
  />
  <span
    class="pv-head"
    :class="{ cancelled }"
    :style="{ left: `${x}px`, top: `${y}px`, width: `${12 * scale}px`, height: `${9.5 * scale}px` }"
  />
  <span class="pv-label mono" :class="{ cancelled }" :style="{ left: `${x}px`, top: `${y}px` }">{{
    cancelled ? 'annulé' : label
  }}</span>
</template>

<style scoped>
.pv-head, .pv-ledger, .pv-label { position: absolute; pointer-events: none; z-index: 2; }
.pv-head {
  transform: translate(-50%, -50%) rotate(-20deg); border-radius: 50%; background: var(--accent);
  box-shadow: 0 0 0 4px rgba(var(--v-theme-primary), 0.18);
}
.pv-ledger { height: 1.5px; transform: translate(-50%, -50%); background: var(--accent); }
.pv-label {
  transform: translate(-50%, calc(-100% - 14px)); padding: 1px 8px; border-radius: 999px; font-size: 0.8rem; font-weight: 700;
  background: var(--accent); color: #fff; white-space: nowrap;
}
.cancelled { background: var(--ink-2) !important; box-shadow: none !important; }
</style>
