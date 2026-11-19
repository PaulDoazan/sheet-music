<script setup lang="ts">
/**
 * Rendu « éditeur » d'une partition : portées alignées mesure par mesure, défilement horizontal.
 * - le dessin VexFlow ne dépend que de la partition et du thème ;
 * - sélection et lecture sont appliquées par classes CSS sur les éléments SVG (pas de redessin) ;
 * - un tap émet `select(staff, index)` : index = position d'insertion (après la note tapée).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
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
  measureBeats,
  noteBeats,
  pitchToVexKey,
  splitMeasures,
  totalBeats,
  type Note,
  type Score,
  type Staff,
} from '@/music/model'
import { LINE_SPACING } from './layout'

const props = withDefaults(
  defineProps<{
    score: Score
    /** Curseur d'insertion. */
    cursor?: { staff: number; index: number } | null
    playingIds?: string[]
    mutedStaves?: boolean[]
  }>(),
  { cursor: null, playingIds: () => [], mutedStaves: () => [] },
)
const emit = defineEmits<{ select: [staff: number, index: number] }>()

interface NoteBox {
  id: string
  staff: number
  index: number
  /** unités logiques */
  x: number
  headEnd: number
}

const scroller = ref<HTMLDivElement>()
const canvas = ref<HTMLDivElement>()
const viewH = ref(0)
const viewW = ref(0)
const scale = ref(1)
const logical = ref({ w: 0, h: 0 })
const staffMid = ref<number[]>([]) // y logique du milieu de chaque portée
const staffStartX = ref(0) // x logique de la première note possible
const boxes = ref<NoteBox[][]>([])
const theme = useTheme()

const colors = computed(() => {
  const c = theme.global.current.value.colors
  return { ink: c.ink as string, muted: c['ink-2'] as string }
})

const STAFF_H = 4 * LINE_SPACING
const GAP = 6 * LINE_SPACING // entre deux portées (lignes supplémentaires comprises)
const MARGIN_Y = 3.5 * LINE_SPACING
const LEFT = 64 // place pour les noms de voix (collés à gauche au défilement)
const MIN_SCALE = 0.5
const MAX_SCALE = 1.7

function shortName(s: Staff, i: number) {
  const name = s.name ?? `Voix ${i + 1}`
  const m = /^(\S+)(?:\s+(\d+))?$/.exec(name)
  if (!m) return name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('') // « Main droite » → MD
  const base = m[1].length > 4 ? `${m[1].slice(0, 3)}.` : m[1]
  return m[2] ? `${base} ${m[2]}` : base
}
const names = computed(() => props.score.staves.map(shortName))

/** Hauteur affichée : la clé octaviée s'écrit une octave au-dessus du son réel. */
function displayKey(n: Note, staff: Staff): string {
  const p = n.pitch!
  return pitchToVexKey({ ...p, octave: p.octave - (staff.clefOctave ?? 0) })
}
function restKey(staff: Staff) {
  return staff.clef === 'bass' ? 'd/3' : 'b/4'
}

function draw() {
  const el = canvas.value
  if (!el || viewH.value < 10) return
  el.innerHTML = ''
  const score = props.score
  const staves = score.staves
  const n = staves.length
  const pm = measureBeats(score.timeSignature)
  const tsSpec = `${score.timeSignature[0]}/${score.timeSignature[1]}`

  const tops = staves.map((_, i) => MARGIN_Y + i * (STAFF_H + GAP))
  const logicalH = MARGIN_Y * 2 + n * STAFF_H + (n - 1) * GAP
  // borné aussi par la largeur : en portrait, on garde au moins ~2 mesures visibles
  const s = Math.min(MAX_SCALE, viewW.value / 340, Math.max(MIN_SCALE, viewH.value / logicalH))
  scale.value = s
  staffMid.value = tops.map((t) => t + STAFF_H / 2)

  const split = staves.map((st) => splitMeasures(st.voices[0].notes, pm))
  const measureCount = Math.max(
    1,
    ...staves.map((st) => Math.floor(totalBeats(st.voices[0].notes) / pm + 1e-6) + 1),
  )
  const isPiano = staves.some((st) => (st.program ?? 0) < 8)

  // 1) construire notes et voix de chaque mesure, mesurer la largeur nécessaire
  type Built = { voice: VexVoice; notes: StaveNote[]; model: (Note | null)[]; beams: Beam[] }
  const measures: Built[][] = []
  const counters = staves.map(() => 0)
  for (let m = 0; m < measureCount; m++) {
    const row: Built[] = []
    staves.forEach((staff, si) => {
      const content = split[si][m] ?? []
      const notes: StaveNote[] = []
      const model: (Note | null)[] = []
      const altered = new Map<string, number>() // altérations en cours dans la mesure
      for (const note of content) {
        if (!note.pitch) {
          const r = new StaveNote({ keys: [restKey(staff)], duration: `${note.duration}r`, dots: note.dots ?? 0, clef: staff.clef })
          if (note.dots) Dot.buildAndAttach([r], { all: true })
          r.setAttribute('id', note.id)
          notes.push(r)
        } else {
          const sn = new StaveNote({
            keys: [displayKey(note, staff)],
            duration: note.duration,
            dots: note.dots ?? 0,
            clef: staff.clef,
            auto_stem: true,
          })
          const key = `${note.pitch.step}${note.pitch.octave}`
          const alter = note.pitch.alter ?? 0
          const prev = altered.get(key) ?? 0
          if (alter !== prev) sn.addModifier(new Accidental(alter === 1 ? '#' : alter === -1 ? 'b' : 'n'), 0)
          altered.set(key, alter)
          if (note.dots) Dot.buildAndAttach([sn], { all: true })
          sn.setLedgerLineStyle({ fillStyle: colors.value.ink, strokeStyle: colors.value.ink, lineWidth: 1.4 })
          sn.setAttribute('id', note.id)
          notes.push(sn)
        }
        model.push(note)
        counters[si]++
      }
      const used = content.reduce((t, x) => t + noteBeats(x), 0)
      const fillers = content.length === 0 ? [{ duration: 'w' as const, dots: 0 as const }] : fillerRests(pm - used)
      for (const f of fillers) {
        const r = new StaveNote({ keys: [restKey(staff)], duration: `${f.duration}r`, clef: staff.clef })
        r.setStyle({ fillStyle: colors.value.muted, strokeStyle: colors.value.muted })
        r.setAttribute('class', 'filler')
        if (content.length === 0) r.setCenterAlignment(true)
        notes.push(r)
        model.push(null)
      }
      const voice = new VexVoice({ num_beats: score.timeSignature[0], beat_value: score.timeSignature[1] }).setMode(
        VexVoice.Mode.SOFT,
      )
      voice.addTickables(notes)
      const groups = score.timeSignature[1] === 8 ? [new Fraction(3, 8)] : [new Fraction(1, 4)]
      const beamable = notes.filter((x, k) => model[k]?.pitch)
      const beams = beamable.length > 1 ? Beam.generateBeams(beamable, { groups }) : []
      row.push({ voice, notes, model, beams })
    })
    measures.push(row)
  }

  // 2) placer les mesures
  let x = LEFT
  const out: NoteBox[][] = staves.map(() => [])
  const drawn: { staves: Stave[]; row: Built[]; area: number }[] = []
  measures.forEach((row, m) => {
    const fmt = new Formatter()
    row.forEach((b) => fmt.joinVoices([b.voice]))
    const minW = fmt.preCalculateMinTotalWidth(row.map((b) => b.voice))
    const area = Math.max(m === measureCount - 1 && row.every((b) => b.model.every((k) => !k)) ? 70 : 60, minW * 1.35 + 24)
    const sts = staves.map((staff, si) => {
      const st = new Stave(x, tops[si], 100, { space_above_staff_ln: 0, space_below_staff_ln: 0 })
      if (m === 0) {
        st.addClef(staff.clef, 'default', staff.clefOctave === -1 ? '8vb' : undefined)
        st.addTimeSignature(tsSpec)
      }
      return st
    })
    const start = Math.max(...sts.map((st) => st.getNoteStartX()))
    sts.forEach((st) => {
      st.setNoteStartX(start)
      st.setWidth(start - x + area)
    })
    if (m === 0) staffStartX.value = start
    drawn.push({ staves: sts, row, area })
    x += start - x + area
  })
  const logicalW = x + 24
  logical.value = { w: logicalW, h: logicalH }

  // 3) dessiner
  const renderer = new Renderer(el, Renderer.Backends.SVG)
  renderer.resize(logicalW * s, logicalH * s)
  const ctx = renderer.getContext()
  const svg = el.querySelector('svg')!
  svg.setAttribute('viewBox', `0 0 ${logicalW} ${logicalH}`)
  ctx.setFillStyle(colors.value.ink)
  ctx.setStrokeStyle(colors.value.ink)

  drawn.forEach(({ staves: sts, row, area }, m) => {
    sts.forEach((st) => st.setContext(ctx).draw())
    if (n > 1) {
      if (m === 0) {
        new StaveConnector(sts[0], sts[n - 1]).setType(isPiano ? 'brace' : 'bracket').setContext(ctx).draw()
        new StaveConnector(sts[0], sts[n - 1]).setType('singleLeft').setContext(ctx).draw()
      }
      if (isPiano) new StaveConnector(sts[0], sts[n - 1]).setType('singleRight').setContext(ctx).draw()
    }
    const fmt = new Formatter()
    row.forEach((b) => fmt.joinVoices([b.voice]))
    fmt.format(
      row.map((b) => b.voice),
      area - 16,
    )
    row.forEach((b, si) => {
      b.voice.draw(ctx, sts[si])
      b.beams.forEach((beam) => beam.setContext(ctx).draw())
      b.notes.forEach((sn, k) => {
        const note = b.model[k]
        if (!note) return
        out[si].push({
          id: note.id,
          staff: si,
          index: out[si].length,
          x: (sn.getNoteHeadBeginX() + sn.getNoteHeadEndX()) / 2,
          headEnd: sn.getNoteHeadEndX(),
        })
      })
    })
  })
  boxes.value = out
  applyClasses()
}

// --- Sélection / lecture : classes sur les groupes SVG -----------------------------------
const selectedId = computed(() => {
  const c = props.cursor
  if (!c || c.index === 0) return null
  return props.score.staves[c.staff]?.voices[0].notes[c.index - 1]?.id ?? null
})
let marked: Element[] = []
function applyClasses() {
  const svg = canvas.value?.querySelector('svg')
  if (!svg) return
  marked.forEach((e) => e.classList.remove('is-selected', 'is-playing'))
  marked = []
  const mark = (id: string | null, cls: string) => {
    if (!id) return
    const g = svg.querySelector(`#vf-${CSS.escape(id)}`)
    if (g) {
      g.classList.add(cls)
      marked.push(g)
    }
  }
  props.playingIds.forEach((id) => mark(id, 'is-playing'))
  if (!props.playingIds.length) mark(selectedId.value, 'is-selected')
}

/** Position du curseur d'insertion (px dans le contenu défilant). */
const caret = computed(() => {
  const c = props.cursor
  if (!c || !boxes.value[c.staff]) return null
  const row = boxes.value[c.staff]
  const s = scale.value
  let lx: number
  if (c.index === 0) lx = staffStartX.value - 4
  else {
    const prev = row[c.index - 1]
    const next = row[c.index]
    if (!prev) return null
    lx = next ? (prev.headEnd + (next.x - 6)) / 2 + 3 : prev.headEnd + 10
  }
  const mid = staffMid.value[c.staff]
  return { x: lx * s, top: (mid - STAFF_H / 2 - 12) * s, height: (STAFF_H + 24) * s }
})

const bands = computed(() =>
  staffMid.value.map((mid, i) => ({
    i,
    top: (mid - (STAFF_H + GAP) / 2) * scale.value,
    height: (STAFF_H + GAP) * scale.value,
    nameTop: mid * scale.value,
  })),
)

// --- Interaction ------------------------------------------------------------------------
function onPointer(e: PointerEvent) {
  const el = canvas.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const lx = (e.clientX - r.left) / scale.value
  const ly = (e.clientY - r.top) / scale.value
  let staff = 0
  let best = Infinity
  staffMid.value.forEach((mid, i) => {
    if (Math.abs(mid - ly) < best) {
      best = Math.abs(mid - ly)
      staff = i
    }
  })
  const row = boxes.value[staff] ?? []
  let nearest = -1
  let nd = Infinity
  row.forEach((b, k) => {
    const d = Math.abs(b.x - lx)
    if (d < nd) {
      nd = d
      nearest = k
    }
  })
  const index = nearest >= 0 && nd < 16 ? nearest + 1 : row.filter((b) => b.x < lx).length
  emit('select', staff, index)
}

/** Fait défiler pour garder `px` visible (avec marge). */
function ensureVisible(px: number, smooth = true) {
  const sc = scroller.value
  if (!sc) return
  const margin = Math.min(120, sc.clientWidth * 0.25)
  if (px < sc.scrollLeft + margin || px > sc.scrollLeft + sc.clientWidth - margin) {
    sc.scrollTo({ left: Math.max(0, px - sc.clientWidth * 0.35), behavior: smooth ? 'smooth' : 'auto' })
  }
}

/** Position (px) d'une note par id. */
function noteX(id: string): number | null {
  for (const row of boxes.value) for (const b of row) if (b.id === id) return b.x * scale.value
  return null
}

// --- Cycle de vie -------------------------------------------------------------------------
let ro: ResizeObserver | undefined
let raf = 0
function scheduleDraw() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(draw)
}
onMounted(() => {
  ro = new ResizeObserver(([entry]) => {
    const h = Math.floor(entry.contentRect.height)
    const w = Math.floor(entry.contentRect.width)
    if (h !== viewH.value || w !== viewW.value) {
      viewH.value = h
      viewW.value = w
      scheduleDraw()
    }
  })
  ro.observe(scroller.value!)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  cancelAnimationFrame(raf)
})
watch(
  () => [props.score.staves, props.score.timeSignature, colors.value],
  () => nextTick(draw),
  { deep: true },
)
watch(() => [props.playingIds, selectedId.value], applyClasses)
watch(
  () => caret.value?.x,
  (x) => {
    if (x != null && !props.playingIds.length) ensureVisible(x)
  },
)

defineExpose({ ensureVisible, noteX })
</script>

<template>
  <div ref="scroller" class="score-view">
    <div class="content" :style="{ width: `${logical.w * scale}px`, height: `${logical.h * scale}px` }">
      <div
        v-for="b in bands"
        :key="b.i"
        class="band"
        :class="{ active: cursor?.staff === b.i, muted: mutedStaves[b.i] }"
        :style="{ top: `${b.top}px`, height: `${b.height}px` }"
      />
      <div ref="canvas" class="canvas" @pointerdown="onPointer" />
      <div
        v-if="caret && !playingIds.length"
        class="caret"
        :style="{ transform: `translateX(${caret.x}px)`, top: `${caret.top}px`, height: `${caret.height}px` }"
        aria-hidden="true"
      />
      <div class="names" aria-hidden="true">
        <span
          v-for="b in bands"
          :key="b.i"
          class="name mono"
          :class="{ active: cursor?.staff === b.i, muted: mutedStaves[b.i] }"
          :style="{ top: `${b.nameTop}px` }"
          >{{ names[b.i] }}</span
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.score-view {
  position: relative; width: 100%; height: 100%; overflow: auto;
  overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
}
.content { position: relative; min-width: 100%; }
.canvas { position: absolute; inset: 0; cursor: pointer; touch-action: pan-x pan-y; }
.canvas :deep(svg) { display: block; overflow: visible; }
.band {
  position: absolute; left: 0; right: 0; pointer-events: none;
  transition: background-color 0.15s;
}
.band.active { background: rgba(var(--v-theme-primary), 0.07); }
.band.muted { opacity: 0.4; }
.canvas :deep(.is-selected path),
.canvas :deep(.is-selected rect) { fill: var(--accent); stroke: var(--accent); }
.canvas :deep(.is-playing path),
.canvas :deep(.is-playing rect) { fill: var(--good); stroke: var(--good); }
.caret {
  position: absolute; left: -1.5px; width: 3px; border-radius: 3px; pointer-events: none;
  background: var(--accent); animation: blink 1.1s steps(1) infinite;
  transition: transform 0.12s ease-out;
}
@keyframes blink { 50% { opacity: 0.25; } }
.names { position: sticky; left: 0; top: 0; width: 0; height: 100%; z-index: 1; pointer-events: none; }
.name {
  position: absolute; left: 4px; transform: translateY(-50%); white-space: nowrap;
  font-size: 0.68rem; font-weight: 700; padding: 1px 6px; border-radius: 999px;
  background: var(--card); color: var(--ink-2); border: 1.5px solid var(--line);
}
.name.active { color: var(--accent); border-color: var(--accent); }
.name.muted { text-decoration: line-through; }
</style>
