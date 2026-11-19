import { describe, expect, it } from 'vitest'
import { Midi } from '@tonejs/midi'
import { parsePitch, type Score } from '@/music/model'
import { scoreToMidi } from './exportMidi'

describe('export MIDI', () => {
  it('une piste par portée, notes au bon temps', () => {
    const score: Score = {
      id: 's',
      title: 'Test',
      bpm: 120,
      timeSignature: [3, 4],
      staves: [
        {
          id: 'a',
          name: 'Soprano',
          clef: 'treble',
          program: 53,
          voices: [
            {
              id: 'v',
              notes: [
                { id: '1', pitch: parsePitch('C5'), duration: 'q' },
                { id: '2', pitch: null, duration: 'q' },
                { id: '3', pitch: { step: 'F', octave: 4, alter: 1 }, duration: 'h', dots: 1 },
              ],
            },
          ],
        },
        { id: 'b', name: 'Basse', clef: 'bass', voices: [{ id: 'v', notes: [{ id: '4', pitch: parsePitch('C3'), duration: 'w' }] }] },
      ],
    }
    const back = new Midi(scoreToMidi(score))
    expect(back.header.tempos[0].bpm).toBeCloseTo(120)
    expect(back.header.timeSignatures[0].timeSignature).toEqual([3, 4])
    expect(back.tracks.map((t) => t.name)).toEqual(['Soprano', 'Basse'])
    expect(back.tracks[0].instrument.number).toBe(53)
    const s = back.tracks[0].notes
    expect(s.map((n) => n.midi)).toEqual([72, 66])
    expect(s[1].ticks).toBe(2 * back.header.ppq)
    expect(s[1].durationTicks).toBe(3 * back.header.ppq)
    expect(back.tracks[1].notes[0].midi).toBe(48)
  })
})
