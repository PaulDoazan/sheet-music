import { beforeEach, describe, expect, it } from 'vitest'
import { createScore } from './templates'
import { scoresApi } from './scoresApi'

describe('scoresApi (localStorage)', () => {
  beforeEach(() => localStorage.clear())
  it('enregistre, liste, relit et supprime', async () => {
    const a = await scoresApi.save(createScore('satb', 'Ave'))
    await scoresApi.save(createScore('melody', 'Air'))
    expect((await scoresApi.list()).map((s) => s.title).sort()).toEqual(['Air', 'Ave'])
    expect((await scoresApi.get(a.id)).staves).toHaveLength(4)
    await scoresApi.remove(a.id)
    expect((await scoresApi.list()).map((s) => s.title)).toEqual(['Air'])
    await expect(scoresApi.get(a.id)).rejects.toThrow()
  })
})
