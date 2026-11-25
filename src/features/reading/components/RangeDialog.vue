<script setup lang="ts">
/** Modale « Notes travaillées » : tessiture par clé (mini-portées + ▲▼), saut max et durée. */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { mdiChevronDown, mdiChevronUp, mdiClose, mdiInfinity } from '@mdi/js'
import { parsePitch, SOLFEGE, type Clef, type Pitch } from '@/music/model'
import PitchPickerStaff from '@/music/render/PitchPickerStaff.vue'
import { DURATION_STEPS, durationLabel, LEAP_OPTIONS, playedClefs, type ReadingSettings } from '../settings'
import { canNudge, nudge, stepLimits, type Bound } from '../rangeEdit'

const props = defineProps<{ modelValue: boolean; settings: ReadingSettings }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; apply: [ReadingSettings] }>()

function copy(s: ReadingSettings): ReadingSettings {
  return { ...s, ranges: { treble: { ...s.ranges.treble }, bass: { ...s.ranges.bass } } }
}

// copie de travail : rien n'est appliqué avant « Valider »
const draft = ref(copy(props.settings))
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      draft.value = copy(props.settings)
      if (Number.isFinite(draft.value.duration)) lastTimed.value = draft.value.duration
    }
  },
)

// Durée : curseur à crans (30 s → 5 min) + bouton « sans limite »
const lastTimed = ref(Number.isFinite(props.settings.duration) ? props.settings.duration : 60)
const unlimited = computed(() => !Number.isFinite(draft.value.duration))
const durIndex = computed({
  get: () => Math.max(0, DURATION_STEPS.indexOf(lastTimed.value)),
  set: (i: number) => {
    lastTimed.value = DURATION_STEPS[i]
    draft.value.duration = lastTimed.value // toucher le curseur repasse en partie chronométrée
  },
})
// v-slider ne transmet ni nom ni valeur lisible à la poignée (role=slider) : on les pose nous-mêmes
const durBox = ref<HTMLElement>()
watch(
  [durBox, lastTimed],
  () => {
    const thumb = durBox.value?.querySelector('[role="slider"]')
    thumb?.setAttribute('aria-label', 'Durée de la partie')
    thumb?.setAttribute('aria-valuetext', durationLabel(lastTimed.value))
  },
  { flush: 'post' },
)
function toggleUnlimited() {
  draft.value.duration = unlimited.value ? lastTimed.value : Infinity
}

const CLEF_NAMES: Record<Clef, string> = { treble: 'Sol', bass: 'Fa' }
const BOUNDS: Bound[] = ['low', 'high']

const solfege = (p: string) => {
  const { step, octave } = parsePitch(p)
  return `${SOLFEGE[step]}${octave}`
}
function setPitch(clef: Clef, bound: Bound, p: Pitch) {
  draft.value.ranges[clef][bound] = `${p.step}${p.octave}`
}
function step(clef: Clef, bound: Bound, delta: 1 | -1) {
  draft.value.ranges[clef] = nudge(clef, draft.value.ranges[clef], bound, delta)
}

function close() {
  emit('update:modelValue', false)
}
function apply() {
  emit('apply', copy(draft.value))
  close()
}

// Mobile paysage (peu de hauteur) : plein écran
const short = ref(false)
let mq: MediaQueryList | undefined
const onMq = () => (short.value = !!mq?.matches)
onMounted(() => {
  mq = window.matchMedia('(max-height: 500px)')
  onMq()
  mq.addEventListener('change', onMq)
})
onBeforeUnmount(() => mq?.removeEventListener('change', onMq))
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    :fullscreen="short"
    :max-width="short ? undefined : 760"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="range-dialog card" :class="{ short }" role="dialog" aria-labelledby="range-title">
      <header class="head">
        <h2 id="range-title">Notes travaillées</h2>
        <button class="bos-btn small round" type="button" aria-label="Annuler" @click="close">
          <v-icon :icon="mdiClose" size="18" />
        </button>
      </header>

      <div class="grid">
        <span class="col-head" />
        <span class="kicker col col-head">plus grave</span>
        <span class="kicker col col-head">plus aiguë</span>
        <template v-for="clef in playedClefs(draft.clefMode)" :key="clef">
          <span class="clef-name">{{ CLEF_NAMES[clef] }}</span>
          <div v-for="bound in BOUNDS" :key="bound" class="pick">
            <div class="staff">
              <PitchPickerStaff
                :clef="clef"
                :pitch="parsePitch(draft.ranges[clef][bound])"
                v-bind="stepLimits(clef, draft.ranges[clef], bound)"
                @update:pitch="setPitch(clef, bound, $event)"
              />
            </div>
            <div class="arrows">
              <button
                class="bos-btn small arrow"
                type="button"
                :aria-label="`Monter la note ${bound === 'low' ? 'grave' : 'aiguë'} (${CLEF_NAMES[clef]})`"
                :disabled="!canNudge(clef, draft.ranges[clef], bound, 1)"
                @click="step(clef, bound, 1)"
              >
                <v-icon :icon="mdiChevronUp" size="18" />
              </button>
              <button
                class="bos-btn small arrow"
                type="button"
                :aria-label="`Descendre la note ${bound === 'low' ? 'grave' : 'aiguë'} (${CLEF_NAMES[clef]})`"
                :disabled="!canNudge(clef, draft.ranges[clef], bound, -1)"
                @click="step(clef, bound, -1)"
              >
                <v-icon :icon="mdiChevronDown" size="18" />
              </button>
            </div>
            <div class="val">
              <span class="kicker bound">{{ bound === 'low' ? 'grave' : 'aiguë' }}</span>
              <b class="name mono">{{ solfege(draft.ranges[clef][bound]) }}</b>
            </div>
          </div>
        </template>
      </div>

      <footer class="foot">
        <div class="options">
        <div class="leap" role="radiogroup" aria-label="Saut max">
          <span class="kicker">Saut max</span>
          <button
            v-for="o in LEAP_OPTIONS"
            :key="o.label"
            type="button"
            role="radio"
            class="chip"
            :class="{ active: draft.maxLeap === o.value }"
            :aria-checked="draft.maxLeap === o.value"
            @click="draft.maxLeap = o.value"
          >
            {{ o.label }}
          </button>
        </div>
        <div ref="durBox" class="duration" :class="{ off: unlimited }">
          <span class="kicker">Durée</span>
          <v-slider
            v-model="durIndex"
            class="dur-slider"
            :min="0"
            :max="DURATION_STEPS.length - 1"
            :step="1"
            show-ticks="always"
            tick-size="4"
            color="primary"
            track-color="line"
            density="compact"
            hide-details
          />
          <b class="dur-val mono" aria-live="polite">{{ unlimited ? '∞' : durationLabel(draft.duration) }}</b>
          <button
            type="button"
            class="chip infinite"
            :class="{ active: unlimited }"
            :aria-pressed="unlimited"
            title="Sans limite de temps : pas de record"
            @click="toggleUnlimited"
          >
            <v-icon :icon="mdiInfinity" size="18" /> Sans limite
          </button>
        </div>
        <p v-if="unlimited" class="no-record">Sans limite de temps, aucun record n'est enregistré.</p>
        </div>
        <button class="bos-btn primary validate" type="button" @click="apply">Valider</button>
      </footer>
    </div>
  </v-dialog>
</template>

<style scoped>
.range-dialog {
  display: flex; flex-direction: column; gap: 10px; padding: 14px 18px 16px; color: var(--ink);
  background: var(--card);
}
.range-dialog.short {
  height: 100%; border-radius: 0; gap: 4px;
  padding: max(6px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right))
    max(8px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
}
.head { display: flex; align-items: center; justify-content: space-between; }
.head h2 { font-size: 1.3rem; }
.short .head h2 { font-size: 1.1rem; }

.grid {
  display: grid; grid-template-columns: auto 1fr 1fr; align-items: center; gap: 4px 16px;
}
.short .grid { flex: 1; min-height: 0; grid-template-rows: auto repeat(2, minmax(0, 1fr)); }
.col { text-align: center; }
.clef-name { font-weight: 800; }
.pick { display: flex; align-items: center; gap: 8px; min-height: 0; height: 130px; }
.short .pick { height: 100%; max-height: 130px; }
.staff { flex: 1; min-width: 90px; max-width: 150px; height: 100%; }
.arrows { display: flex; flex-direction: column; gap: 6px; }
.bos-btn.arrow { min-height: 30px; width: 40px; padding: 0; }
.val { display: flex; flex-direction: column; gap: 2px; }
.bound { display: none; }
.name { min-width: 3.2em; font-size: 1.05rem; }

/* Portrait étroit (téléphone) : grave et aiguë empilées sous chaque clé, pas de scroll horizontal */
@media (max-width: 560px) {
  .range-dialog { padding: 12px 14px 14px; }
  .grid { grid-template-columns: auto minmax(0, 1fr); gap: 4px 12px; }
  .col-head { display: none; }
  .clef-name { grid-row: span 2; }
  .pick { height: 104px; }
  .staff { min-width: 0; max-width: 170px; }
  .bound { display: block; }
}

.foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.options { flex: 1 1 340px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.short .options { gap: 4px; }
.leap { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.leap .kicker { margin-right: 4px; min-width: 4.6em; }
.chip {
  min-height: 34px; padding: 0 10px; border-radius: 999px; border: 1.5px solid var(--line);
  background: var(--paper); color: var(--ink); font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer;
}
.duration { display: flex; align-items: center; gap: 4px 8px; min-width: 0; flex-wrap: wrap; }
.duration .kicker { min-width: 4.6em; }
.dur-slider { flex: 1; min-width: 120px; margin: 0 4px; }
.duration.off .dur-slider { opacity: 0.4; }
.dur-slider :deep(.v-slider-track__tick) { background-color: var(--ink-2); opacity: 0.55; }
.dur-slider :deep(.v-slider-track__tick--filled) { background-color: rgb(var(--v-theme-on-primary)); opacity: 0.9; }
.dur-val { min-width: 4.6em; text-align: right; font-size: 0.95rem; }
.duration.off .dur-val { font-size: 1.2rem; }
.chip.infinite { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.no-record { margin: 0; color: var(--ink-2); font-size: 0.85rem; }
.chip.active { border-color: var(--ink); background: var(--ink); color: var(--paper); }
.chip:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.validate { min-width: 130px; }
.short .validate { min-height: 40px; }
</style>
