<script setup lang="ts">
/**
 * Portée défilante (droite → gauche) : clés fixes, ruban de notes en mouvement, curseur accroché
 * à la note courante. La vitesse suit le rythme du joueur (voir tapeScroller).
 *
 * Deux calques : portées + clés (statique, redessiné au resize/thème) et ruban de notes (fenêtre
 * autour du curseur, redessiné à chaque réponse ; déplacé par transform à chaque frame).
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useTheme } from 'vuetify'
import {
  Barline,
  ModifierContext,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  TickContext,
  type StemmableNote,
} from 'vexflow/bravura'
import { pitchToVexKey, type Clef, type Pitch } from '@/music/model'
import { LINE_SPACING, type StaffExtent } from './layout'
import { createTapeScroller } from './tapeScroller'

export type TapeNoteStyle = 'default' | 'correct' | 'wrong'
export interface TapeNote {
  id: string
  clef: Clef
  pitch: Pitch
  style?: TapeNoteStyle
}

const props = withDefaults(
  defineProps<{
    clefs: Clef[]
    notes: TapeNote[]
    cursor: number
    /** Le ruban avance seulement quand `running` est vrai. */
    running: boolean
    /** Change à chaque nouvelle partie : replace le ruban au départ. */
    resetKey?: number
    labels?: Record<string, string>
    extents?: StaffExtent[]
    maxScale?: number
  }>(),
  { resetKey: 0, labels: () => ({}), maxScale: 2.4 },
)

const SPACING = 58 // distance entre deux notes (unités logiques)
const BEHIND = 6 // notes conservées derrière le curseur
const STAVE_GAP = 2

const root = ref<HTMLDivElement>()
const staticEl = ref<HTMLDivElement>()
const tapeEl = ref<HTMLDivElement>()
const wrapper = ref<HTMLDivElement>()
const cursorEl = ref<HTMLDivElement>()

const theme = useTheme()
const colors = computed(() => {
  const c = theme.global.current.value.colors
  return { ink: c.ink as string, good: c.success, bad: c.error }
})

// géométrie (mise à jour par drawStatic)
const geo = shallowRef({ w: 0, h: 0, scale: 1, offsetY: 0, logicalW: 0, logicalH: 0, clefEnd: 0, tops: [] as number[] })
const win = shallowRef({ start: 0, end: 0 })
/** centre local (x) et y de chaque tête de note dessinée, en unités logiques */
const heads = shallowRef<Record<string, { x: number; y: number; stemUp: boolean; index: number }>>({})

const scroller = createTapeScroller({ spacing: SPACING, targetX: SPACING * 1.4, minX: SPACING * 0.4 })
let translate = 0 // translation courante du ruban (logique)
const PAD = SPACING * 0.5

function frameOpts() {
  const { logicalW, clefEnd } = geo.value
  const room = Math.max(SPACING * 2, logicalW - clefEnd)
  return { spacing: SPACING, targetX: Math.max(SPACING * 1.3, room * 0.22), minX: SPACING * 0.35 }
}

// ---------- calque statique ----------
function drawStatic() {
  const el = staticEl.value
  const box = root.value?.getBoundingClientRect()
  if (!el || !box || box.width < 10 || box.height < 10) return false
  const w = Math.floor(box.width)
  const h = Math.floor(box.height)
  el.innerHTML = ''

  const extents = props.clefs.map((_, i) => props.extents?.[i] ?? { above: 3, below: 3 })
  const staffH = 4 * LINE_SPACING
  const tops: number[] = []
  let y = 0
  // une seule note par colonne : l'espace entre deux portées = la plus grande des deux marges
  props.clefs.forEach((_, i) => {
    y += (i === 0 ? extents[i].above : Math.max(STAVE_GAP, extents[i].above, extents[i - 1].below)) * LINE_SPACING
    tops.push(y)
    y += staffH
  })
  y += extents[extents.length - 1].below * LINE_SPACING
  const logicalH = y
  // largeur logique mini ~ 330 : au moins 4-5 notes visibles même en portrait
  const scale = Math.min(props.maxScale, h / logicalH, w / 330)
  const logicalW = w / scale
  const offsetY = (h - logicalH * scale) / 2

  const r = new Renderer(el, Renderer.Backends.SVG)
  r.resize(w, logicalH * scale)
  el.querySelector('svg')!.setAttribute('viewBox', `0 0 ${logicalW} ${logicalH}`)
  const ctx = r.getContext()
  ctx.setFillStyle(colors.value.ink)
  ctx.setStrokeStyle(colors.value.ink)
  const left = props.clefs.length > 1 ? 14 : 4
  const staves = props.clefs.map((clef, i) => {
    const st = new Stave(left, tops[i], logicalW - left - 4, { space_above_staff_ln: 0, space_below_staff_ln: 0 })
    // ruban infini : pas de barre de fin
    st.addClef(clef).setEndBarType(Barline.type.NONE).setContext(ctx)
    return st
  })
  if (staves.length > 1) {
    new StaveConnector(staves[0], staves[staves.length - 1]).setType('brace').setContext(ctx).draw()
    new StaveConnector(staves[0], staves[staves.length - 1]).setType('singleLeft').setContext(ctx).draw()
  }
  staves.forEach((st) => st.draw())
  const clefEnd = staves[0].getNoteStartX() + 6

  const first = geo.value.w === 0
  geo.value = { w, h, scale, offsetY, logicalW, logicalH, clefEnd, tops }
  if (first) scroller.reset(props.cursor)
  scroller.configure(frameOpts(), props.cursor)
  return true
}

// ---------- ruban de notes ----------
function drawTape() {
  const el = tapeEl.value
  const g = geo.value
  if (!el || !g.w) return
  el.innerHTML = ''
  const visible = Math.ceil((g.logicalW - g.clefEnd) / SPACING) + 3
  const start = Math.max(0, props.cursor - BEHIND)
  const end = Math.min(props.notes.length, props.cursor + visible)
  win.value = { start, end }
  const tapeW = (end - start) * SPACING + 2 * PAD

  const r = new Renderer(el, Renderer.Backends.SVG)
  r.resize(tapeW * g.scale, g.logicalH * g.scale)
  el.querySelector('svg')!.setAttribute('viewBox', `0 0 ${tapeW} ${g.logicalH}`)
  const ctx = r.getContext()
  ctx.setFillStyle(colors.value.ink)
  ctx.setStrokeStyle(colors.value.ink)

  const staves = props.clefs.map((clef, i) => {
    const st = new Stave(0, g.tops[i], tapeW, { space_above_staff_ln: 0, space_below_staff_ln: 0 })
    st.setContext(ctx)
    return st
  })

  const out: typeof heads.value = {}
  for (let i = start; i < end; i++) {
    const n = props.notes[i]
    const si = Math.max(0, props.clefs.indexOf(n.clef))
    const sn = new StaveNote({ clef: n.clef, keys: [pitchToVexKey(n.pitch)], duration: 'q', auto_stem: true })
    const c = n.style === 'correct' ? colors.value.good : n.style === 'wrong' ? colors.value.bad : colors.value.ink
    sn.setStyle({ fillStyle: c, strokeStyle: c })
    sn.setLedgerLineStyle({ fillStyle: c, strokeStyle: c, lineWidth: 1.4 })
    sn.setStave(staves[si])
    const mc = new ModifierContext()
    sn.addToModifierContext(mc)
    mc.preFormat()
    const tc = new TickContext()
    tc.addTickable(sn).preFormat().setX((i - start) * SPACING + PAD)
    sn.setContext(ctx).draw()
    out[n.id] = {
      x: (sn.getNoteHeadBeginX() + sn.getNoteHeadEndX()) / 2,
      y: sn.getYs()[0],
      stemUp: (sn as StemmableNote).getStemDirection() === 1,
      index: i,
    }
  }
  heads.value = out
  applyTransform()
}

/** Translation (logique) du ruban, telle que la note i soit à clefEnd + origine + xOf(i). */
function computeTranslate() {
  // note i : x local = (i - start) * S + PAD ; position voulue (relative au viewport) = ORIGIN + xOf(i)
  return SPACING * 0.5 + scroller.xOf(win.value.start) - PAD
}

function applyTransform() {
  const g = geo.value
  translate = computeTranslate()
  if (wrapper.value) wrapper.value.style.transform = `translate3d(${translate * g.scale}px, 0, 0)`
  const cur = props.notes[props.cursor]
  const head = cur && heads.value[cur.id]
  if (cursorEl.value) {
    cursorEl.value.style.opacity = head ? '1' : '0'
    if (head) cursorEl.value.style.transform = `translate3d(${(translate + head.x) * g.scale}px, 0, 0)`
  }
}

// ---------- boucle d'animation ----------
let raf = 0
let last = 0
function frame(t: number) {
  const dt = last ? Math.min(0.05, (t - last) / 1000) : 0
  last = t
  if (props.running && geo.value.w) scroller.step(dt, props.cursor)
  applyTransform()
  raf = requestAnimationFrame(frame)
}

// ---------- labels (corrections) ----------
const labelItems = computed(() => {
  const g = geo.value
  return Object.entries(props.labels)
    .map(([id, text]) => {
      const hd = heads.value[id]
      if (!hd) return null
      const dy = (hd.stemUp ? 1 : -1) * 2.6 * LINE_SPACING
      return { id, text, x: hd.x * g.scale, y: (hd.y + dy) * g.scale, fontSize: Math.max(11, 7.5 * g.scale) }
    })
    .filter((v): v is NonNullable<typeof v> => !!v)
})

/** Position (px, relative au composant) de la tête d'une note visible — pour les animations. */
function notePosition(id: string): { x: number; y: number } | null {
  const hd = heads.value[id]
  const g = geo.value
  if (!hd) return null
  return { x: g.clefEnd * g.scale + (translate + hd.x) * g.scale, y: g.offsetY + hd.y * g.scale }
}

// ---------- cycle de vie ----------
let ro: ResizeObserver | undefined
let resizeRaf = 0
function redrawAll() {
  if (drawStatic()) drawTape()
}
onMounted(() => {
  ro = new ResizeObserver(() => {
    cancelAnimationFrame(resizeRaf)
    resizeRaf = requestAnimationFrame(redrawAll)
  })
  ro.observe(root.value!)
  raf = requestAnimationFrame(frame)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  cancelAnimationFrame(raf)
  cancelAnimationFrame(resizeRaf)
})

watch(
  () => props.resetKey,
  () => {
    scroller.reset(props.cursor)
    drawTape()
  },
)
watch(
  () => props.running,
  (on) => on && scroller.start(performance.now()),
)
watch(
  () => props.cursor,
  (c, old) => {
    if (c > old) scroller.answered(performance.now())
  },
)
watch(() => props.notes, drawTape, { deep: true })
watch(() => [props.clefs, props.extents, colors.value], redrawAll, { deep: true })

defineExpose({ notePosition })
</script>

<template>
  <div ref="root" class="scrolling-staff">
    <div ref="staticEl" class="layer" :style="{ top: `${geo.offsetY}px` }" />
    <div class="viewport" :style="{ left: `${geo.clefEnd * geo.scale}px` }">
      <div
        ref="cursorEl"
        class="cursor"
        aria-hidden="true"
        :style="{
          width: `${34 * geo.scale}px`,
          marginLeft: `${-17 * geo.scale}px`,
          top: `${Math.max(0, geo.offsetY)}px`,
          height: `${Math.min(geo.h, geo.logicalH * geo.scale)}px`,
        }"
      />
      <div ref="wrapper" class="tape" :style="{ top: `${geo.offsetY}px` }">
        <div ref="tapeEl" />
        <span
          v-for="l in labelItems"
          :key="l.id"
          class="note-label mono"
          :style="{ left: `${l.x}px`, top: `${l.y}px`, fontSize: `${l.fontSize}px` }"
          >{{ l.text }}</span
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrolling-staff { position: relative; width: 100%; height: 100%; overflow: hidden; }
.layer { position: absolute; left: 0; right: 0; }
.layer :deep(svg), .tape :deep(svg) { display: block; overflow: visible; }
.viewport {
  position: absolute; top: 0; bottom: 0; right: 0; overflow: hidden;
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 28px, #000 calc(100% - 36px), transparent);
  mask-image: linear-gradient(to right, transparent 0, #000 28px, #000 calc(100% - 36px), transparent);
}
.tape { position: absolute; left: 0; will-change: transform; }
.cursor {
  position: absolute; left: 0; border-radius: 999px; pointer-events: none; will-change: transform;
  background: rgba(var(--v-theme-primary), 0.16);
  border: 2px solid rgba(var(--v-theme-primary), 0.55);
  transition: opacity 0.2s;
}
.note-label {
  position: absolute; transform: translate(-50%, -50%); padding: 1px 7px; border-radius: 999px;
  font-weight: 700; pointer-events: none; white-space: nowrap;
  background: var(--card); border: 1.5px solid currentColor; color: var(--bad);
  animation: pop 0.25s ease-out;
}
@keyframes pop { from { transform: translate(-50%, -50%) scale(0.6); opacity: 0; } }
</style>
