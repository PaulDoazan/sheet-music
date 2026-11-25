import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

describe('soundPref', () => {
  it('activé par défaut', async () => {
    const { soundOn } = await import('./soundPref')
    expect(soundOn.value).toBe(true)
  })
  it('mémorise le choix', async () => {
    const m = await import('./soundPref')
    m.setSoundOn(false)
    expect(localStorage.getItem('sheet-music:sound')).toBe('off')
    vi.resetModules()
    const again = await import('./soundPref')
    expect(again.soundOn.value).toBe(false)
  })
})
