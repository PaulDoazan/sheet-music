import { describe, expect, it } from 'vitest'
import router from './router'

describe('router', () => {
  it('résout les routes principales', () => {
    expect(router.resolve('/').name).toBe('home')
    expect(router.resolve('/read').name).toBe('read')
    expect(router.resolve('/?clef=treble&level=3').name).toBe('home')
    expect(router.resolve('/play').name).toBe('play')
    expect(router.resolve('/scores').name).toBe('scores')
    expect(router.resolve('/scores/abc').name).toBe('editor')
  })

  it("redirige une URL inconnue vers l'accueil", async () => {
    await router.push('/nimporte')
    expect(router.currentRoute.value.name).toBe('home')
  })
})
