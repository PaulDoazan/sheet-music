/** Formulaire de contact : validation, vérification anti-robot (Turnstile) et composition du mail. */

export interface ContactEnv {
  /** adresse qui reçoit les messages (secret, vérifiée dans Email Routing) */
  CONTACT_TO: string
  /** expéditeur, sur le domaine où Email Routing est actif (ex. contact@solfabox.app) */
  CONTACT_FROM: string
  TURNSTILE_SITE_KEY: string
  TURNSTILE_SECRET: string
}

export interface ContactInput {
  firstName: string
  lastName: string
  email: string
  message: string
  token: string
}

export const LIMITS = { name: 100, email: 254, message: 5000 } as const

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/
const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, ' ').trim()

export function parseContact(body: unknown): { ok: true; value: ContactInput } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Requête invalide.' }
  const b = body as Record<string, unknown>
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '')
  const firstName = oneLine(str('firstName'))
  const lastName = oneLine(str('lastName'))
  const email = str('email').trim()
  const message = str('message').trim()
  const token = str('token').trim()
  if (!message) return { ok: false, error: 'Le message est vide.' }
  if (message.length > LIMITS.message) return { ok: false, error: 'Le message est trop long.' }
  if (firstName.length > LIMITS.name || lastName.length > LIMITS.name) return { ok: false, error: 'Nom trop long.' }
  if (email && (email.length > LIMITS.email || !EMAIL_RE.test(email))) return { ok: false, error: "L'adresse e-mail n'est pas valide." }
  if (!token) return { ok: false, error: 'Vérification anti-robot manquante.' }
  return { ok: true, value: { firstName, lastName, email, message, token } }
}

function base64Utf8(s: string): string {
  let bin = ''
  for (const byte of new TextEncoder().encode(s)) bin += String.fromCharCode(byte)
  return btoa(bin)
}
const encodeWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${base64Utf8(s)}?=`)
/** nom d'affichage : entre guillemets s'il est ASCII, sinon « encoded-word » (jamais entre guillemets) */
const displayName = (s: string) => {
  const clean = s.replace(/["\\]/g, '')
  return /^[\x20-\x7e]*$/.test(clean) ? `"${clean}"` : encodeWord(clean)
}

export interface MailParts {
  from: string
  to: string
  input: ContactInput
  date: Date
  messageId: string
}

/** Mail brut (RFC 5322), texte UTF-8 en base64. Reply-To = l'expéditeur, s'il a laissé son adresse. */
export function buildMime({ from, to, input, date, messageId }: MailParts): string {
  const name = [input.firstName, input.lastName].filter(Boolean).join(' ')
  const subject = `Solfabox — message de ${name || 'un visiteur'}`
  const body = [
    `Nom : ${name || '(non renseigné)'}`,
    `E-mail : ${input.email || '(non renseigné)'}`,
    '',
    input.message,
  ].join('\r\n')
  const headers = [
    `From: Solfabox <${from}>`,
    `To: <${to}>`,
    ...(input.email ? [`Reply-To: ${name ? `${displayName(name)} ` : ''}<${input.email}>`] : []),
    `Subject: ${encodeWord(subject)}`,
    `Date: ${date.toUTCString()}`,
    `Message-ID: <${messageId}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ]
  const encoded = base64Utf8(body).replace(/.{1,76}/g, '$&\r\n')
  return `${headers.join('\r\n')}\r\n\r\n${encoded}`
}

export async function verifyTurnstile(
  secret: string,
  token: string,
  ip: string | null,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const form = new FormData()
  form.append('secret', secret)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)
  try {
    const res = await fetchFn('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

export interface ContactDeps {
  verify: (token: string, ip: string | null) => Promise<boolean>
  send: (from: string, to: string, raw: string) => Promise<void>
  now?: () => Date
  uuid?: () => string
}

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

/** GET → clé publique Turnstile ; POST → envoi du message. */
export async function handleContact(request: Request, env: ContactEnv, deps: ContactDeps): Promise<Response> {
  if (request.method === 'GET') return json(200, { siteKey: env.TURNSTILE_SITE_KEY ?? '' })
  if (request.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' })
  if (!env.CONTACT_TO || !env.CONTACT_FROM || !env.TURNSTILE_SECRET) {
    return json(503, { error: "Le formulaire de contact n'est pas encore configuré." })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'Requête invalide.' })
  }
  const parsed = parseContact(body)
  if (!parsed.ok) return json(400, { error: parsed.error })
  const ip = request.headers.get('cf-connecting-ip')
  if (!(await deps.verify(parsed.value.token, ip))) {
    return json(403, { error: 'Vérification anti-robot échouée, réessaie.' })
  }
  const domain = env.CONTACT_FROM.split('@')[1] ?? 'solfabox.app'
  const raw = buildMime({
    from: env.CONTACT_FROM,
    to: env.CONTACT_TO,
    input: parsed.value,
    date: (deps.now ?? (() => new Date()))(),
    messageId: `${(deps.uuid ?? (() => crypto.randomUUID()))()}@${domain}`,
  })
  try {
    await deps.send(env.CONTACT_FROM, env.CONTACT_TO, raw)
  } catch (e) {
    console.error('contact: envoi impossible', e)
    return json(502, { error: "L'envoi a échoué, réessaie plus tard." })
  }
  return json(200, { ok: true })
}
