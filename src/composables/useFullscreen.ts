import { onBeforeUnmount, onMounted, ref } from 'vue'

type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }

/**
 * Plein écran (Fullscreen API, préfixe webkit pour Safari iPad).
 * Indisponible sur iPhone : l'app passe alors en plein écran via « Ajouter à l'écran d'accueil ».
 */
export function useFullscreen() {
  const doc = document as WebkitDocument
  const supported = !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled)
  const active = ref(false)

  const sync = () => (active.value = !!(doc.fullscreenElement || doc.webkitFullscreenElement))

  async function enter() {
    const el = document.documentElement as WebkitElement
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' })
      else await el.webkitRequestFullscreen?.()
      // Android : on en profite pour verrouiller le paysage (ignoré si non supporté)
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
      await orientation?.lock?.('landscape').catch(() => {})
    } catch {
      /* refusé par le navigateur */
    }
  }
  async function exit() {
    try {
      if (doc.exitFullscreen) await doc.exitFullscreen()
      else await doc.webkitExitFullscreen?.()
    } catch {
      /* ignore */
    }
  }
  const toggle = () => (active.value ? exit() : enter())

  onMounted(() => {
    sync()
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', sync)
    document.removeEventListener('webkitfullscreenchange', sync)
  })

  return { supported, active, toggle }
}
