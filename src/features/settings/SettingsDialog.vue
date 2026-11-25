<script setup lang="ts">
/** Modale « Réglages » : exporter / importer ses données (changement de domaine). */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useTheme } from 'vuetify'
import { mdiClose, mdiDownload, mdiUpload } from '@mdi/js'
import { scoreKeys } from '@/features/editor/queries'
import { setSoundOn, soundOn } from '@/music/audio/soundPref'
import { applyImport, buildExport, exportFileName, importSummary, parseImport } from './dataTransfer'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const qc = useQueryClient()
const theme = useTheme()
const input = ref<HTMLInputElement>()
const error = ref('')
const message = ref('')
watch(
  () => props.modelValue,
  (open) => {
    if (open) error.value = message.value = ''
  },
)

async function exportData() {
  error.value = ''
  try {
    const data = await buildExport()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportFileName(new Date())
    document.body.appendChild(a)
    a.click()
    a.remove()
    // révoquer tout de suite peut annuler le téléchargement (Safari, certains Firefox)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    message.value = 'Export terminé'
  } catch {
    message.value = ''
    error.value = "L'export a échoué."
  }
}

async function onFile(e: Event) {
  const el = e.target as HTMLInputElement
  const f = el.files?.[0]
  el.value = '' // permet de re-choisir le même fichier
  if (!f) return
  error.value = ''
  message.value = ''
  const res = parseImport(await f.text())
  if (!res.ok) {
    error.value = res.error
    return
  }
  if (!window.confirm(`Importer ${importSummary(res.file)} ? Les partitions déjà présentes seront remplacées par celles du fichier.`)) return
  try {
    await applyImport(res.file)
  } catch {
    error.value = "L'import a échoué (stockage plein ou indisponible)."
    return
  }
  if (res.file.theme) theme.global.name.value = res.file.theme
  await qc.invalidateQueries({ queryKey: scoreKeys.all })
  message.value = 'Import terminé'
}

function close() {
  emit('update:modelValue', false)
}

// Mobile paysage (peu de hauteur) : plein écran
const short = ref(false)
let mq: MediaQueryList | undefined
const onMq = () => (short.value = !!mq?.matches)
onMounted(() => {
  mq = window.matchMedia('(max-height: 500px)')
  onMq()
  mq.addEventListener('change', onMq)
})
onBeforeUnmount(() => mq?.removeEventListener('change', onMq))
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    :fullscreen="short"
    :max-width="short ? undefined : 480"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="settings-dialog card" :class="{ short }" role="dialog" aria-labelledby="settings-title">
      <header class="head">
        <h2 id="settings-title">Réglages</h2>
        <button class="bos-btn small round" type="button" aria-label="Fermer" @click="close">
          <v-icon :icon="mdiClose" size="18" />
        </button>
      </header>

      <label class="sound">
        <span>
          <b>Son du piano</b>
          <small>Joue la note quand tu la trouves en lecture</small>
        </span>
        <v-switch
          :model-value="soundOn"
          color="primary"
          density="compact"
          hide-details
          inset
          aria-label="Son du piano"
          @update:model-value="setSoundOn(!!$event)"
        />
      </label>

      <p class="hint">
        Tes données restent dans ce navigateur. Pour les retrouver sur un autre site ou appareil, exporte-les puis importe le fichier.
      </p>

      <div class="actions">
        <button class="bos-btn" type="button" @click="exportData">
          <v-icon :icon="mdiDownload" size="18" /> Exporter mes données
        </button>
        <button class="bos-btn" type="button" @click="input?.click()">
          <v-icon :icon="mdiUpload" size="18" /> Importer un fichier
        </button>
        <input ref="input" type="file" accept="application/json,.json" hidden @change="onFile" />
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-else-if="message" class="ok" role="status">{{ message }}</p>
    </div>
  </v-dialog>
</template>

<style scoped>
.settings-dialog { display: flex; flex-direction: column; gap: 12px; padding: 14px 18px 18px; color: var(--ink); background: var(--card); }
.settings-dialog.short {
  height: 100%; border-radius: 0; gap: 8px;
  padding: max(6px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right))
    max(8px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
}
.head { display: flex; align-items: center; justify-content: space-between; }
.head h2 { font-size: 1.3rem; }
.short .head h2 { font-size: 1.1rem; }
.sound { display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; }
.sound span { display: flex; flex-direction: column; }
.sound small { color: var(--ink-2); font-size: 0.85rem; }
.hint { margin: 0; color: var(--ink-2); font-size: 0.95rem; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; }
.actions .bos-btn { gap: 6px; }
.error { margin: 0; color: #b3261e; font-weight: 600; }
.ok { margin: 0; color: var(--ink); font-weight: 600; }
</style>
