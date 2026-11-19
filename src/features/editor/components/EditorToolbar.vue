<script setup lang="ts">
import {
  mdiArrowDownBold,
  mdiArrowUpBold,
  mdiBackspaceOutline,
  mdiMusicAccidentalFlat,
  mdiMusicAccidentalSharp,
  mdiMusicNoteEighth,
  mdiMusicNoteHalf,
  mdiMusicNoteQuarter,
  mdiMusicNoteSixteenth,
  mdiMusicNoteWhole,
  mdiMusicRestQuarter,
  mdiRedo,
  mdiUndo,
} from '@mdi/js'
import type { Duration } from '@/music/model'
import type { ScoreEditor } from '../editor'

const props = defineProps<{ editor: ScoreEditor }>()

const DURATIONS: { d: Duration; icon: string; label: string; key: string }[] = [
  { d: 'w', icon: mdiMusicNoteWhole, label: 'Ronde', key: 'W' },
  { d: 'h', icon: mdiMusicNoteHalf, label: 'Blanche', key: 'H' },
  { d: 'q', icon: mdiMusicNoteQuarter, label: 'Noire', key: 'Q' },
  { d: '8', icon: mdiMusicNoteEighth, label: 'Croche', key: 'I' },
  { d: '16', icon: mdiMusicNoteSixteenth, label: 'Double croche', key: 'S' },
]

const alter = () => props.editor.selected.value?.pitch?.alter ?? 0
</script>

<template>
  <div class="toolbar" role="toolbar" aria-label="Outils de saisie">
    <div class="group" role="radiogroup" aria-label="Durée">
      <button
        v-for="x in DURATIONS"
        :key="x.d"
        type="button"
        class="tool"
        role="radio"
        :aria-checked="editor.duration.value === x.d"
        :class="{ on: editor.duration.value === x.d }"
        :title="`${x.label} (${x.key})`"
        :aria-label="x.label"
        @click="editor.setDuration(x.d)"
      >
        <v-icon :icon="x.icon" size="22" />
      </button>
      <button
        type="button"
        class="tool dot"
        :class="{ on: editor.dotted.value }"
        :aria-pressed="editor.dotted.value"
        title="Note pointée (.)"
        aria-label="Note pointée"
        @click="editor.toggleDot()"
      >
        <span>•</span>
      </button>
    </div>

    <div class="group">
      <button type="button" class="tool" title="Silence (R ou 0)" aria-label="Silence" @click="editor.insertRest()">
        <v-icon :icon="mdiMusicRestQuarter" size="22" />
      </button>
      <button
        type="button"
        class="tool"
        :class="{ on: alter() === 1 }"
        :disabled="!editor.selected.value?.pitch"
        title="Dièse (+)"
        aria-label="Dièse"
        @click="editor.setAlter(1)"
      >
        <v-icon :icon="mdiMusicAccidentalSharp" size="22" />
      </button>
      <button
        type="button"
        class="tool"
        :class="{ on: alter() === -1 }"
        :disabled="!editor.selected.value?.pitch"
        title="Bémol (-)"
        aria-label="Bémol"
        @click="editor.setAlter(-1)"
      >
        <v-icon :icon="mdiMusicAccidentalFlat" size="22" />
      </button>
      <button
        type="button"
        class="tool"
        :disabled="!editor.selected.value?.pitch"
        title="Monter (↑, ⇧↑ octave)"
        aria-label="Monter la note"
        @click="editor.transposeSelected(1)"
      >
        <v-icon :icon="mdiArrowUpBold" size="20" />
      </button>
      <button
        type="button"
        class="tool"
        :disabled="!editor.selected.value?.pitch"
        title="Descendre (↓, ⇧↓ octave)"
        aria-label="Descendre la note"
        @click="editor.transposeSelected(-1)"
      >
        <v-icon :icon="mdiArrowDownBold" size="20" />
      </button>
    </div>

    <div class="group">
      <button
        type="button"
        class="tool"
        :disabled="!editor.selected.value"
        title="Supprimer (⌫)"
        aria-label="Supprimer la note"
        @click="editor.removeSelected()"
      >
        <v-icon :icon="mdiBackspaceOutline" size="20" />
      </button>
      <button type="button" class="tool" :disabled="!editor.canUndo.value" title="Annuler (Ctrl Z)" aria-label="Annuler" @click="editor.undo()">
        <v-icon :icon="mdiUndo" size="20" />
      </button>
      <button type="button" class="tool" :disabled="!editor.canRedo.value" title="Rétablir (Ctrl ⇧ Z)" aria-label="Rétablir" @click="editor.redo()">
        <v-icon :icon="mdiRedo" size="20" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none;
  padding: 2px 2px 5px; /* place pour l'ombre des boutons */
}
.toolbar::-webkit-scrollbar { display: none; }
.group {
  display: flex; gap: 2px; padding: 2px; border-radius: 12px; flex: none;
  border: 2px solid var(--ink); background: var(--card); box-shadow: 0 3px 0 var(--ink);
}
.tool {
  display: grid; place-items: center; min-width: 40px; height: 38px; border-radius: 9px; border: 0;
  background: transparent; color: var(--ink); cursor: pointer; touch-action: manipulation;
  -webkit-tap-highlight-color: transparent; font: inherit;
}
.tool:hover:not(:disabled) { background: var(--paper-2); }
.tool.on, .tool.on:hover:not(:disabled) { background: var(--ink); color: var(--paper); }
.tool:disabled { opacity: 0.35; cursor: default; }
.tool:focus-visible { outline: 3px solid var(--accent); outline-offset: 1px; }
.dot span { font-size: 1.6rem; line-height: 1; }
@media (orientation: landscape) and (max-height: 500px) {
  .tool { height: 34px; min-width: 36px; }
}
</style>
