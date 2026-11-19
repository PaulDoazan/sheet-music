import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { pitchToVexKey } from '@/music/model'
import { createScore } from './templates'
import { createScoreEditor, nearestIndex } from './editor'

function setup(t: Parameters<typeof createScore>[0] = 'satb') {
  const score = ref(createScore(t))
  const ed = createScoreEditor(score)
  const keys = (si = 0) => score.value.staves[si].voices[0].notes.map((n) => (n.pitch ? pitchToVexKey(n.pitch) : 'r') + n.duration)
  return { score, ed, keys }
}

describe('éditeur', () => {
  it("choisit l'octave la plus proche", () => {
    expect(nearestIndex('C', 4 * 7 + 6)).toBe(5 * 7) // après Si4, Do → Do5
    const { ed, keys } = setup()
    ed.insertNote('C') // réf. B4 → C5
    ed.insertNote('A') // → A4
    ed.insertNote('E') // → E5 (plus proche que E4 ? A4→E5 = 4, A4→E4 = 3) → E4
    expect(keys()).toEqual(['c/5q', 'a/4q', 'e/4q'])
  })
  it('ténor et basse partent du milieu de leur portée', () => {
    const { ed, keys } = setup()
    ed.selectAfter(2, 0)
    ed.insertNote('B')
    ed.selectAfter(3, 0)
    ed.insertNote('D')
    expect(keys(2)).toEqual(['b/3q'])
    expect(keys(3)).toEqual(['d/3q'])
  })
  it('raccourcit une note au bout de la mesure', () => {
    const { ed, keys } = setup()
    ed.setDuration('h')
    ed.toggleDot()
    ed.insertNote('G') // 3 temps
    ed.toggleDot()
    ed.insertNote('G') // blanche demandée, 1 temps restant → noire
    ed.insertNote('G') // nouvelle mesure → blanche
    expect(keys()).toEqual(['g/4h', 'g/4q', 'g/4h'])
  })
  it('supprime, transpose, altère, annule et rétablit', () => {
    const { ed, keys, score } = setup()
    ed.insertNote('C')
    ed.insertNote('D')
    ed.transposeSelected(1)
    ed.setAlter(-1)
    expect(keys()).toEqual(['c/5q', 'eb/5q'])
    ed.removeSelected()
    expect(keys()).toEqual(['c/5q'])
    ed.undo()
    expect(keys()).toEqual(['c/5q', 'eb/5q'])
    ed.undo()
    ed.undo()
    expect(keys()).toEqual(['c/5q', 'd/5q'])
    ed.redo()
    expect(keys()).toEqual(['c/5q', 'e/5q'])
    expect(ed.cursor.index).toBe(2)
    expect(score.value.staves[0].voices[0].notes[1].pitch?.alter).toBeUndefined()
  })
  it('change de portée à la même position temporelle', () => {
    const { ed } = setup()
    ed.selectAfter(1, 0)
    ed.insertNote('C')
    ed.insertNote('C')
    ed.selectAfter(0, 0)
    for (let i = 0; i < 4; i++) ed.insertNote('E')
    ed.selectAfter(0, 2) // après la 2e note (temps 1)
    ed.moveStaff(1)
    expect(ed.cursor).toEqual({ staff: 1, index: 2 })
  })
})

describe('éditeur — durée', () => {
  it('modifie la note désignée, pas celle qui vient d’être saisie', () => {
    const { ed, keys } = setup()
    ed.insertNote('G')
    ed.setDuration('h') // vaut pour la suivante
    expect(keys()).toEqual(['g/4q'])
    ed.selectAfter(0, 1) // tap sur la note
    ed.setDuration('8')
    expect(keys()).toEqual(['g/48'])
  })
})
