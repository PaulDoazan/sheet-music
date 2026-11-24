import { beforeEach, describe, expect, it } from 'vitest'
import { createScore } from '@/features/editor/templates'
import { scoresApi } from '@/features/editor/scoresApi'
import { readRecords, writeRecords } from '@/features/reading/bestScores'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/features/reading/settings'
import { applyImport, buildExport, exportFileName, importSummary, parseImport, type ExportFile } from './dataTransfer'

function file(over: Partial<ExportFile> = {}): ExportFile {
  return { app: 'sheet-music', version: 1, exportedAt: 'x', scores: [], records: {}, settings: null, ...over }
}

describe('dataTransfer', () => {
  beforeEach(() => localStorage.clear())

  it('aller-retour : partitions, records, réglages', async () => {
    const a = await scoresApi.save(createScore('satb', 'Ave'))
    const b = await scoresApi.save(createScore('melody', 'Air'))
    writeRecords({ k: 10 })
    const settings = { ...DEFAULT_SETTINGS, clefMode: 'both' as const, maxLeap: Infinity }
    saveSettings(settings)
    const ids = (l: Awaited<ReturnType<typeof scoresApi.list>>) => l.map((s) => [s.id, s.updatedAt]).sort()
    const before = ids(await scoresApi.list())

    const text = JSON.stringify(await buildExport())
    localStorage.clear()
    const r = parseImport(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    await applyImport(r.file)

    expect(ids(await scoresApi.list())).toEqual(before)
    expect((await scoresApi.get(a.id)).staves).toHaveLength(4)
    expect((await scoresApi.get(b.id)).title).toBe('Air')
    expect(readRecords()).toEqual({ k: 10 })
    expect(loadSettings()).toEqual(settings)
  })

  it("export : une entrée d'index orpheline n'empêche pas d'exporter les autres", async () => {
    await scoresApi.save({ ...createScore('melody', 'A'), id: 'a' })
    await scoresApi.save({ ...createScore('melody', 'B'), id: 'b' })
    localStorage.removeItem('sheet-music:score:b')
    const f = await buildExport()
    expect(f.scores.map((s) => s.id)).toEqual(['a'])
  })

  it('fusion : une partition de même id est remplacée, les autres restent', async () => {
    const local = { ...createScore('melody', 'Local'), id: 'a' }
    await scoresApi.save(local)
    await scoresApi.save({ ...createScore('melody', 'B'), id: 'b' })
    await applyImport(file({ scores: [{ ...createScore('melody', 'Importé'), id: 'a', updatedAt: 5 }] }))
    expect((await scoresApi.get('a')).title).toBe('Importé')
    expect((await scoresApi.get('b')).title).toBe('B')
    expect((await scoresApi.list()).find((s) => s.id === 'a')?.updatedAt).toBe(5)
  })

  it("import : un updatedAt non numérique est retiré, l'index garde une date valide", async () => {
    const base = createScore('melody', 'X')
    const r = parseImport(
      JSON.stringify(
        file({
          scores: [
            { ...base, id: 'a', updatedAt: 'hier' as never },
            { ...base, id: 'b', updatedAt: null as never },
            { ...base, id: 'c', updatedAt: 7 },
          ],
        }),
      ),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.file.scores.map((s) => 'updatedAt' in s)).toEqual([false, false, true])
    const before = Date.now()
    await applyImport(r.file)
    const list = await scoresApi.list()
    for (const s of list) expect(Number.isFinite(s.updatedAt)).toBe(true)
    expect(list.find((s) => s.id === 'a')!.updatedAt).toBeGreaterThanOrEqual(before)
    expect(list.find((s) => s.id === 'c')!.updatedAt).toBe(7)
    // l'affichage de ScoresView ne doit pas lever « Invalid time value »
    expect(() => list.map((s) => new Intl.DateTimeFormat('fr-FR').format(s.updatedAt))).not.toThrow()
  })

  it('records : le meilleur des deux', async () => {
    writeRecords({ k: 10, j: 5 })
    await applyImport(file({ records: { k: 7, m: 3 } }))
    expect(readRecords()).toEqual({ k: 10, j: 5, m: 3 })
  })

  it('rejette un fichier invalide sans rien écrire', async () => {
    const good = createScore('melody', 'X')
    const bad = [
      'nope',
      '{"foo":1}',
      JSON.stringify(file({ app: 'autre' as never })),
      JSON.stringify(file({ scores: [good, { title: 'sans id', staves: [] } as never] })),
    ]
    for (const t of bad) {
      const r = parseImport(t)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.length).toBeGreaterThan(0)
    }
    expect(localStorage.length).toBe(0)
  })

  it('importSummary', () => {
    expect(importSummary(file({ scores: [createScore('melody', 'a'), createScore('melody', 'b')], records: { a: 1, b: 2, c: 3 } }))).toBe('2 partitions, 3 records')
    expect(importSummary(file({ scores: [createScore('melody', 'a')], records: { a: 1 } }))).toBe('1 partition, 1 record')
  })

  it('exportFileName', () => {
    expect(exportFileName(new Date('2026-11-24T10:00:00'))).toBe('solfabox-2026-11-24.json')
  })
})
