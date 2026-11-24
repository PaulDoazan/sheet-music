<script setup lang="ts">
/**
 * Mini-portée de choix d'une note : clé + une ronde centrée.
 * Même geste que la pose dans PageView : au toucher, un aperçu suit le doigt en vertical,
 * la note est posée au relâcher ; loin hors portée, la pose est annulée.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { Renderer, Stave, StaveNote, TickContext } from 'vexflow/bravura'
import { pitchToVexKey, SOLFEGE, type Clef, type Pitch } from '@/music/model'
import { LINE_SPACING } from './layout'
import { MAX_STEP, MIN_STEP, pitchAtStep } from './pitchFromY'
import { ledgerSteps, resolveStep, stepAtY } from './placeGesture'
import PlacePreview from './PlacePreview.vue'

const props = defineProps<{ clef: Clef; pitch: Pitch; minStep: number; maxStep: number }>()
const emit = defineEmits<{ 'update:pitch': [Pitch] }>()

// Géométrie logique fixe (unités VexFlow) : de MIN_STEP-1 à MAX_STEP+1.
const HALF = LINE_SPACING / 2
const STAFF_TOP = (1 - MIN_STEP) * HALF
const LOGICAL_H = (MAX_STEP - MIN_STEP + 2) * HALF
const CLEF_W = 40

const root = ref<HTMLDivElement>()
const canvas = ref<HTMLDivElement>()
const size = ref({ w: 0, h: 0 })
const scale = ref(1)
/** Abscisse logique de la note (centre de la zone après la clé). */
const noteX = ref(0)
const preview = ref<{ step: number; cancelled: boolean } | null>(null)
const theme = useTheme()
const ink = computed(() => theme.global.current.value.colors.ink as string)

function draw() {
  const el = canvas.value
  const { w, h } = size.value
  if (!el || w < 10 || h < 10) return
  el.innerHTML = ''
  const s = h / LOGICAL_H
  const logicalW = w / s
  scale.value = s

  const renderer = new Renderer(el, Renderer.Backends.SVG)
  renderer.resize(w, h)
  const ctx = renderer.getContext()
  el.querySelector('svg')!.setAttribute('viewBox', `0 0 ${logicalW} ${LOGICAL_H}`)
  ctx.setFillStyle(ink.value)
  ctx.setStrokeStyle(ink.value)

  const stave = new Stave(2, STAFF_TOP, logicalW - 4, { space_above_staff_ln: 0, space_below_staff_ln: 0 })
  stave.addClef(props.clef)
  stave.setContext(ctx).draw()

  const start = stave.getNoteStartX()
  noteX.value = Math.max(start + 12, (start + Math.min(logicalW - 2, start + CLEF_W * 2)) / 2)
  const note = new StaveNote({ clef: props.clef, keys: [pitchToVexKey(props.pitch)], duration: 'w' })
  note.setStave(stave).setContext(ctx)
  note.setLedgerLineStyle({ fillStyle: ink.value, strokeStyle: ink.value, lineWidth: 1.4 })
  const tc = new TickContext()
  tc.addTickable(note).preFormat()
  // centre la tête sur noteX
  tc.setX(noteX.value - start - note.getGlyphWidth() / 2)
  note.draw()
}

// ---------- geste ----------
let pointerId: number | null = null
function stepFromEvent(e: PointerEvent) {
  const r = root.value!.getBoundingClientRect()
  const ly = (e.clientY - r.top) / scale.value
  return resolveStep(stepAtY(ly, STAFF_TOP), props.minStep, props.maxStep)
}
function onDown(e: PointerEvent) {
  if (pointerId !== null) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  pointerId = e.pointerId
  root.value!.setPointerCapture(e.pointerId)
  preview.value = stepFromEvent(e)
}
function onMove(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  preview.value = stepFromEvent(e)
}
function onUp(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  pointerId = null
  const p = preview.value
  preview.value = null
  if (p && !p.cancelled) emit('update:pitch', pitchAtStep(props.clef, 0, p.step))
}
function onCancel(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  pointerId = null
  preview.value = null
}

const previewView = computed(() => {
  const p = preview.value
  if (!p) return null
  const s = scale.value
  const pitch = pitchAtStep(props.clef, 0, p.step)
  return {
    x: noteX.value * s,
    y: (STAFF_TOP + p.step * HALF) * s,
    ledgers: ledgerSteps(p.step).map((k) => (STAFF_TOP + k * HALF) * s),
    label: `${SOLFEGE[pitch.step]}${pitch.octave}`,
    cancelled: p.cancelled,
    s,
  }
})

let ro: ResizeObserver | undefined
let raf = 0
onMounted(() => {
  ro = new ResizeObserver(([entry]) => {
    const r = entry.contentRect
    size.value = { w: Math.floor(r.width), h: Math.floor(r.height) }
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(draw)
  })
  ro.observe(root.value!)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  cancelAnimationFrame(raf)
})
watch(
  () => [props.clef, props.pitch, ink.value],
  () => nextTick(draw),
  { deep: true },
)
</script>

<template>
  <div
    ref="root"
    class="picker"
    :class="{ dragging: !!preview }"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onCancel"
    @lostpointercapture="onCancel"
  >
    <div ref="canvas" class="canvas" />
    <PlacePreview
      v-if="previewView"
      :x="previewView.x"
      :y="previewView.y"
      :ledgers="previewView.ledgers"
      :scale="previewView.s"
      :label="previewView.label"
      :cancelled="previewView.cancelled"
    />
  </div>
</template>

<style scoped>
.picker {
  position: relative; width: 100%; height: 100%; cursor: ns-resize;
  touch-action: none; user-select: none; -webkit-user-select: none;
}
.canvas { position: absolute; inset: 0; }
.canvas :deep(svg) { display: block; overflow: visible; }
/* pendant le geste, la note posée s'efface derrière l'aperçu */
.dragging .canvas :deep(.vf-stavenote) { opacity: 0.25; }
</style>
