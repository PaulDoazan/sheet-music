<script setup lang="ts">
/** Modale « Contact » : message envoyé par le Worker (l'adresse de destination n'est jamais exposée). */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { mdiClose, mdiSend } from '@mdi/js'
import { fetchSiteKey, sendContact } from './contactApi'
import { loadTurnstile } from './turnstile'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const theme = useTheme()
const form = reactive({ firstName: '', lastName: '', email: '', message: '' })
const token = ref('')
const status = ref<'idle' | 'sending' | 'sent'>('idle')
const error = ref('')
const widgetBox = ref<HTMLElement>()
let widgetId: string | undefined

const canSend = computed(() => form.message.trim() !== '' && token.value !== '' && status.value === 'idle')

async function mountWidget() {
  error.value = ''
  const key = await fetchSiteKey()
  if ('error' in key) {
    error.value = key.error
    return
  }
  try {
    const ts = await loadTurnstile()
    await nextTick()
    if (!props.modelValue || !widgetBox.value) return
    widgetId = ts.render(widgetBox.value, {
      sitekey: key.siteKey,
      language: 'fr',
      theme: theme.global.current.value.dark ? 'dark' : 'light',
      appearance: 'interaction-only',
      callback: (t: string) => (token.value = t),
      'expired-callback': () => (token.value = ''),
      'error-callback': () => {
        token.value = ''
        error.value = 'La vérification anti-robot a échoué, recharge la page et réessaie.'
      },
    })
  } catch {
    error.value = 'Impossible de charger la vérification anti-robot. Vérifie ta connexion et réessaie.'
  }
}

function unmountWidget() {
  if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
  widgetId = undefined
  token.value = ''
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (status.value === 'sent') {
        Object.assign(form, { firstName: '', lastName: '', email: '', message: '' })
        status.value = 'idle'
      }
      mountWidget()
    } else unmountWidget()
  },
)
onBeforeUnmount(unmountWidget)

async function submit() {
  if (!canSend.value) return
  status.value = 'sending'
  error.value = ''
  const res = await sendContact({ ...form, token: token.value })
  if (res.ok) {
    status.value = 'sent'
    return
  }
  status.value = 'idle'
  error.value = res.error
  // un jeton Turnstile ne sert qu'une fois : on en redemande un
  token.value = ''
  if (widgetId && window.turnstile) window.turnstile.reset(widgetId)
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
    :max-width="short ? undefined : 520"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="contact-dialog card" :class="{ short }" role="dialog" aria-labelledby="contact-title">
      <header class="head">
        <h2 id="contact-title">Contact</h2>
        <button class="bos-btn small round" type="button" aria-label="Fermer" @click="close">
          <v-icon :icon="mdiClose" size="18" />
        </button>
      </header>

      <div v-if="status === 'sent'" class="sent" role="status">
        <p>Merci, ton message est bien parti&nbsp;!</p>
        <button class="bos-btn primary" type="button" @click="close">Fermer</button>
      </div>

      <form v-else class="form" novalidate @submit.prevent="submit">
        <div class="row">
          <label class="field">
            <span>Prénom</span>
            <input v-model="form.firstName" type="text" autocomplete="given-name" maxlength="100" />
          </label>
          <label class="field">
            <span>Nom</span>
            <input v-model="form.lastName" type="text" autocomplete="family-name" maxlength="100" />
          </label>
        </div>
        <label class="field">
          <span>E-mail <small>facultatif, pour qu'on puisse te répondre</small></span>
          <input v-model="form.email" type="email" autocomplete="email" inputmode="email" maxlength="254" />
        </label>
        <label class="field grow">
          <span>Message</span>
          <textarea v-model="form.message" rows="4" maxlength="5000" required />
        </label>

        <div ref="widgetBox" class="widget" />
        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <div class="actions">
          <button class="bos-btn primary" type="submit" :disabled="!canSend">
            <v-icon :icon="mdiSend" size="18" />
            {{ status === 'sending' ? 'Envoi…' : 'Envoyer' }}
          </button>
        </div>
      </form>
    </div>
  </v-dialog>
</template>

<style scoped>
.contact-dialog {
  display: flex; flex-direction: column; gap: 12px; padding: 14px 18px 18px;
  color: var(--ink); background: var(--card); overflow: auto;
}
.contact-dialog.short {
  height: 100%; border-radius: 0; gap: 8px;
  padding: max(6px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right))
    max(8px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
}
.head { display: flex; align-items: center; justify-content: space-between; }
.head h2 { font-size: 1.3rem; }
.short .head h2 { font-size: 1.1rem; }

.form { display: flex; flex-direction: column; gap: 10px; }
.short .form { flex: 1; min-height: 0; gap: 6px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.field { display: flex; flex-direction: column; gap: 4px; font-weight: 600; font-size: 0.9rem; min-width: 0; }
.field small { font-weight: 400; color: var(--ink-2); }
.field input, .field textarea {
  font: inherit; font-weight: 400; font-size: 1rem; color: var(--ink); background: var(--paper);
  border: 2px solid var(--line); border-radius: 12px; padding: 8px 10px; outline: none; min-width: 0; width: 100%; box-sizing: border-box;
}
.field input:focus, .field textarea:focus { border-color: var(--ink); }
.field textarea { resize: vertical; min-height: 96px; }
.short .field textarea { min-height: 56px; }
.short .grow { flex: 1; min-height: 0; }
.short .grow textarea { flex: 1; height: 0; resize: none; }

.widget:empty { display: none; }
.actions { display: flex; justify-content: flex-end; }
.actions .bos-btn { gap: 6px; }
.error { margin: 0; color: var(--bad); font-weight: 600; }
.sent { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 18px 0 6px; text-align: center; }
.sent p { margin: 0; font-size: 1.1rem; font-weight: 600; }

/* Très étroit : prénom et nom l'un sous l'autre */
@media (max-width: 360px) {
  .row { grid-template-columns: 1fr; }
}
/* Paysage téléphone : les trois champs courts sur une ligne */
@media (orientation: landscape) and (max-height: 500px) {
  .form { display: grid; grid-template-columns: 1fr 1fr 1.4fr; grid-template-rows: auto 1fr auto auto; }
  .row { display: contents; }
  .grow { grid-column: 1 / -1; }
  .widget, .error, .actions { grid-column: 1 / -1; }
}
</style>
