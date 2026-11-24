/** Export / import de toutes les données utilisateur (changement de domaine : localStorage est par origine). */
import { scoresApi } from '@/features/editor/scoresApi'
import { readRecords, writeRecords } from '@/features/reading/bestScores'
import { loadSettings, saveSettings } from '@/features/reading/settings'
import type { Score } from '@/music/model'

const THEME_KEY = 'sheet-music:theme'

export interface ExportFile {
  app: 'sheet-music'
  version: 1
  exportedAt: string
  scores: Score[]
  records: Record<string, number>
  settings: unknown
  theme?: string
}

function readTheme(): string | undefined {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'light' || t === 'dark' ? t : undefined
  } catch {
    return undefined
  }
}

export async function buildExport(): Promise<ExportFile> {
  const summaries = await scoresApi.list()
  // une entrée d'index orpheline ne doit pas bloquer l'export : on garde les partitions lisibles
  const settled = await Promise.allSettled(summaries.map((s) => scoresApi.get(s.id)))
  const scores = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
  const s = loadSettings()
  const file: ExportFile = {
    app: 'sheet-music',
    version: 1,
    exportedAt: new Date().toISOString(),
    scores,
    records: readRecords(),
    // JSON ne sait pas stocker Infinity : même format que saveSettings
    settings: { ...s, maxLeap: s.maxLeap === Infinity ? 'free' : s.maxLeap },
  }
  const theme = readTheme()
  if (theme) file.theme = theme
  return file
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export function parseImport(text: string): { ok: true; file: ExportFile } | { ok: false; error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: "Ce fichier n'est pas un JSON valide." }
  }
  if (!isObject(raw) || raw.app !== 'sheet-music') {
    return { ok: false, error: "Ce fichier ne vient pas de Sheet Music." }
  }
  if (raw.version !== 1) return { ok: false, error: 'Version de fichier non prise en charge.' }
  const scores = raw.scores ?? []
  if (!Array.isArray(scores)) return { ok: false, error: 'Fichier invalide : partitions illisibles.' }
  // tout ou rien : une seule partition invalide rejette tout le fichier
  if (!scores.every((s) => isObject(s) && typeof s.id === 'string' && s.id && Array.isArray(s.staves))) {
    return { ok: false, error: 'Fichier invalide : une partition est incomplète.' }
  }
  const records: Record<string, number> = {}
  if (isObject(raw.records)) {
    for (const [k, v] of Object.entries(raw.records)) {
      if (typeof v === 'number' && Number.isFinite(v)) records[k] = v
    }
  }
  return {
    ok: true,
    file: {
      app: 'sheet-music',
      version: 1,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
      // updatedAt non numérique : retiré (put tamponne Date.now()) pour ne pas casser le tri / l'affichage des dates
      scores: (scores as Score[]).map((s) => {
        if (s.updatedAt === undefined || Number.isFinite(s.updatedAt)) return s
        const copy = { ...s }
        delete copy.updatedAt
        return copy
      }),
      records,
      settings: raw.settings ?? null,
      theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : undefined,
    },
  }
}

export function importSummary(f: ExportFile): string {
  const n = f.scores.length
  const r = Object.keys(f.records).length
  return `${n} partition${n > 1 ? 's' : ''}, ${r} record${r > 1 ? 's' : ''}`
}

export async function applyImport(f: ExportFile): Promise<void> {
  for (const s of f.scores) await scoresApi.put(s)
  // records : on garde le meilleur des deux
  const merged = readRecords()
  for (const [k, v] of Object.entries(f.records)) merged[k] = Math.max(merged[k] ?? 0, v)
  writeRecords(merged)
  if (isObject(f.settings)) {
    // loadSettings est tolérant : on y dépose la valeur brute, puis on la normalise
    try {
      localStorage.setItem('sheet-music:last-settings', JSON.stringify(f.settings))
    } catch {
      /* stockage indisponible : on ignore */
    }
    saveSettings(loadSettings())
  }
  if (f.theme) {
    try {
      localStorage.setItem(THEME_KEY, f.theme)
    } catch {
      /* ignore */
    }
  }
}

export function exportFileName(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `sheet-music-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`
}
