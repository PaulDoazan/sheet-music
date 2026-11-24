import { describe, expect, it, vi } from 'vitest'
import { fetchSiteKey, sendContact } from './contactApi'

const res = (status: number, body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
const msg = { firstName: '', lastName: '', email: '', message: 'Salut', token: 't' }

describe('fetchSiteKey', () => {
  it('renvoie la clé publique', async () => {
    expect(await fetchSiteKey(vi.fn(async () => res(200, { siteKey: 'k' })) as unknown as typeof fetch)).toEqual({ siteKey: 'k' })
  })
  it("signale l'indisponibilité (404 GitHub Pages, HTML, clé vide, réseau)", async () => {
    for (const f of [
      async () => res(404, 'Not found'),
      async () => res(200, '<!doctype html>'),
      async () => res(200, { siteKey: '' }),
      async () => { throw new Error('net') },
    ]) {
      expect(await fetchSiteKey(vi.fn(f) as unknown as typeof fetch)).toHaveProperty('error')
    }
  })
})

describe('sendContact', () => {
  it('poste le message en JSON', async () => {
    const f = vi.fn(async () => res(200, { ok: true }))
    expect(await sendContact(msg, f as unknown as typeof fetch)).toEqual({ ok: true })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/contact')
    expect(JSON.parse(init.body as string)).toEqual(msg)
  })
  it("reprend le message d'erreur du serveur, sinon un message générique", async () => {
    expect(await sendContact(msg, vi.fn(async () => res(403, { error: 'Vérification anti-robot échouée, réessaie.' })) as unknown as typeof fetch))
      .toEqual({ ok: false, error: 'Vérification anti-robot échouée, réessaie.' })
    const r = await sendContact(msg, vi.fn(async () => res(500, 'oops')) as unknown as typeof fetch)
    expect(r.ok).toBe(false)
    const n = await sendContact(msg, vi.fn(async () => { throw new Error('net') }) as unknown as typeof fetch)
    expect(n).toEqual({ ok: false, error: expect.stringContaining('connexion') })
  })
})
