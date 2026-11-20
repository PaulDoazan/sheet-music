import { describe, expect, it } from 'vitest'
import { parsePitch } from '@/music/model'
import { pitchAtStep, stepOfPitch } from './pitchFromY'

describe('pitchAtStep', () => {
  it('ligne du haut et degrés en dessous', () => {
    expect(pitchAtStep('treble', 0, 0)).toEqual(parsePitch('F5'))
    expect(pitchAtStep('treble', 0, 8)).toEqual(parsePitch('E4'))
    expect(pitchAtStep('bass', 0, 4)).toEqual(parsePitch('D3'))
    expect(pitchAtStep('treble', -1, 8)).toEqual(parsePitch('E3'))
  })
  it('borné à 4 lignes supplémentaires', () => {
    expect(pitchAtStep('treble', 0, -20)).toEqual(parsePitch('G6')) // 4e ligne supplémentaire au-dessus
    expect(pitchAtStep('treble', 0, 40)).toEqual(parsePitch('D3')) // 4e ligne supplémentaire au-dessous
  })
  it('inverse : degré d’une hauteur', () => {
    expect(stepOfPitch('treble', 0, parsePitch('E4'))).toBe(8)
    expect(stepOfPitch('treble', -1, parsePitch('E3'))).toBe(8)
  })
})
