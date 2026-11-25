<script setup lang="ts">
import { ref } from 'vue'
import { mdiCogOutline, mdiEmailOutline, mdiMusicNote, mdiPencil } from '@mdi/js'
import { parsePitch, type Clef, type Score } from '@/music/model'
import StaffView from '@/music/render/StaffView.vue'
import BrandMark from '@/components/BrandMark.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import FullscreenToggle from '@/components/FullscreenToggle.vue'
import SettingsDialog from '@/features/settings/SettingsDialog.vue'
import ContactDialog from '@/features/contact/ContactDialog.vue'

const settingsOpen = ref(false)
const contactOpen = ref(false)

// Mini-portées d'illustration (même motif que le menu Lecture)
function miniScore(id: string, clef: Clef, pitches: string[], duration: 'q' | 'h'): Score {
  return {
    id: `home-${id}`,
    bpm: 60,
    timeSignature: [4, 4],
    staves: [
      {
        id: clef,
        clef,
        voices: [
          { id: 'v', notes: pitches.map((p, i) => ({ id: `${id}-${i}`, pitch: parsePitch(p), duration })) },
        ],
      },
    ],
  }
}
const readScore = miniScore('read', 'treble', ['G4', 'B4', 'D5'], 'q')
const writeScore = miniScore('write', 'treble', ['E4', 'G4', 'C5', 'E5'], 'q')
const extents = [{ above: 1, below: 1 }]
</script>

<template>
  <div class="home">
    <header class="topbar">
      <span class="brand"><BrandMark /><span>Solfa<em>box</em></span></span>
      <div class="topbar-actions">
        <button class="bos-btn small round" type="button" aria-label="Réglages" title="Réglages" @click="settingsOpen = true">
          <v-icon :icon="mdiCogOutline" size="20" />
        </button>
        <FullscreenToggle /><ThemeToggle />
      </div>
    </header>

    <main class="choices">
      <router-link :to="{ name: 'read' }" class="choice card">
        <div class="mini" aria-hidden="true"><StaffView :score="readScore" :extents="extents" :max-scale="1" /></div>
        <h2><v-icon :icon="mdiMusicNote" size="24" /> Lecture</h2>
        <p>Lis les notes</p>
      </router-link>
      <router-link :to="{ name: 'scores' }" class="choice card">
        <div class="mini" aria-hidden="true"><StaffView :score="writeScore" :extents="extents" :max-scale="1" /></div>
        <h2><v-icon :icon="mdiPencil" size="24" /> Écriture</h2>
        <p>Écris, écoute, exporte</p>
      </router-link>
    </main>

    <footer class="foot">
      <button class="bos-btn small" type="button" @click="contactOpen = true"><v-icon :icon="mdiEmailOutline" size="18" /> Contact</button>
    </footer>
    <SettingsDialog v-model="settingsOpen" />
    <ContactDialog v-model="contactOpen" />
  </div>
</template>

<style scoped>
.home {
  min-height: 100dvh; width: 100%; max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column;
  padding: 0 max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
}
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; }
.topbar-actions { display: flex; gap: 8px; align-items: center; }
.brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 800; font-size: 1.25rem; letter-spacing: -0.02em; }
.brand em { font-style: normal; font-weight: 400; color: var(--accent); }

.choices { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: center; align-content: center; }
.choice {
  display: flex; flex-direction: column; gap: 6px; padding: clamp(14px, 3vw, 28px);
  color: var(--ink); text-decoration: none; border: 2px solid var(--line);
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.08s;
}
.choice:hover, .choice:focus-visible { border-color: var(--ink); box-shadow: 0 3px 0 var(--ink); }
.choice:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.choice:active { transform: translateY(1px); }
.choice h2 { display: flex; align-items: center; gap: 8px; font-size: clamp(1.6rem, 4vw, 2.4rem); margin: 6px 0 0; }
.choice p { margin: 0; color: var(--ink-2); font-size: 1.05rem; }
.mini { width: 100%; height: 96px; pointer-events: none; }

.foot { display: flex; justify-content: center; padding-top: 12px; }
.foot .bos-btn { gap: 6px; }

/* Mobile paysage : tout tient sans scroll */
@media (orientation: landscape) and (max-height: 500px) {
  .topbar { padding: 6px 0; }
  .choices { gap: 16px; }
  .choice { padding: 10px 16px; gap: 2px; }
  .mini { height: 64px; }
  .choice h2 { font-size: 1.6rem; }
  .choice p { font-size: 0.95rem; }
  .foot { padding-top: 6px; }
}
/* Portrait / étroit : une colonne */
@media (max-width: 700px) and (orientation: portrait) {
  .choices { grid-template-columns: 1fr; }
}
</style>
