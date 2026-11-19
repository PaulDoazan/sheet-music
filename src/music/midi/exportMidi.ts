import { Midi } from '@tonejs/midi'
import { noteStarts, noteBeats, pitchToMidi, type Score } from '@/music/model'

/** Partition → fichier MIDI type 1 : une piste par portée, tempo et chiffrage inclus. */
export function scoreToMidi(score: Score): Uint8Array {
  const midi = new Midi()
  const ppq = midi.header.ppq
  midi.header.setTempo(score.bpm)
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [...score.timeSignature] })
  midi.header.name = score.title ?? ''
  score.staves.forEach((staff, i) => {
    const track = midi.addTrack()
    track.name = staff.name ?? `Voix ${i + 1}`
    track.channel = i >= 9 ? i + 1 : i // le canal 10 (index 9) est réservé aux percussions
    track.instrument.number = staff.program ?? 0
    for (const voice of staff.voices) {
      const starts = noteStarts(voice.notes)
      voice.notes.forEach((n, k) => {
        if (!n.pitch) return
        track.addNote({
          midi: pitchToMidi(n.pitch),
          ticks: Math.round(starts[k] * ppq),
          durationTicks: Math.round(noteBeats(n) * ppq),
          velocity: 0.8,
        })
      })
    }
  })
  return midi.toArray()
}

export function downloadMidi(score: Score) {
  const data = scoreToMidi(score)
  const blob = new Blob([data], { type: 'audio/midi' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(score.title || 'partition').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'partition'}.mid`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
