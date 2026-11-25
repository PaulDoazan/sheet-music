// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { buildMime, handleContact, parseContact, verifyTurnstile, type ContactEnv } from './contact'

const env: ContactEnv = {
  CONTACT_TO: 'dest@example.com',
  CONTACT_FROM: 'contact@solfabox.app',
  TURNSTILE_SITE_KEY: 'site-key',
  TURNSTILE_SECRET: 'secret',
}
const valid = { firstName: 'Élise', lastName: 'Dupont', email: 'elise@example.com', message: 'Bonjour !\nMerci.', token: 't' }
const decodeBody = (raw: string) => {
  const b64 = raw.split('\r\n\r\n')[1].replace(/\r\n/g, '')
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
}
const post = (body: unknown) =>
  new Request('https://solfabox.app/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
const deps = (over: Partial<Parameters<typeof handleContact>[2]> = {}) => ({
  verify: vi.fn(async () => true),
  send: vi.fn(async () => {}),
  now: () => new Date('2026-11-24T10:00:00Z'),
  uuid: () => 'id-1',
  ...over,
})

describe('parseContact', () => {
  it('accepte un message seul (nom et e-mail facultatifs)', () => {
    const r = parseContact({ message: '  Salut  ', token: 't' })
    expect(r).toEqual({ ok: true, value: { firstName: '', lastName: '', email: '', message: 'Salut', token: 't' } })
  })
  it('refuse un message vide, trop long, un e-mail invalide ou sans jeton', () => {
    expect(parseContact({ message: '   ', token: 't' }).ok).toBe(false)
    expect(parseContact({ message: 'x'.repeat(5001), token: 't' }).ok).toBe(false)
    expect(parseContact({ message: 'x', email: 'pas-un-mail', token: 't' }).ok).toBe(false)
    expect(parseContact({ message: 'x' }).ok).toBe(false)
    expect(parseContact(null).ok).toBe(false)
  })
  it('met les noms sur une seule ligne (pas d\'injection d\'en-tête)', () => {
    const r = parseContact({ message: 'x', firstName: 'A\r\nBcc: x@y.z', token: 't' })
    expect(r.ok && r.value.firstName).toBe('A Bcc: x@y.z')
  })
})

describe('buildMime', () => {
  it('compose un mail UTF-8 avec Reply-To vers le visiteur', () => {
    const raw = buildMime({ from: env.CONTACT_FROM, to: env.CONTACT_TO, input: valid, date: new Date('2026-11-24T10:00:00Z'), messageId: 'id@solfabox.app' })
    const head = raw.split('\r\n\r\n')[0]
    expect(head).toContain('From: Solfabox <contact@solfabox.app>')
    expect(head).toContain('To: <dest@example.com>')
    expect(head).toMatch(/^Reply-To: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?= <elise@example\.com>$/m)
    expect(head).toMatch(/^Subject: =\?UTF-8\?B\?.+\?=$/m)
    expect(head).toContain('Message-ID: <id@solfabox.app>')
    expect(decodeBody(raw)).toBe('Nom : Élise Dupont\r\nE-mail : elise@example.com\r\n\r\nBonjour !\nMerci.')
  })
  it('met un nom ASCII entre guillemets dans Reply-To', () => {
    const raw = buildMime({ from: 'a@b.c', to: 'd@e.f', input: { ...valid, firstName: 'Jo "the"', lastName: 'Doe' }, date: new Date(), messageId: 'x@b.c' })
    expect(raw).toContain('Reply-To: "Jo the Doe" <elise@example.com>')
  })
  it("n'ajoute pas de Reply-To sans e-mail", () => {
    const raw = buildMime({ from: 'a@b.c', to: 'd@e.f', input: { ...valid, email: '', firstName: '', lastName: '' }, date: new Date(), messageId: 'x@b.c' })
    expect(raw).not.toContain('Reply-To')
    expect(decodeBody(raw)).toContain('Nom : (non renseigné)')
  })
})

describe('handleContact', () => {
  it('GET renvoie la clé publique Turnstile', async () => {
    const res = await handleContact(new Request('https://x/api/contact'), env, deps())
    expect(await res.json()).toEqual({ siteKey: 'site-key' })
  })
  it('POST valide : vérifie le jeton puis envoie le mail', async () => {
    const d = deps()
    const res = await handleContact(post(valid), env, d)
    expect(res.status).toBe(200)
    expect(d.verify).toHaveBeenCalledWith('t', '1.2.3.4')
    expect(d.send).toHaveBeenCalledWith('contact@solfabox.app', 'dest@example.com', expect.stringContaining('Message-ID: <id-1@solfabox.app>'))
  })
  it('400 si le corps est invalide, 403 si le jeton est refusé, 502 si l\'envoi échoue', async () => {
    expect((await handleContact(post('{'), env, deps())).status).toBe(400)
    expect((await handleContact(post({ ...valid, message: '' }), env, deps())).status).toBe(400)
    const refused = deps({ verify: vi.fn(async () => false) })
    expect((await handleContact(post(valid), env, refused)).status).toBe(403)
    expect(refused.send).not.toHaveBeenCalled()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await handleContact(post(valid), env, deps({ send: vi.fn(async () => { throw new Error('x') }) }))).status).toBe(502)
  })
  it('503 tant que les secrets ne sont pas définis, 405 sur une autre méthode', async () => {
    expect((await handleContact(post(valid), { ...env, CONTACT_TO: '' }, deps())).status).toBe(503)
    expect((await handleContact(new Request('https://x/api/contact', { method: 'PUT' }), env, deps())).status).toBe(405)
  })
})

describe('verifyTurnstile', () => {
  it('suit la réponse de Cloudflare et échoue fermé en cas d\'erreur réseau', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ success: true })))
    expect(await verifyTurnstile('s', 't', '1.2.3.4', ok as unknown as typeof fetch)).toBe(true)
    const body = (ok.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData
    expect(body.get('secret')).toBe('s')
    expect(body.get('remoteip')).toBe('1.2.3.4')
    const ko = vi.fn(async () => new Response(JSON.stringify({ success: false })))
    expect(await verifyTurnstile('s', 't', null, ko as unknown as typeof fetch)).toBe(false)
    const down = vi.fn(async () => { throw new Error('net') })
    expect(await verifyTurnstile('s', 't', null, down as unknown as typeof fetch)).toBe(false)
  })
})
