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
import { measureBeats, noteBeats, noteStarts, STEPS, type Score, type Step } from '@/music/model'
import ScoreView from '@/music/render/ScoreView.vue'
import NoteButtons from '@/features/reading/components/NoteButtons.vue'
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
      score.value = clone(d)
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
const view = ref<InstanceType<typeof ScoreView>>()

/** Début de la mesure du curseur (en temps). */
function cursorMeasureStart(): number {
  const notes = score.value.staves[editor.cursor.staff]?.voices[0].notes ?? []
  if (editor.cursor.index === 0) return 0
  const starts = noteStarts(notes)
  const t = starts[editor.cursor.index - 1] ?? 0
  const pm = measureBeats(score.value.timeSignature)
  return Math.floor(t / pm + 1e-6) * pm
}

let raf = 0
function loop() {
  const beat = player.currentBeat()
  if (beat == null) {
    raf = requestAnimationFrame(loop)
    return
  }
  const ids: string[] = []
  score.value.staves.forEach((st) => {
    const notes = st.voices[0].notes
    const starts = noteStarts(notes)
    for (let k = 0; k < notes.length; k++) {
      if (starts[k] > beat) break
      if (notes[k].pitch && beat < starts[k] + noteBeats(notes[k])) ids.push(notes[k].id)
    }
  })
  if (ids.join() !== playingIds.value.join()) {
    playingIds.value = ids
    const x = ids.length ? view.value?.noteX(ids[0]) : null
    if (x != null) view.value?.ensureVisible(x)
  }
  raf = requestAnimationFrame(loop)
}
async function togglePlay() {
  if (playing.value) return stopPlay()
  playing.value = true
  await player.play(score.value, { fromBeat: cursorMeasureStart(), muted: effectiveMuted.value, onEnd: stopPlay })
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
  editor.selectAfter(editor.cursor.staff, 0)
  view.value?.ensureVisible(0)
}

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
function onNote(step: Step) {
  edit(() => editor.insertNote(step))
}
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
  else if (k === 'ArrowUp') edit(() => editor.transposeSelected(e.shiftKey ? 7 : 1))
  else if (k === 'ArrowDown') edit(() => editor.transposeSelected(e.shiftKey ? -7 : -1))
  else if (k === 'Backspace' || k === 'Delete') edit(() => editor.removeSelected())
  else if (k === 'r' || k === 'R' || k === '0') edit(() => editor.insertRest())
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

const empty = computed(() => score.value.staves.every((s) => s.voices[0].notes.length === 0))
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
              @click="score.timeSignature = [...t]"
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
        <ScoreView
          ref="view"
          :score="score"
          :cursor="editor.cursor"
          :playing-ids="playingIds"
          :muted-staves="effectiveMuted"
          @select="(s, i) => editor.selectAfter(s, i)"
        />
        <p v-if="empty" class="hint">Choisis une durée puis tape les notes. Touche une portée pour changer de voix.</p>
      </template>
    </main>

    <footer class="input">
      <EditorToolbar :editor="editor" />
      <NoteButtons class="notes" :disabled="!loaded" @answer="onNote" />
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
  position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); pointer-events: none;
  background: var(--card); padding: 2px 10px; border-radius: 999px; white-space: nowrap; max-width: 95%;
  overflow: hidden; text-overflow: ellipsis; font-size: 0.8rem;
}
.input { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.notes :deep(.note-btn) { min-height: clamp(42px, 10dvh, 60px); }

@media (orientation: landscape) and (max-height: 500px) {
  .editor { gap: 6px; }
  .title { font-size: 1rem; }
  .save-state { display: none; }
  .input { flex-direction: row; align-items: center; gap: 8px; }
  .input > :first-child { flex: none; }
  .input :deep(.tool) { min-width: 31px; }
  .input :deep(.toolbar) { gap: 5px; }
  .notes { flex: 1; min-width: 0; gap: 4px; }
  .notes :deep(.note-btn) { min-height: 42px; font-size: 0.9rem; padding: 0; }
}
@media (max-width: 520px) {
  .save-state { display: none; }
  .tempo-btn { width: 26px; }
}
</style>
