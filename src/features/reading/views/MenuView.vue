<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mdiPlay } from '@mdi/js'
import { parsePitch, type Clef, type Score } from '@/music/model'
import StaffView from '@/music/render/StaffView.vue'
import BrandMark from '@/components/BrandMark.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { CLEF_MODES, isClefMode, isLevel, LEVEL_SPECS, LEVELS, type ClefMode, type Level } from '../levels'
import { getBestScore } from '../bestScores'

const route = useRoute()
const router = useRouter()

const PREF_KEY = 'sheet-music:last-settings'
function savedPrefs(): { clef?: unknown; level?: unknown } {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}
const prefs = savedPrefs()
const qClef = route.query.clef ?? prefs.clef
const qLevel = Number(route.query.level ?? prefs.level)
const clefMode = ref<ClefMode>(isClefMode(qClef) ? qClef : 'treble')
const level = ref<Level>(isLevel(qLevel) ? qLevel : 1)

watch([clefMode, level], () => {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ clef: clefMode.value, level: level.value }))
  } catch {
    /* ignore */
  }
})

const best = computed(() => getBestScore(clefMode.value, level.value))

// Mini-portées d'illustration des cartes de clé (même composant que le jeu)
const SAMPLE: Record<Clef, string[]> = { treble: ['G4', 'B4', 'D5'], bass: ['F3', 'D3', 'B2'] }
function miniScore(mode: ClefMode): Score {
  const clefs: Clef[] = mode === 'both' ? ['treble', 'bass'] : [mode]
  return {
    id: `mini-${mode}`,
    bpm: 60,
    timeSignature: [4, 4],
    staves: clefs.map((clef) => ({
      id: clef,
      clef,
      voices: [
        {
          id: 'v',
          notes: (mode === 'both' ? SAMPLE[clef].slice(0, 2) : SAMPLE[clef]).map((p, i) => ({
            id: `${mode}-${clef}-${i}`,
            pitch: parsePitch(p),
            duration: 'q' as const,
          })),
        },
      ],
    })),
  }
}
const minis = Object.fromEntries(CLEF_MODES.map((m) => [m.value, miniScore(m.value)])) as Record<ClefMode, Score>
const miniExtents = (mode: ClefMode) =>
  mode === 'both'
    ? [
        { above: 0.8, below: 0.5 },
        { above: 0.5, below: 0.8 },
      ]
    : [{ above: 1, below: 1 }]

function play() {
  router.push({ name: 'play', query: { clef: clefMode.value, level: String(level.value) } })
}
</script>

<template>
  <div class="menu">
    <header class="topbar">
      <span class="brand"><BrandMark /><span>Sheet<em>·</em>Music</span></span>
      <ThemeToggle />
    </header>

    <main class="menu-main">
      <div class="hero">
        <h1>Lis les notes.</h1>
        <p class="lead">Deux minutes pour en nommer un maximum. Une note juste&nbsp;: +1. Une&nbsp;fausse&nbsp;:&nbsp;−1.</p>
      </div>

      <form class="settings card" @submit.prevent="play">
        <fieldset>
          <legend class="kicker">Clé</legend>
          <div class="clefs">
            <label v-for="m in CLEF_MODES" :key="m.value" class="clef-card" :class="{ active: clefMode === m.value }">
              <input v-model="clefMode" type="radio" name="clef" :value="m.value" class="sr-only" />
              <div class="mini" :class="{ tall: m.value === 'both' }">
                <StaffView :score="minis[m.value]" :extents="miniExtents(m.value)" :max-scale="1" />
              </div>
              <span>{{ m.label }}</span>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend class="kicker">Niveau</legend>
          <div class="levels">
            <label v-for="l in LEVELS" :key="l" class="level" :class="{ active: level === l }">
              <input v-model="level" type="radio" name="level" :value="l" class="sr-only" />
              <span class="mono">{{ l }}</span>
            </label>
          </div>
          <p class="level-label">{{ LEVEL_SPECS[level].label }}</p>
        </fieldset>

        <div class="play-row">
          <span class="best">Record&nbsp;: <b class="mono">{{ best || '—' }}</b></span>
          <button class="bos-btn primary play" type="submit">
            <v-icon :icon="mdiPlay" size="22" /> Jouer
          </button>
        </div>
      </form>
    </main>
  </div>
</template>

<style scoped>
.menu {
  min-height: 100dvh; max-width: 1100px; margin: 0 auto;
  padding: 0 max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
}
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; }
.brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 800; font-size: 1.25rem; letter-spacing: -0.02em; }
.brand em { font-style: normal; font-weight: 400; color: var(--accent); margin: 0 0.12em; }

.menu-main { display: grid; gap: 20px 32px; grid-template-columns: 1fr 1.25fr; align-items: center; }
.hero h1 { font-size: clamp(2.2rem, 7vw, 4.4rem); }
.lead { font-size: 1.1rem; color: var(--ink-2); max-width: 30ch; margin: 12px 0 0; }

.settings { padding: clamp(12px, 3vw, 22px); display: flex; flex-direction: column; gap: 14px; }
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
legend { margin-bottom: 8px; }
.sr-only { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

.clefs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.clef-card {
  display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer;
  border: 2px solid var(--line); border-radius: 14px; padding: 6px 6px 8px; background: var(--paper);
  font-weight: 700; font-size: 0.92rem; transition: border-color 0.15s, box-shadow 0.15s, transform 0.08s;
}
.clef-card:has(input:focus-visible) { outline: 3px solid var(--accent); outline-offset: 2px; }
.clef-card.active { border-color: var(--ink); box-shadow: 0 3px 0 var(--ink); background: var(--card); }
.clef-card.active span { color: var(--accent); }
.mini { width: 100%; height: 64px; pointer-events: none; }

.levels { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.level {
  display: grid; place-items: center; min-height: 44px; border-radius: 12px; cursor: pointer;
  border: 2px solid var(--line); background: var(--paper); font-weight: 700; font-size: 1.1rem;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.level:has(input:focus-visible) { outline: 3px solid var(--accent); outline-offset: 2px; }
.level.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.level-label { margin: 6px 0 0; color: var(--ink-2); font-size: 0.9rem; }

.play-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.best { color: var(--ink-2); }
.best b { color: var(--ink); }
.play { min-width: 150px; font-size: 1.1rem; }

/* Mobile paysage (peu de hauteur) : tout tient sans scroll */
@media (orientation: landscape) and (max-height: 500px) {
  .topbar { padding: 6px 0; }
  .hero h1 { font-size: 2.2rem; }
  .lead { font-size: 0.95rem; }
  .menu-main { gap: 12px 24px; }
  .settings { gap: 8px; padding: 12px 14px; }
  .mini { height: 46px; }
  .level { min-height: 38px; }
  .bos-btn.play { min-height: 44px; }
}
/* Portrait / étroit : une colonne */
@media (max-width: 700px) and (orientation: portrait) {
  .menu-main { grid-template-columns: 1fr; }
  .lead { max-width: none; }
}
</style>
