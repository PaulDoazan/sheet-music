import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { parsePitch, pitchToVexKey } from '@/music/model'
import { createScore } from './templates'
import { createScoreEditor, nearestIndex } from './editor'

function setup(t: Parameters<typeof createScore>[0] = 'satb') {
  const score = ref(createScore(t))
  const ed = createScoreEditor(score)
  const m = (si = 0) => score.value.staves[si].voices[0].measures!
  const desc = (si = 0) =>
    m(si).map((ms) => ms.map((n) => (n.pitch ? pitchToVexKey(n.pitch) : 'r') + (n.point ? '•' : n.duration + (n.dots ? '.' : ''))))
  return { score, ed, m, desc }
}

describe('éditeur v2', () => {
  it('nouvelle partition : 4 mesures vides par voix', () => {
    const { score, m } = setup()
    expect(score.value.measureCount).toBe(4)
    expect(m(3)).toEqual([[], [], [], []])
  })

  it('poser un point le sélectionne seul', () => {
    const { ed, desc } = setup()
    const a = ed.placePoint(0, 0, 0, parsePitch('G4'))
    const b = ed.placePoint(0, 0, 0, parsePitch('E4')) // inséré avant
    expect(desc()[0]).toEqual(['e/4•', 'g/4•'])
    expect(ed.selectedIds.value).toEqual([b.id])
    expect(a.point).toBe(true)
  })

  it('enchaîne les durées de point en point, à travers les mesures', () => {
    const { ed, desc } = setup()
    const p1 = ed.placePoint(0, 0, 0, parsePitch('C5'))
    const p2 = ed.placePoint(0, 0, 1, parsePitch('D5'))
    const p3 = ed.placePoint(0, 1, 0, parsePitch('E5'))
    ed.tapElement(p1.id)
    ed.setDuration('h')
    expect(ed.selectedIds.value).toEqual([p2.id])
    ed.setDuration('h')
    expect(ed.selectedIds.value).toEqual([p3.id])
    ed.setDuration('h')
    expect(ed.selectedIds.value).toEqual([p3.id])
    expect(desc().slice(0, 2)).toEqual([['c/5h', 'd/5h'], ['e/5h']])
  })

  it('sélection multiple : applique à tous, sans enchaîner', () => {
    const { ed, desc } = setup()
    const a = ed.placePoint(0, 0, 0, parsePitch('C5'))
    const b = ed.placePoint(0, 0, 1, parsePitch('D5'))
    ed.placePoint(0, 0, 2, parsePitch('E5'))
    ed.clearSelection() // activer la sélection multiple garde la sélection courante
    ed.multi.value = true
    ed.tapElement(a.id)
    ed.tapElement(b.id)
    expect([...ed.selectedIds.value].sort()).toEqual([a.id, b.id].sort())
    ed.setDuration('8')
    expect(desc()[0]).toEqual(['c/58', 'd/58', 'e/5•'])
    expect(ed.selectedIds.value.length).toBe(2)
  })

  it('sélectionner une mesure entière', () => {
    const { ed } = setup()
    ed.placePoint(1, 2, 0, parsePitch('A4'))
    ed.placePoint(1, 2, 1, parsePitch('B4'))
    ed.selectMeasure(1, 2)
    expect(ed.selectedIds.value.length).toBe(2)
  })

  it('silence, suppression puis sélection du précédent', () => {
    const { ed, desc } = setup()
    const a = ed.placePoint(0, 0, 0, parsePitch('C5'))
    ed.placePoint(0, 0, 1, parsePitch('D5'))
    ed.toRest()
    expect(desc()[0]).toEqual(['c/5•', 'rq'])
    ed.removeSelected()
    expect(desc()[0]).toEqual(['c/5•'])
    expect(ed.selectedIds.value).toEqual([a.id])
  })

  it('lignes : ajouter, retirer, annuler', () => {
    const { ed, score, m } = setup()
    ed.addLine()
    expect(score.value.measureCount).toBe(8)
    expect(m(2).length).toBe(8)
    ed.removeLine(1)
    expect(score.value.measureCount).toBe(4)
    ed.undo()
    expect(score.value.measureCount).toBe(8)
    expect(m(0).length).toBe(8)
  })

  it('retirer une ligne enlève de la sélection ses éléments', () => {
    const { ed } = setup()
    ed.addLine()
    ed.placePoint(0, 5, 0, parsePitch('C5'))
    ed.removeLine(1)
    expect(ed.selectedIds.value).toEqual([])
  })

  it('changer la mesure garde le contenu', () => {
    const { ed, desc, score } = setup()
    ed.placePoint(0, 0, 0, parsePitch('C5'))
    ed.setDuration('w')
    ed.setTimeSignature([3, 4])
    expect(score.value.timeSignature).toEqual([3, 4])
    expect(desc()[0]).toEqual(['c/5w'])
    ed.undo()
    expect(score.value.timeSignature).toEqual([4, 4])
  })

  it('clavier : point après la sélection, octave la plus proche', () => {
    expect(nearestIndex('C', 4 * 7 + 6)).toBe(5 * 7)
    const { ed, desc } = setup()
    ed.placePoint(0, 0, 0, parsePitch('B4'))
    ed.insertPointAfterSelection('C')
    expect(desc()[0]).toEqual(['b/4•', 'c/5•'])
    ed.clearSelection()
    ed.insertPointAfterSelection('D') // sans sélection : début de la 1re portée, autour de la ligne du milieu
    expect(desc()[0][0]).toBe('d/5•')
  })

  it('transpose, altère, change la hauteur', () => {
    const { ed, desc } = setup()
    const a = ed.placePoint(0, 0, 0, parsePitch('C5'))
    ed.transpose(7)
    ed.setAlter(1)
    expect(desc()[0]).toEqual(['c#/6•'])
    ed.setPitch(a.id, parsePitch('A4'))
    expect(desc()[0]).toEqual(['a/4•'])
  })

  it('flèches : élément précédent/suivant et portée voisine', () => {
    const { ed } = setup()
    const a = ed.placePoint(0, 0, 0, parsePitch('C5'))
    const b = ed.placePoint(0, 1, 0, parsePitch('D5'))
    const t = ed.placePoint(1, 1, 0, parsePitch('A4'))
    ed.tapElement(a.id)
    ed.move(1)
    expect(ed.selectedIds.value).toEqual([b.id])
    ed.moveStaff(1)
    expect(ed.selectedIds.value).toEqual([t.id])
  })
})

describe('revue finale', () => {
  it('le point (note pointée) ne vaut que pour une note pendant l’enchaînement', () => {
    const { ed, desc } = setup()
    const a = ed.placePoint(0, 0, 0, parsePitch('C5'))
    ed.placePoint(0, 0, 1, parsePitch('D5'))
    ed.placePoint(0, 0, 2, parsePitch('E5'))
    ed.tapElement(a.id)
    ed.toggleDot()
    ed.setDuration('q')
    ed.setDuration('8')
    expect(desc()[0]).toEqual(['c/5q.', 'd/58', 'e/5•'])
    expect(ed.dotted.value).toBe(false)
  })
  it('un point transformé en silence devient une noire', () => {
    const { ed, desc } = setup()
    ed.setDuration('16')
    ed.placePoint(0, 0, 0, parsePitch('C5'))
    ed.toRest()
    expect(desc()[0]).toEqual(['rq'])
  })
})

describe('éditeur v3 : armure, lignes, largeurs', () => {
  it('un point posé prend l’altération de l’armure', () => {
    const { score, ed, desc } = setup()
    score.value.keySignature = 1
    ed.placePoint(0, 0, 0, parsePitch('F4'))
    ed.insertPointAfterSelection('C')
    expect(desc()[0]).toEqual(['f#/4•', 'c/4•']) // octave la plus proche de F♯4
  })

  it('♮ force le naturel, ♯ rebascule vers l’armure', () => {
    const { score, ed, desc } = setup()
    score.value.keySignature = 1
    ed.placePoint(0, 0, 0, parsePitch('F4'))
    ed.setAlter(0)
    expect(desc()[0]).toEqual(['f/4•'])
    ed.setAlter(0)
    expect(desc()[0]).toEqual(['f/4•'])
    ed.setAlter(1)
    expect(desc()[0]).toEqual(['f#/4•'])
    ed.setAlter(1) // déjà ♯ : retour à l’armure (♯ ici)
    expect(desc()[0]).toEqual(['f#/4•'])
    ed.placePoint(0, 0, 1, parsePitch('C5'))
    ed.setAlter(-1)
    ed.setAlter(-1) // re-bascule : retour à l’armure (naturel)
    expect(desc()[0]).toEqual(['f#/4•', 'c/5•'])
  })

  it('transposer et glisser suivent l’armure', () => {
    const { score, ed, desc } = setup()
    score.value.keySignature = 1
    const n = ed.placePoint(0, 0, 0, parsePitch('E4'))
    ed.transpose(1)
    expect(desc()[0]).toEqual(['f#/4•'])
    ed.transpose(1)
    expect(desc()[0]).toEqual(['g/4•'])
    ed.setAlter(1) // G♯ hors armure : garde son ♯ en transposant
    ed.transpose(1)
    expect(desc()[0]).toEqual(['a#/4•'])
    ed.setPitch(n.id, parsePitch('F4')) // glisser : reprend l’armure
    expect(desc()[0]).toEqual(['f#/4•'])
  })

  it('changer d’armure réarme les notes qui la suivaient, annulable', () => {
    const { score, ed, desc } = setup()
    score.value.keySignature = 1
    ed.placePoint(0, 0, 0, parsePitch('F4'))
    ed.placePoint(0, 0, 1, parsePitch('C5'))
    ed.placePoint(0, 0, 2, parsePitch('F4'))
    ed.setAlter(0) // F♮ explicite
    ed.setKeySignature(2)
    expect(score.value.keySignature).toBe(2)
    expect(desc()[0]).toEqual(['f#/4•', 'c#/5•', 'f/4•'])
    ed.undo()
    expect(score.value.keySignature).toBe(1)
    expect(desc()[0]).toEqual(['f#/4•', 'c/5•', 'f/4•'])
  })

  it('insère une ligne en haut ou au milieu ; les largeurs suivent leur ligne', () => {
    const { score, ed, m } = setup()
    ed.placePoint(0, 0, 0, parsePitch('G4'))
    ed.addLine() // 2 lignes
    ed.setLineWidths(0, [0.4, 0.2, 0.2, 0.2])
    ed.addLine(0) // nouvelle ligne en tête
    expect(score.value.measureCount).toBe(12)
    expect(m(0)[0]).toEqual([])
    expect(m(0)[4].length).toBe(1)
    expect(m(3).length).toBe(12)
    expect(score.value.lineWidths).toEqual([null, [0.4, 0.2, 0.2, 0.2], null])
    ed.removeLine(0)
    expect(score.value.lineWidths).toEqual([[0.4, 0.2, 0.2, 0.2], null])
    expect(m(0)[0].length).toBe(1)
    ed.undo()
    ed.undo()
    expect(score.value.measureCount).toBe(8)
    expect(score.value.lineWidths).toEqual([[0.4, 0.2, 0.2, 0.2], null])
    ed.undo() // avant setLineWidths
    expect(score.value.lineWidths).toEqual([null, null])
  })

  it('setLineWidths normalise et rejette les valeurs invalides', () => {
    const { score, ed } = setup()
    ed.setLineWidths(0, [2, 1, 1, 0])
    expect(score.value.lineWidths).toEqual([[0.5, 0.25, 0.25, 0]])
    ed.setLineWidths(0, [NaN, 1, 1, 1])
    expect(score.value.lineWidths).toEqual([[0.5, 0.25, 0.25, 0]])
    ed.setLineWidths(5, [1, 1, 1, 1])
    expect(score.value.lineWidths).toEqual([[0.5, 0.25, 0.25, 0]])
  })

  it('vérifier le rythme est un simple interrupteur, sans modifier la partition', () => {
    const { score, ed } = setup()
    const before = JSON.stringify(score.value)
    expect(ed.checkRhythm.value).toBe(false)
    ed.checkRhythm.value = true
    expect(JSON.stringify(score.value)).toBe(before)
    expect(ed.canUndo.value).toBe(false)
  })
})

describe('éditeur v3 : annuler sur une partition v2', () => {
  it('n’ajoute pas armure ni largeurs à une partition qui n’en avait pas', () => {
    const { score, ed } = setup()
    ed.placePoint(0, 0, 0, parsePitch('G4'))
    ed.undo()
    expect('keySignature' in score.value).toBe(false)
    expect('lineWidths' in score.value).toBe(false)
  })
})
