import { describe, expect, it } from 'vitest'
import { sampleUrls } from './piano'

describe('sampleUrls', () => {
  it('couvre C1–C7 toutes les tierces mineures, avec les noms de fichiers Salamander', () => {
    const urls = sampleUrls()
    expect(Object.keys(urls)).toHaveLength(25)
    expect(urls.C1).toBe('C1.mp3')
    expect(urls['D#4']).toBe('Ds4.mp3')
    expect(urls['F#6']).toBe('Fs6.mp3')
    expect(urls.A3).toBe('A3.mp3')
    expect(urls.C7).toBe('C7.mp3')
  })
})
