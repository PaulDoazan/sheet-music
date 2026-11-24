<script setup lang="ts">
/** Modale « Notes travaillées » : tessiture par clé (mini-portées + ▲▼) et saut max. */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { mdiChevronDown, mdiChevronUp, mdiClose } from '@mdi/js'
import { parsePitch, SOLFEGE, type Clef, type Pitch } from '@/music/model'
import PitchPickerStaff from '@/music/render/PitchPickerStaff.vue'
import { LEAP_OPTIONS, playedClefs, type ReadingSettings } from '../settings'
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
    if (open) draft.value = copy(props.settings)
  },
)

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
.leap { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.leap .kicker { margin-right: 4px; }
.chip {
  min-height: 34px; padding: 0 10px; border-radius: 999px; border: 1.5px solid var(--line);
  background: var(--paper); color: var(--ink); font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer;
}
.chip.active { border-color: var(--ink); background: var(--ink); color: var(--paper); }
.chip:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.validate { min-width: 130px; }
.short .validate { min-height: 40px; }
</style>
