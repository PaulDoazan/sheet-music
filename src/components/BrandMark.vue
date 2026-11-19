<template>
  <span class="brand-mark" aria-hidden="true"><i /><i /></span>
</template>

<style scoped>
/* Tête de note + hampe, dans l'esprit des deux barres de big-or-small */
.brand-mark { position: relative; display: inline-block; width: 22px; height: 26px; }
.brand-mark i:first-child {
  position: absolute; left: 0; bottom: 0; width: 14px; height: 10px; border-radius: 50%;
  background: var(--ink); transform: rotate(-20deg);
}
.brand-mark i:last-child {
  position: absolute; left: 11px; bottom: 4px; width: 4px; height: 22px; border-radius: 2px;
  background: var(--accent);
}
</style>
