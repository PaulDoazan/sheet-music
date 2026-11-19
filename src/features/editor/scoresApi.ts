/**
 * Stockage des partitions. Aujourd'hui : localStorage. Demain : le backend Go — seule cette
 * implémentation changera, les composants passent par TanStack Query (queries.ts).
 */
import type { Score } from '@/music/model'

export interface ScoreSummary {
  id: string
  title: string
  staves: number
  updatedAt: number
}

const INDEX_KEY = 'sheet-music:scores'
const scoreKey = (id: string) => `sheet-music:score:${id}`

function readIndex(): ScoreSummary[] {
  try {
    const v = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
function writeIndex(list: ScoreSummary[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list))
}

export const scoresApi = {
  async list(): Promise<ScoreSummary[]> {
    return readIndex().sort((a, b) => b.updatedAt - a.updatedAt)
  },
  async get(id: string): Promise<Score> {
    const raw = localStorage.getItem(scoreKey(id))
    if (!raw) throw new Error('Partition introuvable')
    return JSON.parse(raw) as Score
  },
  async save(score: Score): Promise<Score> {
    const saved: Score = { ...score, updatedAt: Date.now() }
    localStorage.setItem(scoreKey(saved.id), JSON.stringify(saved))
    const summary: ScoreSummary = {
      id: saved.id,
      title: saved.title || 'Sans titre',
      staves: saved.staves.length,
      updatedAt: saved.updatedAt!,
    }
    writeIndex([summary, ...readIndex().filter((s) => s.id !== saved.id)])
    return saved
  },
  async remove(id: string): Promise<void> {
    localStorage.removeItem(scoreKey(id))
    writeIndex(readIndex().filter((s) => s.id !== id))
  },
}
