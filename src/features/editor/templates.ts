import { LINE_MEASURES, type Clef, type Score, type Staff } from '@/music/model'

export type TemplateId = 'satb' | 'ssatb' | 'melody' | 'piano'

interface StaffDef {
  name: string
  clef: Clef
  clefOctave?: -1
  program: number
}

const VOICE = 53 // General MIDI « Voice Oohs » (n° 54 dans la norme, 0-based ici)

export const TEMPLATES: { id: TemplateId; label: string; hint: string; staves: StaffDef[] }[] = [
  {
    id: 'satb',
    label: 'Chœur SATB',
    hint: '4 voix',
    staves: [
      { name: 'Soprano', clef: 'treble', program: VOICE },
      { name: 'Alto', clef: 'treble', program: VOICE },
      { name: 'Ténor', clef: 'treble', clefOctave: -1, program: VOICE },
      { name: 'Basse', clef: 'bass', program: VOICE },
    ],
  },
  {
    id: 'ssatb',
    label: 'Chœur SSATB',
    hint: '5 voix',
    staves: [
      { name: 'Soprano 1', clef: 'treble', program: VOICE },
      { name: 'Soprano 2', clef: 'treble', program: VOICE },
      { name: 'Alto', clef: 'treble', program: VOICE },
      { name: 'Ténor', clef: 'treble', clefOctave: -1, program: VOICE },
      { name: 'Basse', clef: 'bass', program: VOICE },
    ],
  },
  { id: 'melody', label: 'Mélodie', hint: '1 portée', staves: [{ name: 'Mélodie', clef: 'treble', program: VOICE }] },
  {
    id: 'piano',
    label: 'Piano',
    hint: 'Sol + Fa',
    staves: [
      { name: 'Main droite', clef: 'treble', program: 0 },
      { name: 'Main gauche', clef: 'bass', program: 0 },
    ],
  },
]

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function createScore(templateId: TemplateId, title = 'Sans titre'): Score {
  const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0]
  const staves: Staff[] = t.staves.map((d) => ({
    id: uid('s'),
    name: d.name,
    clef: d.clef,
    ...(d.clefOctave ? { clefOctave: d.clefOctave } : {}),
    program: d.program,
    voices: [{ id: uid('v'), notes: [], measures: Array.from({ length: LINE_MEASURES }, () => []) }],
  }))
  return {
    id: uid('score-'),
    title,
    bpm: 80,
    timeSignature: [4, 4],
    staves,
    measureCount: LINE_MEASURES,
    updatedAt: Date.now(),
  }
}
