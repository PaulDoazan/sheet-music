<script setup lang="ts">
/**
 * Rendu VexFlow d'une partition (Score) — composant générique, réutilisé par l'éditeur (brique 2).
 * - une portée par Staff, accolade si plusieurs portées ;
 * - couleur par note (noteStyles), étiquette par note (labels), curseur sur une note ;
 * - émet `layout` avec la position de chaque tête de note (pour les animations de l'appelant).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import {
  Formatter,
  GhostNote,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  Voice as VexVoice,
  type StemmableNote,
} from 'vexflow/bravura'
import { pitchToVexKey, type Score } from '@/music/model'
import { LINE_SPACING, type NoteLayout, type StaffExtent } from './layout'

export type NoteStyle = 'default' | 'correct' | 'wrong'

const props = withDefaults(
  defineProps<{
    score: Score
    noteStyles?: Record<string, NoteStyle>
    labels?: Record<string, string>
    cursorNoteId?: string | null
    /** Silences rendus invisibles (exercices : alignement des portées). */
    ghostRests?: boolean
    /** Marges par portée (en interlignes), pour une échelle stable. */
    extents?: StaffExtent[]
    maxScale?: number
  }>(),
  { noteStyles: () => ({}), labels: () => ({}), cursorNoteId: null, ghostRests: false, maxScale: 2.4 },
)

const emit = defineEmits<{ layout: [Record<string, NoteLayout>] }>()

const root = ref<HTMLDivElement>()
const canvas = ref<HTMLDivElement>()
const size = ref({ w: 0, h: 0 })
const layout = ref<Record<string, NoteLayout>>({})
const scale = ref(1)
const offsetY = ref(0)
const systemHeight = ref(0)
const theme = useTheme()

const colors = computed(() => {
  const c = theme.global.current.value.colors
  return { ink: c.ink as string, good: c.success, bad: c.error }
})

const CLEF_WIDTH = 48
const STAVE_GAP = 2 // interlignes minimum entre deux portées

function draw() {
  const el = canvas.value
  const { w, h } = size.value
  if (!el || w < 10 || h < 10) return
  el.innerHTML = ''

  const staves = props.score.staves
  const extents = staves.map((_, i) => props.extents?.[i] ?? { above: 3, below: 3 })

  // hauteur logique (unités VexFlow)
  const staffH = 4 * LINE_SPACING
  const tops: number[] = []
  let y = 0
  staves.forEach((_, i) => {
    const ext = extents[i]
    y += (i === 0 ? ext.above : Math.max(STAVE_GAP, ext.above)) * LINE_SPACING
    tops.push(y)
    y += staffH
    if (i === staves.length - 1) y += ext.below * LINE_SPACING
  })
  const logicalH = y
  const s = Math.min(props.maxScale, h / logicalH, w / 260)
  const logicalW = w / s
  scale.value = s
  offsetY.value = (h - logicalH * s) / 2
  systemHeight.value = logicalH * s

  const renderer = new Renderer(el, Renderer.Backends.SVG)
  renderer.resize(w, logicalH * s)
  const ctx = renderer.getContext()
  const svg = el.querySelector('svg')!
  svg.setAttribute('viewBox', `0 0 ${logicalW} ${logicalH}`)
  ctx.setFillStyle(colors.value.ink)
  ctx.setStrokeStyle(colors.value.ink)

  const left = staves.length > 1 ? 14 : 4
  const vexStaves = staves.map((staff, i) => {
    const st = new Stave(left, tops[i], logicalW - left - 4, { space_above_staff_ln: 0, space_below_staff_ln: 0 })
    st.addClef(staff.clef)
    st.setContext(ctx)
    return st
  })

  if (vexStaves.length > 1) {
    const first = vexStaves[0]
    const last = vexStaves[vexStaves.length - 1]
    new StaveConnector(first, last).setType('brace').setContext(ctx).draw()
    new StaveConnector(first, last).setType('singleLeft').setContext(ctx).draw()
  }
  vexStaves.forEach((st) => st.draw())

  // une Voice VexFlow par (portée, voix) — le MVP n'a qu'une voix par portée
  const pairs: { voice: VexVoice; staffIndex: number; ids: string[]; notes: (StaveNote | GhostNote)[] }[] = []
  staves.forEach((staff, si) => {
    staff.voices.forEach((voice) => {
      const notes = voice.notes.map((n) => {
        if (!n.pitch) {
          if (props.ghostRests) return new GhostNote({ duration: n.duration })
          const r = new StaveNote({ clef: staff.clef, keys: [staff.clef === 'bass' ? 'd/3' : 'b/4'], duration: `${n.duration}r` })
          return r
        }
        const sn = new StaveNote({ clef: staff.clef, keys: [pitchToVexKey(n.pitch)], duration: n.duration, auto_stem: true })
        const style = props.noteStyles[n.id]
        const c =
          style === 'correct' ? colors.value.good : style === 'wrong' ? colors.value.bad : colors.value.ink
        sn.setStyle({ fillStyle: c, strokeStyle: c })
        sn.setLedgerLineStyle({ fillStyle: c, strokeStyle: c, lineWidth: 1.4 })
        return sn
      })
      const vv = new VexVoice({ num_beats: notes.length, beat_value: 4 }).setMode(VexVoice.Mode.SOFT)
      vv.addTickables(notes)
      pairs.push({ voice: vv, staffIndex: si, ids: voice.notes.map((n) => n.id), notes })
    })
  })

  if (pairs.length) {
    const noteStart = vexStaves[0].getNoteStartX()
    const available = logicalW - noteStart - 24
    new Formatter().joinVoices(pairs.map((p) => p.voice)).format(
      pairs.map((p) => p.voice),
      Math.max(40, available),
    )
    // joinVoices n'est valable que par portée : on reformate proprement si plusieurs portées
    pairs.forEach((p) => p.voice.draw(ctx, vexStaves[p.staffIndex]))
  }

  const out: Record<string, NoteLayout> = {}
  pairs.forEach((p) => {
    p.notes.forEach((n, k) => {
      if (n instanceof GhostNote) return
      const head = n as StaveNote
      const x = (head.getNoteHeadBeginX() + head.getNoteHeadEndX()) / 2
      const ny = head.getYs()[0]
      out[p.ids[k]] = {
        x: x * s,
        y: ny * s + offsetY.value,
        staffIndex: p.staffIndex,
        stemUp: (head as StemmableNote).getStemDirection() === 1,
      }
    })
  })
  layout.value = out
  emit('layout', out)
}

const cursor = computed(() => {
  const id = props.cursorNoteId
  if (!id) return null
  const l = layout.value[id]
  if (!l) return null
  return { x: l.x }
})

const labelItems = computed(() =>
  Object.entries(props.labels)
    .map(([id, text]) => {
      const l = layout.value[id]
      if (!l) return null
      const dy = (l.stemUp ? 1 : -1) * 2.6 * LINE_SPACING * scale.value
      return { id, text, x: l.x, y: l.y + dy, style: props.noteStyles[id] ?? 'default' }
    })
    .filter((v): v is NonNullable<typeof v> => !!v),
)

let ro: ResizeObserver | undefined
let raf = 0
function scheduleDraw() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(draw)
}
onMounted(() => {
  ro = new ResizeObserver(([entry]) => {
    const r = entry.contentRect
    size.value = { w: Math.floor(r.width), h: Math.floor(r.height) }
    scheduleDraw()
  })
  ro.observe(root.value!)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  cancelAnimationFrame(raf)
})
watch(
  () => [props.score, props.noteStyles, props.extents, colors.value],
  () => nextTick(draw),
  { deep: true },
)

defineExpose({ layout, scale })
</script>

<template>
  <div ref="root" class="staff-view">
    <div
      v-if="cursor"
      class="cursor"
      :style="{
        transform: `translateX(${cursor.x}px)`,
        width: `${34 * scale}px`,
        marginLeft: `${-17 * scale}px`,
        top: `${Math.max(0, offsetY)}px`,
        height: `${Math.min(size.h, systemHeight)}px`,
      }"
      aria-hidden="true"
    />
    <div ref="canvas" class="canvas" :style="{ top: `${offsetY}px` }" />
    <span
      v-for="l in labelItems"
      :key="l.id"
      class="note-label mono"
      :class="l.style"
      :style="{ left: `${l.x}px`, top: `${l.y}px`, fontSize: `${Math.max(11, 7.5 * scale)}px` }"
      >{{ l.text }}</span
    >
  </div>
</template>

<style scoped>
.staff-view { position: relative; width: 100%; height: 100%; overflow: hidden; }
.canvas { position: absolute; left: 0; right: 0; }
.canvas :deep(svg) { display: block; overflow: visible; }
.cursor {
  position: absolute; left: 0; border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.16);
  border: 2px solid rgba(var(--v-theme-primary), 0.55);
  transition: transform 0.22s cubic-bezier(0.3, 0.7, 0.3, 1);
  pointer-events: none;
}
.note-label {
  position: absolute; transform: translate(-50%, -50%); padding: 1px 7px; border-radius: 999px;
  font-weight: 700; pointer-events: none; white-space: nowrap;
  background: var(--card); border: 1.5px solid currentColor; color: var(--ink-2);
  animation: pop 0.25s ease-out;
}
.note-label.wrong { color: var(--bad); }
.note-label.correct { color: var(--good); }
@keyframes pop { from { transform: translate(-50%, -50%) scale(0.6); opacity: 0; } }
</style>
