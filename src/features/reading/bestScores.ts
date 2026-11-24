import { recordKey, type ReadingSettings } from './settings'

// v2 : records par réglages (tessiture, saut) ; l'ancienne clé `best-scores` n'est plus lue.
const KEY = 'sheet-music:records-v2'

export function readRecords(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  } catch {
    return {}
  }
}

export function writeRecords(records: Record<string, number>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(records))
  } catch {
    /* stockage indisponible : on ignore */
  }
}

export function getBestScore(s: ReadingSettings): number {
  return readRecords()[recordKey(s)] ?? 0
}

/** Enregistre le score s'il bat le record ; renvoie true si nouveau record. */
export function saveBestScore(s: ReadingSettings, score: number): boolean {
  const all = readRecords()
  const k = recordKey(s)
  if (score <= (all[k] ?? 0)) return false
  all[k] = score
  writeRecords(all)
  return true
}
