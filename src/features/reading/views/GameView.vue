<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mdiArrowLeft } from '@mdi/js'
import { diatonicIndex, parsePitch, SOLFEGE, type Clef, type Score, type Step } from '@/music/model'
import StaffView, { type NoteStyle } from '@/music/render/StaffView.vue'
import { extentForRange, type NoteLayout } from '@/music/render/layout'
import { GAME_DURATION_MS, createReadingGame } from '../game'
import { CLEF_MODES, isClefMode, isLevel, LEVEL_SPECS, type ClefMode, type Level } from '../levels'
import TimelineBar from '../components/TimelineBar.vue'
import ScoreGauge from '../components/ScoreGauge.vue'
import NoteButtons from '../components/NoteButtons.vue'
import RotateHint from '@/components/RotateHint.vue'

const route = useRoute()
const router = useRouter()

const clefMode = computed<ClefMode>(() => (isClefMode(route.query.clef) ? route.query.clef : 'treble'))
const level = computed<Level>(() => {
  const n = Number(route.query.level)
  return isLevel(n) ? n : 1
})

const game = createReadingGame()
const { state } = game

const countdown = ref(0)
const displayedScore = ref(0)
const notesLayout = ref<Record<string, NoteLayout>>({})
const staffBox = ref<HTMLElement>()
const gauge = ref<InstanceType<typeof ScoreGauge>>()
const buttons = ref<InstanceType<typeof NoteButtons>>()

// ---------- taille de page selon l'orientation ----------
function pageSizeFor(): number {
  const w = window.innerWidth
  const h = window.innerHeight
  if (h > w) return w < 500 ? 5 : 6
  return w >= 1100 ? 10 : 8
}
function onResize() {
  game.resizePage(pageSizeFor())
}

// ---------- partition affichée ----------
const staffClefs = computed<Clef[]>(() =>
  clefMode.value === 'both' ? ['treble', 'bass'] : [clefMode.value as Clef],
)

const score = computed<Score>(() => ({
  id: 'reading',
  bpm: 60,
  timeSignature: [4, 4],
  staves: staffClefs.value.map((clef) => ({
    id: clef,
    clef,
    voices: [
      {
        id: `${clef}-v1`,
        notes: state.page.map((n) =>
          n.clef === clef
            ? { id: n.id, pitch: n.pitch, duration: 'q' as const }
            : { id: `${n.id}~${clef}`, pitch: null, duration: 'q' as const },
        ),
      },
    ],
  })),
}))

const extents = computed(() =>
  staffClefs.value.map((clef) => {
    const r = LEVEL_SPECS[level.value].ranges[clef]
    return extentForRange(clef, diatonicIndex(parsePitch(r.low)), diatonicIndex(parsePitch(r.high)))
  }),
)

const noteStyles = computed(() => {
  const out: Record<string, NoteStyle> = {}
  for (const n of state.page) if (n.status !== 'pending') out[n.id] = n.status
  return out
})
const labels = computed(() => {
  const out: Record<string, string> = {}
  for (const n of state.page) if (n.status === 'wrong') out[n.id] = SOLFEGE[n.pitch.step]
  return out
})
const cursorId = computed(() => (state.phase === 'playing' || countdown.value ? game.currentNote.value?.id : null))

// ---------- boucle de jeu ----------
let raf = 0
let timers: ReturnType<typeof setTimeout>[] = []
function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms))
}
function loop() {
  game.tick()
  if (state.phase === 'playing') raf = requestAnimationFrame(loop)
}

function startGame() {
  cancelAnimationFrame(raf)
  timers.forEach(clearTimeout)
  timers = []
  document.querySelectorAll('.flying-note').forEach((el) => el.remove())
  game.setup(clefMode.value, level.value, pageSizeFor())
  displayedScore.value = 0
  countdown.value = 3
  const step = () => {
    countdown.value--
    if (countdown.value > 0) later(step, 650)
    else {
      game.start()
      raf = requestAnimationFrame(loop)
    }
  }
  later(step, 650)
}

function onAnswer(step: Step) {
  const r = game.answer(step)
  if (!r) return
  buttons.value?.showResult(step, r.ok)
  const scoreAfter = state.score
  flyToGauge(r.note.id, r.ok, () => {
    displayedScore.value = scoreAfter
  })
  if (r.pageDone) later(() => state.phase === 'playing' && game.fillPage(), 380)
}

// ---------- micro-animation : la note vole vers la jauge ----------
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
function flyToGauge(noteId: string, ok: boolean, onArrive: () => void) {
  const l = notesLayout.value[noteId]
  const box = staffBox.value?.getBoundingClientRect()
  const target = gauge.value?.el?.getBoundingClientRect()
  if (!l || !box || !target || reduceMotion) {
    onArrive()
    return
  }
  const fromX = box.left + l.x
  const fromY = box.top + l.y
  const toX = target.left + target.width / 2
  const toY = target.top + target.height / 2
  const el = document.createElement('div')
  el.className = `flying-note ${ok ? 'ok' : 'ko'}`
  el.style.left = `${fromX}px`
  el.style.top = `${fromY}px`
  document.body.appendChild(el)
  const dx = toX - fromX
  const dy = toY - fromY
  const anim = el.animate(
    [
      { transform: 'translate(-50%, -50%) rotate(-20deg) scale(1)', opacity: 1 },
      {
        transform: `translate(calc(-50% + ${dx * 0.35}px), calc(-50% + ${dy * 0.35 - 40}px)) rotate(-20deg) scale(1.35)`,
        opacity: 1,
        offset: 0.35,
      },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(-20deg) scale(0.5)`, opacity: 0.9 },
    ],
    { duration: 520, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
  )
  anim.onfinish = () => {
    el.remove()
    onArrive()
  }
}

// ---------- fin de partie ----------
const notesPerMin = computed(() => Math.round((state.correct + state.wrong) / (GAME_DURATION_MS / 60_000)))
const modeLabel = computed(() => CLEF_MODES.find((m) => m.value === clefMode.value)?.label ?? '')
watch(
  () => state.phase,
  (p) => {
    if (p === 'finished') displayedScore.value = state.score
  },
)

function quit() {
  router.push({ name: 'menu', query: { clef: clefMode.value, level: String(level.value) } })
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  startGame()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  cancelAnimationFrame(raf)
  timers.forEach(clearTimeout)
  document.querySelectorAll('.flying-note').forEach((el) => el.remove())
})
watch([clefMode, level], startGame)
</script>

<template>
  <div class="game">
    <header class="game-head">
      <button class="bos-btn small round" type="button" aria-label="Retour au menu" @click="quit">
        <v-icon :icon="mdiArrowLeft" size="20" />
      </button>
      <TimelineBar :remaining-ms="state.remainingMs" :total-ms="GAME_DURATION_MS" />
      <ScoreGauge ref="gauge" :score="displayedScore" :target="game.target.value" />
    </header>

    <RotateHint inline />

    <section ref="staffBox" class="staff card">
      <StaffView
        :score="score"
        :note-styles="noteStyles"
        :labels="labels"
        :cursor-note-id="cursorId"
        :extents="extents"
        ghost-rests
        @layout="notesLayout = $event"
      />
      <Transition name="count">
        <div v-if="countdown > 0" :key="countdown" class="countdown mono">{{ countdown }}</div>
      </Transition>
    </section>

    <NoteButtons ref="buttons" :disabled="state.phase !== 'playing'" @answer="onAnswer" />

    <Transition name="results">
      <div v-if="state.phase === 'finished'" class="results-backdrop">
        <div class="results card" role="dialog" aria-labelledby="results-title">
          <p class="kicker">{{ modeLabel }} · niveau {{ level }}</p>
          <h2 id="results-title">Temps écoulé !</h2>
          <div class="big-score mono">{{ state.score }}</div>
          <p v-if="state.newRecord" class="record">Nouveau record !</p>
          <p v-else-if="state.bestBefore" class="best">Record : <b class="mono">{{ state.bestBefore }}</b></p>
          <ul class="stats">
            <li><b class="mono good">{{ state.correct }}</b> justes</li>
            <li><b class="mono bad">{{ state.wrong }}</b> fausses</li>
            <li><b class="mono">{{ game.accuracy.value }}%</b> précision</li>
            <li><b class="mono">{{ notesPerMin }}</b> notes/min</li>
          </ul>
          <div class="actions">
            <button class="bos-btn" type="button" @click="quit">Menu</button>
            <button class="bos-btn primary" type="button" autofocus @click="startGame">Rejouer</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.game {
  height: 100dvh; display: flex; flex-direction: column; gap: clamp(6px, 2dvh, 14px);
  padding: max(8px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
    max(10px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  max-width: 1100px; margin: 0 auto; width: 100%;
}
.game-head { display: flex; align-items: center; gap: 10px; }
.staff { position: relative; flex: 1; min-height: 0; padding: 4px 8px; overflow: hidden; }
.countdown {
  position: absolute; inset: 0; display: grid; place-items: center; font-size: clamp(3rem, 14dvh, 6rem);
  font-weight: 700; color: var(--accent); background: rgba(var(--v-theme-card), 0.6);
}
.count-enter-active { transition: transform 0.3s cubic-bezier(0.3, 0.7, 0.3, 1.4), opacity 0.3s; }
.count-leave-active { transition: opacity 0.2s; position: absolute; }
.count-enter-from { transform: scale(0.4); opacity: 0; }
.count-leave-to { opacity: 0; }

.results-backdrop {
  position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: 12px;
  background: rgba(var(--v-theme-paper), 0.7); backdrop-filter: blur(3px);
}
.results {
  width: min(560px, 100%); max-height: 100%; overflow: auto; padding: clamp(14px, 3dvh, 24px) 24px;
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px;
}
.results h2 { font-size: clamp(1.3rem, 4dvh, 1.8rem); }
.big-score { font-size: clamp(2.8rem, 14dvh, 5rem); font-weight: 700; line-height: 1; color: var(--accent); }
.record { color: var(--good); font-weight: 800; margin: 0; }
.best { color: var(--ink-2); margin: 0; }
.stats {
  list-style: none; padding: 0; margin: 8px 0 12px; display: grid; grid-template-columns: repeat(4, auto);
  gap: 6px 18px; color: var(--ink-2); font-size: 0.9rem;
}
.stats li { display: flex; flex-direction: column; align-items: center; }
.stats b { font-size: 1.3rem; color: var(--ink); }
.stats .good { color: var(--good); }
.stats .bad { color: var(--bad); }
.actions { display: flex; gap: 12px; }
.results-enter-active, .results-leave-active { transition: opacity 0.25s; }
.results-enter-active .results { transition: transform 0.35s cubic-bezier(0.3, 0.7, 0.3, 1.3); }
.results-enter-from, .results-leave-to { opacity: 0; }
.results-enter-from .results { transform: translateY(24px) scale(0.96); }

@media (max-width: 420px) {
  .stats { grid-template-columns: repeat(2, auto); }
}
</style>

<style>
/* Note volante (ajoutée au body) */
.flying-note {
  position: fixed; z-index: 60; width: 18px; height: 13px; border-radius: 50%;
  pointer-events: none; will-change: transform;
}
.flying-note.ok { background: rgb(var(--v-theme-success)); box-shadow: 0 0 0 3px rgba(var(--v-theme-success), 0.25); }
.flying-note.ko { background: rgb(var(--v-theme-error)); box-shadow: 0 0 0 3px rgba(var(--v-theme-error), 0.25); }
</style>
