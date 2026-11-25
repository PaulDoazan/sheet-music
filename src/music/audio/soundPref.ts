/** Préférence « son activé » (partagée par toute l'app, mémorisée dans le navigateur). */
import { ref } from 'vue'

const KEY = 'sheet-music:sound'

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export const soundOn = ref(read())

export function setSoundOn(on: boolean): void {
  soundOn.value = on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* stockage indisponible : la préférence vaut pour la session */
  }
}
