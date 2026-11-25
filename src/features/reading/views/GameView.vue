<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mdiArrowLeft, mdiFlagCheckered } from '@mdi/js'
import { diatonicIndex, parsePitch, SOLFEGE, type Clef, type Step } from '@/music/model'
import ScrollingStaff, { type TapeNote } from '@/music/render/ScrollingStaff.vue'
import { extentForRange } from '@/music/render/layout'
import { createReadingGame } from '../game'
import { CLEF_MODES, isTimed, loadSettings, playedClefs, recordKey, settingsFromQuery, settingsToQuery, summary } from '../settings'
import TimelineBar from '../components/TimelineBar.vue'
import ScoreGauge from '../components/ScoreGauge.vue'
import NoteButtons from '../components/NoteButtons.vue'
import RotateHint from '@/components/RotateHint.vue'
import FullscreenToggle from '@/components/FullscreenToggle.vue'
import SoundToggle from '@/components/SoundToggle.vue'
import { playPitch, preloadPiano } from '@/music/audio/piano'
import { soundOn } from '@/music/audio/soundPref'

const route = useRoute()
const router = useRouter()

const settings = computed(() => settingsFromQuery(route.query, loadSettings()))

const game = createReadingGame()
const { state } = game

const countdown = ref(0)
const displayedScore = ref(0)
const gameNo = ref(0)
const staff = ref<InstanceType<typeof ScrollingStaff>>()
const staffBox = ref<HTMLElement>()
const gauge = ref<InstanceType<typeof ScoreGauge>>()
const buttons = ref<InstanceType<typeof NoteButtons>>()

// ---------- partition affichée ----------
const staffClefs = computed<Clef[]>(() => playedClefs(settings.value.clefMode))

const tapeNotes = computed<TapeNote[]>(() =>
  state.notes.map((n) => ({ id: n.id, clef: n.clef, pitch: n.pitch, style: n.status === 'pending' ? 'default' : n.status })),
)

const extents = computed(() =>
  staffClefs.value.map((clef) => {
    const r = settings.value.ranges[clef]
    return extentForRange(clef, diatonicIndex(parsePitch(r.low)), diatonicIndex(parsePitch(r.high)))
  }),
)

const labels = computed(() => {
  const out: Record<string, string> = {}
  const from = Math.max(0, state.cursor - 8)
  for (const n of state.notes.slice(from, state.cursor)) if (n.status === 'wrong') out[n.id] = SOLFEGE[n.pitch.step]
  return out
})

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
  game.setup(settings.value)
  gameNo.value++
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
  if (r.ok) playPitch(r.note.pitch)
  buttons.value?.showResult(step, r.ok)
  const scoreAfter = state.score
  flyToGauge(r.note.id, r.ok, () => {
    displayedScore.value = scoreAfter
  })
}

// ---------- micro-animation : la note vole vers la jauge ----------
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
function flyToGauge(noteId: string, ok: boolean, onArrive: () => void) {
  const l = staff.value?.notePosition(noteId)
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
const timed = computed(() => isTimed(state.settings))
const notesPerMin = computed(() =>
  state.elapsedMs > 0 ? Math.round((state.correct + state.wrong) / (state.elapsedMs / 60_000)) : 0,
)
const modeLabel = computed(() => CLEF_MODES.find((m) => m.value === settings.value.clefMode)?.label ?? '')
watch(
  () => state.phase,
  (p) => {
    if (p === 'finished') displayedScore.value = state.score
  },
)

function quit() {
  router.push({ name: 'read', query: settingsToQuery(settings.value) })
}

onMounted(startGame)
// échantillons chargés pendant le compte à rebours (ou dès que le son est réactivé)
watch(soundOn, (on) => on && preloadPiano(), { immediate: true })
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  timers.forEach(clearTimeout)
  document.querySelectorAll('.flying-note').forEach((el) => el.remove())
})
watch(() => recordKey(settings.value), startGame)
</script>

<template>
  <div class="game">
    <header class="game-head">
      <button class="bos-btn small round" type="button" aria-label="Retour au menu" @click="quit">
        <v-icon :icon="mdiArrowLeft" size="20" />
      </button>
      <TimelineBar v-if="timed" :remaining-ms="state.remainingMs" :total-ms="game.durationMs.value" />
      <div v-else class="free-head">
        <button
          class="bos-btn small"
          type="button"
          :disabled="state.phase !== 'playing'"
          @click="game.finish()"
        >
          <v-icon :icon="mdiFlagCheckered" size="18" /> Terminer
        </button>
      </div>
      <ScoreGauge ref="gauge" :score="displayedScore" :target="game.target.value" />
      <SoundToggle />
      <FullscreenToggle />
    </header>

    <RotateHint inline />

    <section ref="staffBox" class="staff card">
      <ScrollingStaff
        ref="staff"
        :clefs="staffClefs"
        :notes="tapeNotes"
        :cursor="state.cursor"
        :running="state.phase === 'playing'"
        :reset-key="gameNo"
        :labels="labels"
        :extents="extents"
      />
      <Transition name="count">
        <div v-if="countdown > 0" :key="countdown" class="countdown mono">{{ countdown }}</div>
      </Transition>
    </section>

    <NoteButtons ref="buttons" :disabled="state.phase !== 'playing'" @answer="onAnswer" />

    <Transition name="results">
      <div v-if="state.phase === 'finished'" class="results-backdrop">
        <div class="results card" role="dialog" aria-labelledby="results-title">
          <p class="kicker">{{ modeLabel }} · {{ summary(settings, true) }}</p>
          <h2 id="results-title">{{ timed ? 'Temps écoulé !' : 'Partie terminée' }}</h2>
          <div class="big-score mono">{{ state.score }}</div>
          <p v-if="state.newRecord" class="record">Nouveau record !</p>
          <p v-else-if="!timed" class="best">Sans limite de temps : pas de record</p>
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
.free-head { flex: 1; display: flex; justify-content: center; }
.free-head .bos-btn { gap: 6px; }
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
