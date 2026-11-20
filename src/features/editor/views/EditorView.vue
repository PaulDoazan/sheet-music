<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  mdiArrowLeft,
  mdiDownload,
  mdiMinus,
  mdiPlay,
  mdiPlus,
  mdiSkipPrevious,
  mdiStop,
  mdiTune,
  mdiVolumeHigh,
  mdiVolumeOff,
  mdiHeadphones,
} from '@mdi/js'
import { measureBeats, migrateScore, noteBeats, STEPS, timeline, type Pitch, type Score, type Step } from '@/music/model'
import PageView from '@/music/render/PageView.vue'
import FullscreenToggle from '@/components/FullscreenToggle.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import RotateHint from '@/components/RotateHint.vue'
import { createPlayer } from '@/music/audio/player'
import { downloadMidi } from '@/music/midi/exportMidi'
import EditorToolbar from '../components/EditorToolbar.vue'
import { createScoreEditor } from '../editor'
import { useSaveScore, useScore } from '../queries'

/** Copie profonde (structuredClone refuse les proxys réactifs). */
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

const route = useRoute()
const id = computed(() => String(route.params.id))
const { data, isError } = useScore(id)
const save = useSaveScore()

// Copie de travail : l'éditeur la modifie, la sauvegarde part en différé.
const score = ref<Score>({ id: '', bpm: 80, timeSignature: [4, 4], staves: [] })
const loaded = ref(false)
watch(
  data,
  (d) => {
    if (d && !loaded.value) {
      score.value = migrateScore(clone(d)) // partitions v1 : converties en mesures
      loaded.value = true
    }
  },
  { immediate: true },
)

const editor = createScoreEditor(score)

let saveTimer: ReturnType<typeof setTimeout> | undefined
const saving = ref<'idle' | 'pending' | 'saved'>('idle')
function flushSave() {
  clearTimeout(saveTimer)
  if (!loaded.value || saving.value !== 'pending') return
  save.mutate(clone(score.value), { onSuccess: () => (saving.value = 'saved') })
}
watch(
  score,
  () => {
    if (!loaded.value) return
    saving.value = 'pending'
    clearTimeout(saveTimer)
    saveTimer = setTimeout(flushSave, 600)
  },
  { deep: true },
)

// --- Lecture --------------------------------------------------------------------------------
const player = createPlayer()
const playing = ref(false)
const playingIds = shallowRef<string[]>([])
const muted = ref<boolean[]>([])
const solo = ref<number | null>(null)
const effectiveMuted = computed(() =>
  score.value.staves.map((_, i) => (solo.value != null ? solo.value !== i : !!muted.value[i])),
)
watch(effectiveMuted, (m) => m.forEach((v, i) => player.setMuted(i, v)))
const view = ref<InstanceType<typeof PageView>>()

/** Début de la mesure de l'élément sélectionné (en temps), sinon 0. */
function startBeat(): number {
  const p = editor.primary.value
  return p ? p.measure * measureBeats(score.value.timeSignature) : 0
}

let raf = 0
let events: ReturnType<typeof timeline> = []
function loop() {
  const beat = player.currentBeat()
  if (beat == null) {
    raf = requestAnimationFrame(loop)
    return
  }
  const ids = events
    .filter((e) => e.note.pitch && e.start <= beat && beat < e.start + noteBeats(e.note))
    .map((e) => e.note.id)
  if (ids.join() !== playingIds.value.join()) {
    playingIds.value = ids
    if (ids.length) view.value?.ensureVisible(ids[0])
  }
  raf = requestAnimationFrame(loop)
}
async function togglePlay() {
  if (playing.value) return stopPlay()
  playing.value = true
  events = timeline(score.value)
  await player.play(score.value, { fromBeat: startBeat(), muted: effectiveMuted.value, onEnd: stopPlay })
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(loop)
}
function stopPlay() {
  player.stop()
  cancelAnimationFrame(raf)
  playing.value = false
  playingIds.value = []
}
function toStart() {
  editor.clearSelection()
  view.value?.scrollToTop()
}

// Toute modification de la partition (outils, clavier, annuler, chiffrage) arrête l'écoute.
watch(
  () => [score.value.staves, score.value.timeSignature, score.value.measureCount],
  () => {
    if (playing.value) stopPlay()
  },
  { deep: true },
)

// --- Tempo -----------------------------------------------------------------------------------
function setBpm(v: number) {
  const bpm = Math.max(40, Math.min(208, Math.round(v)))
  score.value.bpm = bpm
  player.setBpm(bpm)
}

// --- Chiffrage ---------------------------------------------------------------------------------
const TIME_SIGNATURES: [number, number][] = [
  [4, 4],
  [3, 4],
  [2, 4],
  [6, 8],
]
const tsKey = (t: [number, number]) => `${t[0]}/${t[1]}`

// --- Saisie (boutons + clavier) --------------------------------------------------------------
function edit<T>(fn: () => T): T {
  if (playing.value) stopPlay()
  return fn()
}
// --- Gestes sur la page ------------------------------------------------------------------------
function onPlace(staff: number, measure: number, index: number, pitch: Pitch) {
  edit(() => editor.placePoint(staff, measure, index, pitch))
}
function onRemoveLine(line: number) {
  const from = line * 4
  const hasContent = score.value.staves.some((st) =>
    (st.voices[0].measures ?? []).slice(from, from + 4).some((m) => m.length > 0),
  )
  if (hasContent && !window.confirm(`Supprimer la ligne ${line + 1} et ses notes ?`)) return
  edit(() => editor.removeLine(line))
}
// la vue suit l'élément principal (enchaînement des durées, flèches)
watch(
  () => editor.selectedIds.value[0],
  (id) => {
    if (id && !playing.value) view.value?.ensureVisible(id)
  },
)
const DURATION_KEYS: Record<string, 'w' | 'h' | 'q' | '8' | '16'> = { w: 'w', h: 'h', q: 'q', i: '8', s: '16' }
function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
  const mod = e.metaKey || e.ctrlKey
  const k = e.key
  let handled = true
  if (mod && k.toLowerCase() === 'z') e.shiftKey ? editor.redo() : editor.undo()
  else if (mod && k.toLowerCase() === 'y') editor.redo()
  else if (mod) handled = false
  else if (k === ' ') togglePlay()
  else if (k === 'ArrowLeft') editor.move(-1)
  else if (k === 'ArrowRight') editor.move(1)
  else if (k === 'ArrowUp' && e.altKey) editor.moveStaff(-1)
  else if (k === 'ArrowDown' && e.altKey) editor.moveStaff(1)
  else if (k === 'ArrowUp') edit(() => editor.transpose(e.shiftKey ? 7 : 1))
  else if (k === 'ArrowDown') edit(() => editor.transpose(e.shiftKey ? -7 : -1))
  else if (k === 'Backspace' || k === 'Delete') edit(() => editor.removeSelected())
  else if (k === 'Escape') editor.clearSelection()
  else if (k === 'r' || k === 'R') edit(() => editor.toRest())
  else if (/^[a-g1-7]$/i.test(k) && !(DURATION_KEYS[k.toLowerCase()] && !STEPS.includes(k.toUpperCase() as Step))) {
    const step = /^[1-7]$/.test(k) ? STEPS[Number(k) - 1] : (k.toUpperCase() as Step)
    edit(() => editor.insertPointAfterSelection(step))
  }
  else if (k === '.') editor.toggleDot()
  else if (k === '+') edit(() => editor.setAlter(1))
  else if (k === '-') edit(() => editor.setAlter(-1))
  else if (DURATION_KEYS[k.toLowerCase()] && !STEPS.includes(k.toUpperCase() as Step))
    editor.setDuration(DURATION_KEYS[k.toLowerCase()])
  else handled = false
  if (handled) e.preventDefault()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  stopPlay()
  flushSave()
})

const empty = computed(() => score.value.staves.every((s) => (s.voices[0].measures ?? []).every((m) => !m.length)))
</script>

<template>
  <div class="editor">
    <header class="bar">
      <router-link :to="{ name: 'scores' }" class="bos-btn small round" aria-label="Mes partitions" title="Mes partitions">
        <v-icon :icon="mdiArrowLeft" size="22" />
      </router-link>
      <input
        v-model="score.title"
        class="title"
        aria-label="Titre de la partition"
        placeholder="Sans titre"
        maxlength="80"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
      <span class="save-state mono" :class="saving" aria-live="polite">{{
        saving === 'pending' ? '…' : saving === 'saved' ? 'enregistré' : ''
      }}</span>

      <div class="tempo" role="group" aria-label="Tempo">
        <button class="tempo-btn" type="button" aria-label="Ralentir" @click="setBpm(score.bpm - 4)">
          <v-icon :icon="mdiMinus" size="16" />
        </button>
        <v-menu location="bottom" :close-on-content-click="false">
          <template #activator="{ props: p }">
            <button v-bind="p" class="tempo-value mono" type="button" title="Tempo (BPM)">
              ♩=<b>{{ score.bpm }}</b>
            </button>
          </template>
          <div class="card menu-card tempo-menu">
            <p class="kicker">Tempo · {{ score.bpm }} BPM</p>
            <v-slider
              :model-value="score.bpm"
              :min="40"
              :max="208"
              :step="1"
              color="primary"
              hide-details
              @update:model-value="setBpm"
            />
          </div>
        </v-menu>
        <button class="tempo-btn" type="button" aria-label="Accélérer" @click="setBpm(score.bpm + 4)">
          <v-icon :icon="mdiPlus" size="16" />
        </button>
      </div>

      <button class="bos-btn small round" type="button" title="Revenir au début" aria-label="Revenir au début" @click="toStart">
        <v-icon :icon="mdiSkipPrevious" size="22" />
      </button>
      <button
        class="bos-btn small round primary"
        type="button"
        :title="playing ? 'Arrêter (espace)' : 'Écouter depuis la mesure du curseur (espace)'"
        :aria-label="playing ? 'Arrêter' : 'Écouter'"
        @click="togglePlay"
      >
        <v-icon :icon="playing ? mdiStop : mdiPlay" size="22" />
      </button>

      <v-menu location="bottom end" :close-on-content-click="false">
        <template #activator="{ props: p }">
          <button v-bind="p" class="bos-btn small round" type="button" title="Voix, mesure, export" aria-label="Réglages">
            <v-icon :icon="mdiTune" size="20" />
          </button>
        </template>
        <div class="card menu-card settings">
          <p class="kicker">Voix</p>
          <ul class="voices">
            <li v-for="(st, i) in score.staves" :key="st.id">
              <span class="voice-name">{{ st.name ?? `Voix ${i + 1}` }}</span>
              <button
                type="button"
                class="icon-toggle"
                :class="{ on: solo === i }"
                :aria-pressed="solo === i"
                :title="`Solo ${st.name ?? ''}`"
                @click="solo = solo === i ? null : i"
              >
                <v-icon :icon="mdiHeadphones" size="18" />
              </button>
              <button
                type="button"
                class="icon-toggle"
                :class="{ on: muted[i] }"
                :aria-pressed="!!muted[i]"
                :title="`Muet ${st.name ?? ''}`"
                @click="muted[i] = !muted[i]"
              >
                <v-icon :icon="muted[i] ? mdiVolumeOff : mdiVolumeHigh" size="18" />
              </button>
            </li>
          </ul>
          <p class="kicker">Mesure</p>
          <div class="ts">
            <button
              v-for="t in TIME_SIGNATURES"
              :key="tsKey(t)"
              type="button"
              class="ts-btn mono"
              :class="{ on: tsKey(t) === tsKey(score.timeSignature) }"
              @click="editor.setTimeSignature(t)"
            >
              {{ tsKey(t) }}
            </button>
          </div>
          <button class="bos-btn small export" type="button" @click="downloadMidi(score)">
            <v-icon :icon="mdiDownload" size="18" /> Exporter en MIDI
          </button>
          <div class="settings-foot"><FullscreenToggle /><ThemeToggle /></div>
        </div>
      </v-menu>
    </header>

    <RotateHint inline />

    <main class="sheet card">
      <p v-if="isError" class="state">Partition introuvable. <router-link :to="{ name: 'scores' }">Mes partitions</router-link></p>
      <template v-else-if="loaded">
        <PageView
          ref="view"
          :score="score"
          :selected-ids="editor.selectedIds.value"
          :playing-ids="playingIds"
          :muted-staves="effectiveMuted"
          :multi="editor.multi.value"
          @place="onPlace"
          @tap-element="(id) => editor.tapElement(id)"
          @tap-measure="(st, m) => editor.selectMeasure(st, m)"
          @repitch="(id, p) => edit(() => editor.setPitch(id, p))"
          @add-line="edit(() => editor.addLine())"
          @remove-line="onRemoveLine"
        />
        <p v-if="empty" class="hint">Touche la portée pour poser une note, puis choisis son rythme.</p>
      </template>
    </main>

    <footer class="input">
      <EditorToolbar :editor="editor" />
    </footer>
  </div>
</template>

<style scoped>
.editor {
  height: 100dvh; display: flex; flex-direction: column; gap: 8px;
  padding: max(8px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom))
    max(12px, env(safe-area-inset-left));
  width: 100%; max-width: 1400px; margin: 0 auto; box-sizing: border-box; overflow: hidden;
}
.editor > * { min-width: 0; }
.bar { display: flex; align-items: center; gap: 8px; min-width: 0; }
.bar a.bos-btn { text-decoration: none; }
.title {
  flex: 1; min-width: 60px; font: inherit; font-weight: 800; font-size: 1.15rem; letter-spacing: -0.02em;
  color: var(--ink); background: transparent; border: 0; border-bottom: 2px dashed transparent;
  padding: 4px 2px; outline: none; text-overflow: ellipsis;
}
.title:hover, .title:focus { border-bottom-color: var(--line); }
.save-state { font-size: 0.7rem; color: var(--ink-2); min-width: 5.5em; }
.tempo {
  display: flex; align-items: center; border: 2px solid var(--ink); border-radius: 11px; background: var(--card);
  box-shadow: 0 3px 0 var(--ink); height: 36px; flex: none;
}
.tempo-btn, .tempo-value {
  border: 0; background: transparent; color: var(--ink); height: 100%; cursor: pointer; font: inherit;
  touch-action: manipulation;
}
.tempo-btn { width: 30px; display: grid; place-items: center; }
.tempo-value { padding: 0 4px; font-size: 0.85rem; }
.menu-card { padding: 12px 14px; min-width: 240px; display: flex; flex-direction: column; gap: 8px; }
.tempo-menu { min-width: 260px; }
.voices { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.voices li { display: flex; align-items: center; gap: 4px; }
.voice-name { flex: 1; font-weight: 600; }
.icon-toggle {
  width: 34px; height: 34px; border-radius: 9px; border: 0; background: transparent; color: var(--ink-2);
  display: grid; place-items: center; cursor: pointer;
}
.icon-toggle.on { background: var(--ink); color: var(--paper); }
.ts { display: flex; gap: 6px; }
.ts-btn {
  flex: 1; height: 34px; border-radius: 9px; border: 2px solid var(--line); background: var(--paper);
  color: var(--ink); font-weight: 700; cursor: pointer;
}
.ts-btn.on { border-color: var(--ink); background: var(--ink); color: var(--paper); }
.export { margin-top: 4px; }
.settings-foot { display: flex; gap: 8px; justify-content: flex-end; }

.sheet { flex: 1; min-height: 0; position: relative; overflow: hidden; padding: 4px 0; }
.state, .hint { margin: 0; color: var(--ink-2); font-size: 0.9rem; }
.state { padding: 20px; }
.hint {
  position: absolute; left: 50%; top: 6px; transform: translateX(-50%); pointer-events: none;
  background: var(--card); padding: 2px 10px; border-radius: 999px; white-space: nowrap; max-width: 95%;
  overflow: hidden; text-overflow: ellipsis; font-size: 0.8rem;
}
.input { display: flex; justify-content: center; min-width: 0; }

@media (orientation: landscape) and (max-height: 500px) {
  .editor { gap: 6px; }
  .title { font-size: 1rem; }
  .save-state { display: none; }
}
@media (max-width: 520px) {
  .save-state { display: none; }
  .tempo-btn { width: 26px; }
}
</style>
