<script setup lang="ts">
/**
 * Page de l'éditeur : lignes de 4 mesures empilées, toutes les portées par ligne.
 * - Toucher une zone vide d'une portée : aperçu de la note (glisser pour ajuster), posée au relâcher → `place`.
 * - Toucher un élément → `tapElement` ; glisser verticalement un élément sélectionné → `repitch`.
 * - Sélection multiple : toucher une zone vide → `tapMeasure`.
 * - Défilement : molette, gouttière de gauche (noms des voix) ou deux doigts.
 * Le dessin VexFlow ne dépend que de la partition, de la largeur et du thème ; sélection/lecture = classes CSS.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { mdiClose, mdiPlus } from '@mdi/js'
import {
  Accidental,
  Beam,
  Dot,
  Formatter,
  Fraction,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  Voice as VexVoice,
} from 'vexflow/bravura'
import {
  fillerRests,
  LINE_MEASURES,
  measureBeats,
  measureFill,
  pitchToVexKey,
  SOLFEGE,
  type Note,
  type Pitch,
  type Score,
  type Staff,
} from '@/music/model'
import { LINE_SPACING } from './layout'
import { MAX_STEP, MIN_STEP, pitchAtStep } from './pitchFromY'
import { hitElement } from './hit'

const props = withDefaults(
  defineProps<{
    score: Score
    selectedIds?: string[]
    playingIds?: string[]
    mutedStaves?: boolean[]
    multi?: boolean
  }>(),
  { selectedIds: () => [], playingIds: () => [], mutedStaves: () => [], multi: false },
)
const emit = defineEmits<{
  place: [staff: number, measure: number, index: number, pitch: Pitch]
  tapElement: [id: string]
  repitch: [id: string, pitch: Pitch]
  tapMeasure: [staff: number, measure: number]
  addLine: []
  removeLine: [line: number]
}>()

// --- géométrie (unités logiques VexFlow ; px = logique × scale) --------------------------------
const STAFF_H = 4 * LINE_SPACING
const STAFF_GAP = 6 * LINE_SPACING
const SYS_MARGIN = 4 * LINE_SPACING // au-dessus de la 1re portée / sous la dernière d'une ligne
const SYS_GAP = 2 * LINE_SPACING
const LEFT = 56 // gouttière des noms de voix
const RIGHT = 26 // bouton de suppression de ligne

interface ElemBox {
  id: string
  x: number
  y: number
}
interface MeasureBox {
  line: number
  staff: number
  measure: number
  x0: number
  x1: number
  top: number // y de la ligne du haut
  elems: ElemBox[]
  over: boolean
}

const root = ref<HTMLDivElement>()
const canvas = ref<HTMLDivElement>()
const viewW = ref(0)
const viewH = ref(0)
const scale = ref(1)
const pageH = ref(0)
const boxes = ref<MeasureBox[]>([])
const lineTops = ref<{ top: number; height: number }[]>([])
const theme = useTheme()

const colors = computed(() => {
  const c = theme.global.current.value.colors
  return { ink: c.ink as string, muted: c['ink-2'] as string }
})

const lineCount = computed(() => Math.max(1, Math.ceil((props.score.measureCount ?? LINE_MEASURES) / LINE_MEASURES)))
const systemH = computed(() => {
  const n = props.score.staves.length
  return SYS_MARGIN * 2 + n * STAFF_H + (n - 1) * STAFF_GAP
})

function shortName(s: Staff, i: number) {
  const name = s.name ?? `Voix ${i + 1}`
  const m = /^(\S+)(?:\s+(\d+))?$/.exec(name)
  if (!m) return name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('')
  const base = m[1].length > 4 ? `${m[1].slice(0, 3)}.` : m[1]
  return m[2] ? `${base} ${m[2]}` : base
}
const names = computed(() => props.score.staves.map(shortName))

const displayKey = (p: Pitch, staff: Staff) => pitchToVexKey({ ...p, octave: p.octave - (staff.clefOctave ?? 0) })
/** Ligne d'accroche des silences : la pause (ronde) pend sous la 4e ligne. */
const restKey = (staff: Staff, d: string = 'q') =>
  d === 'w' ? (staff.clef === 'bass' ? 'f/3' : 'd/5') : staff.clef === 'bass' ? 'd/3' : 'b/4'
const measuresOf = (si: number) => props.score.staves[si]?.voices[0]?.measures ?? []

function draw() {
  const el = canvas.value
  if (!el || viewW.value < 50) return
  el.innerHTML = ''
  const score = props.score
  const staves = score.staves
  const n = staves.length
  if (!n) return
  const pm = measureBeats(score.timeSignature)
  const ts = `${score.timeSignature[0]}/${score.timeSignature[1]}`
  const isPiano = staves.some((st) => (st.program ?? 0) < 8)

  // Échelle : 4 mesures lisibles en largeur, et si possible une ligne entière en hauteur (sans descendre sous 0,8).
  const s = Math.max(0.6, Math.min(1.4, viewW.value / 720, Math.max(0.8, viewH.value / systemH.value)))
  scale.value = s
  const logicalW = viewW.value / s
  const sysH = systemH.value
  const lines = lineCount.value
  const totalH = lines * sysH + (lines - 1) * SYS_GAP
  pageH.value = totalH * s

  const renderer = new Renderer(el, Renderer.Backends.SVG)
  renderer.resize(viewW.value, totalH * s)
  const ctx = renderer.getContext()
  el.querySelector('svg')!.setAttribute('viewBox', `0 0 ${logicalW} ${totalH}`)
  ctx.setFillStyle(colors.value.ink)
  ctx.setStrokeStyle(colors.value.ink)

  const out: MeasureBox[] = []
  const tops: { top: number; height: number }[] = []
  for (let line = 0; line < lines; line++) {
    const sysTop = line * (sysH + SYS_GAP)
    tops.push({ top: sysTop * s, height: sysH * s })
    const staffTops = staves.map((_, i) => sysTop + SYS_MARGIN + i * (STAFF_H + STAFF_GAP))

    // 1) éléments de chaque mesure
    type Built = { voice: VexVoice; notes: StaveNote[]; model: (Note | null)[]; beams: Beam[]; over: boolean }
    const rows: Built[][] = []
    for (let k = 0; k < LINE_MEASURES; k++) {
      const mi = line * LINE_MEASURES + k
      rows.push(
        staves.map((staff, si) => {
          const content = measuresOf(si)[mi] ?? []
          const fill = measureFill(content, pm)
          const notes: StaveNote[] = []
          const model: (Note | null)[] = []
          const altered = new Map<string, number>()
          for (const note of content) {
            let sn: StaveNote
            if (!note.pitch) {
              sn = new StaveNote({ keys: [restKey(staff, note.duration)], duration: `${note.duration}r`, dots: note.dots ?? 0, clef: staff.clef })
            } else {
              sn = new StaveNote({
                keys: [displayKey(note.pitch, staff)],
                duration: note.point ? 'q' : note.duration,
                dots: note.point ? 0 : (note.dots ?? 0),
                clef: staff.clef,
                auto_stem: true,
              })
              const key = `${note.pitch.step}${note.pitch.octave}`
              const alter = note.pitch.alter ?? 0
              if (alter !== (altered.get(key) ?? 0)) sn.addModifier(new Accidental(alter === 1 ? '#' : alter === -1 ? 'b' : 'n'), 0)
              altered.set(key, alter)
              sn.setLedgerLineStyle({ fillStyle: colors.value.ink, strokeStyle: colors.value.ink, lineWidth: 1.4 })
              if (note.point) sn.getStem()?.setVisibility(false)
            }
            if (note.dots && !note.point) Dot.buildAndAttach([sn], { all: true })
            sn.setAttribute('id', note.id)
            notes.push(sn)
            model.push(note)
          }
          const fillers =
            fill.state === 'empty' ? [{ duration: 'w' as const }] : fill.state === 'under' ? fillerRests(pm - fill.used) : []
          for (const f of fillers) {
            const r = new StaveNote({ keys: [restKey(staff, f.duration)], duration: `${f.duration}r`, clef: staff.clef })
            r.setStyle({ fillStyle: colors.value.muted, strokeStyle: colors.value.muted })
            if (fill.state === 'empty') r.setCenterAlignment(true)
            notes.push(r)
            model.push(null)
          }
          const voice = new VexVoice({ num_beats: score.timeSignature[0], beat_value: score.timeSignature[1] }).setMode(
            VexVoice.Mode.SOFT,
          )
          voice.addTickables(notes)
          const beamable = notes.filter((_, j) => model[j]?.pitch && !model[j]?.point)
          const groups = score.timeSignature[1] === 8 ? [new Fraction(3, 8)] : [new Fraction(1, 4)]
          const beams = beamable.length > 1 ? Beam.generateBeams(beamable, { groups }) : []
          return { voice, notes, model, beams, over: fill.state === 'over' }
        }),
      )
    }

    // 2) largeurs : proportionnelles au contenu, la ligne occupe toute la largeur
    const weights = rows.map((row) => {
      const f = new Formatter()
      row.forEach((b) => f.joinVoices([b.voice]))
      return Math.max(60, f.preCalculateMinTotalWidth(row.map((b) => b.voice)) * 1.25 + 20)
    })
    const probe = staves.map((staff, si) => {
      const st = new Stave(LEFT, staffTops[si], 100, { space_above_staff_ln: 0, space_below_staff_ln: 0 })
      st.addClef(staff.clef, 'default', staff.clefOctave === -1 ? '8vb' : undefined)
      if (line === 0) st.addTimeSignature(ts)
      return st
    })
    const startOffset = Math.max(...probe.map((st) => st.getNoteStartX())) - LEFT
    const usable = logicalW - LEFT - RIGHT - startOffset
    const sumW = weights.reduce((a, b) => a + b, 0)
    let x = LEFT
    rows.forEach((row, k) => {
      const area = (usable * weights[k]) / sumW
      const sts =
        k === 0
          ? probe
          : staves.map((_, si) => new Stave(x, staffTops[si], 100, { space_above_staff_ln: 0, space_below_staff_ln: 0 }))
      const start = k === 0 ? LEFT + startOffset : x
      sts.forEach((st) => {
        st.setNoteStartX(start)
        st.setWidth(start - x + area)
        st.setContext(ctx).draw()
      })
      if (n > 1) {
        if (k === 0) {
          new StaveConnector(sts[0], sts[n - 1]).setType(isPiano ? 'brace' : 'bracket').setContext(ctx).draw()
          new StaveConnector(sts[0], sts[n - 1]).setType('singleLeft').setContext(ctx).draw()
        }
        if (isPiano) new StaveConnector(sts[0], sts[n - 1]).setType('singleRight').setContext(ctx).draw()
      }
      const f = new Formatter()
      row.forEach((b) => f.joinVoices([b.voice]))
      f.format(
        row.map((b) => b.voice),
        Math.max(20, area - 18),
      )
      row.forEach((b, si) => {
        b.voice.draw(ctx, sts[si])
        b.beams.forEach((beam) => beam.setContext(ctx).draw())
        out.push({
          line,
          staff: si,
          measure: line * LINE_MEASURES + k,
          x0: x,
          x1: x + (start - x) + area,
          top: staffTops[si],
          over: b.over,
          elems: b.notes
            .map((sn, j) => {
              const note = b.model[j]
              if (!note) return null
              return {
                id: note.id,
                x: (sn.getNoteHeadBeginX() + sn.getNoteHeadEndX()) / 2,
                y: note.pitch ? sn.getYs()[0] : staffTops[si] + STAFF_H / 2,
              }
            })
            .filter((e): e is ElemBox => !!e),
        })
      })
      x += start - x + area
    })
  }
  boxes.value = out
  lineTops.value = tops
  applyClasses()
}

// --- sélection / lecture ---------------------------------------------------------------------
let marked: Element[] = []
function applyClasses() {
  const svg = canvas.value?.querySelector('svg')
  if (!svg) return
  marked.forEach((e) => e.classList.remove('is-selected', 'is-playing'))
  marked = []
  const mark = (id: string, cls: string) => {
    const g = svg.querySelector(`#vf-${CSS.escape(id)}`)
    if (g) {
      g.classList.add(cls)
      marked.push(g)
    }
  }
  if (props.playingIds.length) props.playingIds.forEach((id) => mark(id, 'is-playing'))
  else props.selectedIds.forEach((id) => mark(id, 'is-selected'))
}

const overlays = computed(() =>
  boxes.value
    .filter((b) => b.over)
    .map((b) => ({
      key: `${b.staff}-${b.measure}`,
      left: b.x0 * scale.value,
      width: (b.x1 - b.x0) * scale.value,
      top: (b.top - LINE_SPACING) * scale.value,
      height: (STAFF_H + 2 * LINE_SPACING) * scale.value,
    })),
)
const nameTags = computed(() =>
  boxes.value
    .filter((b) => b.measure % LINE_MEASURES === 0)
    .map((b) => ({
      key: `${b.line}-${b.staff}`,
      top: (b.top + STAFF_H / 2) * scale.value,
      text: names.value[b.staff],
      muted: !!props.mutedStaves[b.staff],
    })),
)

// --- geste : pose / sélection / changement de hauteur -----------------------------------------
interface Gesture {
  pointerId: number
  kind: 'place' | 'element' | 'repitch' | 'measure'
  box: MeasureBox
  id?: string
  startY: number
  lx: number
  ly: number
}
const gesture = ref<Gesture | null>(null)
const preview = ref<{ x: number; step: number; staff: number; top: number; cancelled: boolean } | null>(null)
const pointers = new Map<number, { x: number; y: number }>()
let pinchY: number | null = null

function toLogical(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  return { lx: (e.clientX - r.left) / scale.value, ly: (e.clientY - r.top) / scale.value }
}
/** Portée la plus proche verticalement, puis mesure selon x. */
function hitBox(lx: number, ly: number, onlyStaffOf?: MeasureBox): MeasureBox | null {
  let best: MeasureBox | null = null
  let bd = Infinity
  for (const b of boxes.value) {
    if (onlyStaffOf && (b.staff !== onlyStaffOf.staff || b.line !== onlyStaffOf.line)) continue
    const dy = Math.abs(b.top + STAFF_H / 2 - ly)
    const dx = lx < b.x0 ? b.x0 - lx : lx > b.x1 ? lx - b.x1 : 0
    const d = dy * 4 + dx // la ligne de portée compte d'abord
    if (d < bd) {
      bd = d
      best = b
    }
  }
  return best
}
const stepAt = (box: MeasureBox, ly: number) => Math.round((ly - box.top) / (LINE_SPACING / 2))

function onDown(e: PointerEvent) {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size > 1) {
    // deux doigts : on abandonne le geste et on fait défiler
    gesture.value = null
    preview.value = null
    pinchY = avgY()
    return
  }
  const { lx, ly } = toLogical(e)
  const box = hitBox(lx, ly)
  if (!box) return
  canvas.value!.setPointerCapture(e.pointerId)
  const hit = hitElement(box.elems, lx, ly)
  if (hit) {
    gesture.value = { pointerId: e.pointerId, kind: 'element', box, id: hit.id, startY: e.clientY, lx, ly }
  } else if (props.multi) {
    gesture.value = { pointerId: e.pointerId, kind: 'measure', box, startY: e.clientY, lx, ly }
  } else {
    gesture.value = { pointerId: e.pointerId, kind: 'place', box, startY: e.clientY, lx, ly }
    updatePreview(box, lx, ly)
  }
}
function avgY() {
  const ys = [...pointers.values()].map((p) => p.y)
  return ys.reduce((a, b) => a + b, 0) / ys.length
}
function updatePreview(box: MeasureBox, lx: number, ly: number) {
  const step = stepAt(box, ly)
  const cancelled = step < MIN_STEP - 6 || step > MAX_STEP + 6
  preview.value = {
    x: Math.max(box.x0 + 8, Math.min(box.x1 - 8, lx)),
    step: Math.max(MIN_STEP, Math.min(MAX_STEP, step)),
    staff: box.staff,
    top: box.top,
    cancelled,
  }
}
function onMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pinchY != null && pointers.size > 1) {
    const y = avgY()
    root.value?.scrollBy({ top: pinchY - y })
    pinchY = y
    return
  }
  const g = gesture.value
  if (!g || g.pointerId !== e.pointerId) return
  const { lx, ly } = toLogical(e)
  if (g.kind === 'place') {
    const box = hitBox(lx, g.box.top + STAFF_H / 2, g.box) ?? g.box // même portée, mesure selon x
    g.box = box
    updatePreview(box, lx, ly)
  } else if (g.kind === 'element' && g.id && props.selectedIds.includes(g.id) && Math.abs(e.clientY - g.startY) > 6) {
    g.kind = 'repitch'
  }
  if (g.kind === 'repitch') {
    const el = g.box.elems.find((x) => x.id === g.id)
    updatePreview(g.box, el?.x ?? lx, ly)
  }
}
function onUp(e: PointerEvent) {
  pointers.delete(e.pointerId)
  if (pointers.size === 0) pinchY = null
  const g = gesture.value
  if (!g || g.pointerId !== e.pointerId) return
  gesture.value = null
  const p = preview.value
  preview.value = null
  const staff = props.score.staves[g.box.staff]
  if (g.kind === 'element' && g.id) emit('tapElement', g.id)
  else if (g.kind === 'measure') emit('tapMeasure', g.box.staff, g.box.measure)
  else if (p && !p.cancelled) {
    const pitch = pitchAtStep(staff.clef, staff.clefOctave ?? 0, p.step)
    if (g.kind === 'place') {
      const index = g.box.elems.filter((x) => x.x < p.x).length
      emit('place', g.box.staff, g.box.measure, index, pitch)
    } else if (g.kind === 'repitch' && g.id) emit('repitch', g.id, pitch)
  }
}
function onCancel(e: PointerEvent) {
  pointers.delete(e.pointerId)
  if (gesture.value?.pointerId === e.pointerId) {
    gesture.value = null
    preview.value = null
  }
}

const previewView = computed(() => {
  const p = preview.value
  if (!p) return null
  const s = scale.value
  const staff = props.score.staves[p.staff]
  const pitch = pitchAtStep(staff.clef, staff.clefOctave ?? 0, p.step)
  const ledgers: number[] = []
  for (let k = -2; k >= p.step; k -= 2) ledgers.push(k)
  for (let k = 10; k <= p.step; k += 2) ledgers.push(k)
  return {
    x: p.x * s,
    y: (p.top + (p.step * LINE_SPACING) / 2) * s,
    ledgers: ledgers.map((k) => (p.top + (k * LINE_SPACING) / 2) * s),
    label: `${SOLFEGE[pitch.step]}${pitch.octave}`,
    cancelled: p.cancelled,
    s,
  }
})

/** Fait défiler pour montrer l'élément `id`. */
function ensureVisible(id: string) {
  const sc = root.value
  if (!sc) return
  for (const b of boxes.value) {
    const el = b.elems.find((x) => x.id === id)
    if (!el) continue
    const y0 = (b.top - 2 * LINE_SPACING) * scale.value
    const y1 = (b.top + STAFF_H + 2 * LINE_SPACING) * scale.value
    if (y0 < sc.scrollTop || y1 > sc.scrollTop + sc.clientHeight)
      sc.scrollTo({ top: Math.max(0, y0 - sc.clientHeight * 0.25), behavior: 'smooth' })
    return
  }
}
/** Mesure (index) de la note `id`, utile à l'appelant. */
function scrollToTop() {
  root.value?.scrollTo({ top: 0, behavior: 'smooth' })
}
function scrollToBottom() {
  nextTick(() => root.value?.scrollTo({ top: root.value.scrollHeight, behavior: 'smooth' }))
}

// --- cycle de vie ------------------------------------------------------------------------------
let ro: ResizeObserver | undefined
let raf = 0
function scheduleDraw() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(draw)
}
onMounted(() => {
  ro = new ResizeObserver(([entry]) => {
    const w = Math.floor(entry.contentRect.width)
    const h = Math.floor(entry.contentRect.height)
    if (w !== viewW.value || h !== viewH.value) {
      viewW.value = w
      viewH.value = h
      scheduleDraw()
    }
  })
  ro.observe(root.value!)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  cancelAnimationFrame(raf)
})
watch(
  () => [props.score.staves, props.score.timeSignature, props.score.measureCount, colors.value],
  () => nextTick(draw),
  { deep: true },
)
watch(() => [props.playingIds, props.selectedIds], applyClasses, { deep: true })

defineExpose({ ensureVisible, scrollToTop, scrollToBottom })
</script>

<template>
  <div ref="root" class="page-view">
    <div class="page" :style="{ height: `${pageH}px` }">
      <div
        v-for="o in overlays"
        :key="o.key"
        class="over"
        :style="{ left: `${o.left}px`, width: `${o.width}px`, top: `${o.top}px`, height: `${o.height}px` }"
        aria-hidden="true"
      />
      <div
        ref="canvas"
        class="canvas"
        :class="{ multi }"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onCancel"
        @lostpointercapture="onCancel"
      />
      <!-- gouttière : on peut y faire défiler au doigt -->
      <div class="gutter" :style="{ width: `${LEFT * scale}px` }">
        <span
          v-for="t in nameTags"
          :key="t.key"
          class="name mono"
          :class="{ muted: t.muted }"
          :style="{ top: `${t.top}px` }"
          >{{ t.text }}</span
        >
      </div>
      <button
        v-for="(l, i) in lineTops"
        v-show="lineTops.length > 1"
        :key="i"
        type="button"
        class="line-del"
        :style="{ top: `${l.top + 4}px` }"
        :aria-label="`Supprimer la ligne ${i + 1}`"
        :title="`Supprimer la ligne ${i + 1}`"
        @click="emit('removeLine', i)"
      >
        <v-icon :icon="mdiClose" size="16" />
      </button>
      <template v-if="previewView">
        <span
          v-for="(y, k) in previewView.ledgers"
          :key="k"
          class="pv-ledger"
          :class="{ cancelled: previewView.cancelled }"
          :style="{ left: `${previewView.x}px`, top: `${y}px`, width: `${22 * previewView.s}px` }"
        />
        <span
          class="pv-head"
          :class="{ cancelled: previewView.cancelled }"
          :style="{
            left: `${previewView.x}px`,
            top: `${previewView.y}px`,
            width: `${12 * previewView.s}px`,
            height: `${9.5 * previewView.s}px`,
          }"
        />
        <span class="pv-label mono" :class="{ cancelled: previewView.cancelled }" :style="{ left: `${previewView.x}px`, top: `${previewView.y}px` }">{{
          previewView.cancelled ? 'annulé' : previewView.label
        }}</span>
      </template>
    </div>
    <div class="add-row">
      <button type="button" class="bos-btn small add" @click="emit('addLine'); scrollToBottom()">
        <v-icon :icon="mdiPlus" size="18" /> Ajouter 4 mesures
      </button>
    </div>
  </div>
</template>

<style scoped>
.page-view {
  position: relative; width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden;
  overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
}
.page { position: relative; }
.canvas { position: absolute; inset: 0; cursor: crosshair; touch-action: none; user-select: none; -webkit-user-select: none; }
.canvas.multi { cursor: pointer; }
.canvas :deep(svg) { display: block; overflow: visible; }
.canvas :deep(.is-selected path),
.canvas :deep(.is-selected rect) { fill: var(--accent); stroke: var(--accent); }
.canvas :deep(.is-playing path),
.canvas :deep(.is-playing rect) { fill: var(--good); stroke: var(--good); }
.over { position: absolute; background: rgba(var(--v-theme-error), 0.12); border-radius: 6px; pointer-events: none; }
.gutter { position: absolute; left: 0; top: 0; bottom: 0; touch-action: pan-y; z-index: 1; }
.name {
  position: absolute; left: 2px; transform: translateY(-50%); white-space: nowrap; pointer-events: none;
  font-size: 0.66rem; font-weight: 700; padding: 1px 5px; border-radius: 999px;
  background: var(--card); color: var(--ink-2); border: 1.5px solid var(--line);
}
.name.muted { text-decoration: line-through; opacity: 0.6; }
.line-del {
  position: absolute; right: 2px; width: 26px; height: 26px; border-radius: 8px; border: 0; z-index: 1;
  background: transparent; color: var(--ink-2); display: grid; place-items: center; cursor: pointer; opacity: 0.6;
}
.line-del:hover { opacity: 1; color: var(--bad); background: var(--paper-2); }
.pv-head, .pv-ledger, .pv-label { position: absolute; pointer-events: none; z-index: 2; }
.pv-head {
  transform: translate(-50%, -50%) rotate(-20deg); border-radius: 50%; background: var(--accent);
  box-shadow: 0 0 0 4px rgba(var(--v-theme-primary), 0.18);
}
.pv-ledger { height: 1.5px; transform: translate(-50%, -50%); background: var(--accent); }
.pv-label {
  transform: translate(-50%, calc(-100% - 14px)); padding: 1px 8px; border-radius: 999px; font-size: 0.8rem; font-weight: 700;
  background: var(--accent); color: #fff; white-space: nowrap;
}
.cancelled { background: var(--ink-2) !important; box-shadow: none !important; }
.add-row { display: flex; justify-content: center; padding: 8px 0 14px; }
.add { text-decoration: none; }
</style>
