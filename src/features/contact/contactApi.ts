/** Appels à l'API de contact du Worker (`/api/contact`, à la racine du domaine). */

export interface ContactMessage {
  firstName: string
  lastName: string
  email: string
  message: string
  token: string
}

const URL_CONTACT = '/api/contact'
const UNAVAILABLE = "Le formulaire de contact n'est pas disponible ici, réessaie sur solfabox.app."

/** Clé publique Turnstile, ou une erreur lisible si l'API n'est pas là (ex. GitHub Pages). */
export async function fetchSiteKey(fetchFn: typeof fetch = fetch): Promise<{ siteKey: string } | { error: string }> {
  try {
    const res = await fetchFn(URL_CONTACT, { headers: { accept: 'application/json' } })
    const data = res.ok ? ((await res.json()) as { siteKey?: unknown }) : null
    if (typeof data?.siteKey === 'string' && data.siteKey) return { siteKey: data.siteKey }
  } catch {
    // réseau ou réponse non JSON : même message
  }
  return { error: UNAVAILABLE }
}

export async function sendContact(msg: ContactMessage, fetchFn: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetchFn(URL_CONTACT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(msg),
    })
    if (res.ok) return { ok: true }
    const data = (await res.json().catch(() => null)) as { error?: unknown } | null
    return { ok: false, error: typeof data?.error === 'string' ? data.error : "L'envoi a échoué, réessaie plus tard." }
  } catch {
    return { ok: false, error: "Impossible de joindre le serveur. Vérifie ta connexion et réessaie." }
  }
}
