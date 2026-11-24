/** Worker Solfabox : sert le build Vite (assets) et l'API du formulaire de contact. */
import { EmailMessage } from 'cloudflare:email'
import { handleContact, verifyTurnstile, type ContactEnv } from './contact'

interface Env extends ContactEnv {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  CONTACT_EMAIL: { send: (message: EmailMessage) => Promise<void> }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/contact') {
      return handleContact(request, env, {
        verify: (token, ip) => verifyTurnstile(env.TURNSTILE_SECRET, token, ip),
        send: (from, to, raw) => env.CONTACT_EMAIL.send(new EmailMessage(from, to, raw)),
      })
    }
    if (pathname.startsWith('/api/')) return new Response('Not found', { status: 404 })
    return env.ASSETS.fetch(request)
  },
}
