import type { ClefMode, Level } from './levels'

const KEY = 'sheet-music:best-scores'

function readAll(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

export function getBestScore(mode: ClefMode, level: Level): number {
  return readAll()[`${mode}-${level}`] ?? 0
}

/** Enregistre le score s'il bat le record ; renvoie true si nouveau record. */
export function saveBestScore(mode: ClefMode, level: Level, score: number): boolean {
  const all = readAll()
  const k = `${mode}-${level}`
  if (score <= (all[k] ?? 0)) return false
  all[k] = score
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* stockage indisponible : on ignore */
  }
  return true
}
