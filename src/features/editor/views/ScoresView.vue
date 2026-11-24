<script setup lang="ts">
import { useRouter } from 'vue-router'
import { mdiArrowLeft, mdiDeleteOutline, mdiPlus } from '@mdi/js'
import BrandMark from '@/components/BrandMark.vue'
import FullscreenToggle from '@/components/FullscreenToggle.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { createScore, TEMPLATES, type TemplateId } from '../templates'
import { useRemoveScore, useSaveScore, useScoresList } from '../queries'

const router = useRouter()
const { data: scores, isPending } = useScoresList()
const save = useSaveScore()
const remove = useRemoveScore()

async function create(t: TemplateId) {
  const label = TEMPLATES.find((x) => x.id === t)?.label ?? 'Partition'
  const saved = await save.mutateAsync(createScore(t, `${label} ${(scores.value?.length ?? 0) + 1}`))
  router.push({ name: 'editor', params: { id: saved.id } })
}

function confirmRemove(id: string, title: string) {
  if (window.confirm(`Supprimer « ${title} » ? Cette action est définitive.`)) remove.mutate(id)
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <div class="scores">
    <header class="topbar">
      <router-link :to="{ name: 'home' }" class="brand" aria-label="Accueil">
        <v-icon :icon="mdiArrowLeft" size="20" /><BrandMark /><span>Écrire</span>
      </router-link>
      <div class="topbar-actions"><FullscreenToggle /><ThemeToggle /></div>
    </header>

    <main class="grid">
      <section>
        <h2 class="kicker">Nouvelle partition</h2>
        <div class="templates">
          <button
            v-for="t in TEMPLATES"
            :key="t.id"
            type="button"
            class="template"
            :disabled="save.isPending.value"
            @click="create(t.id)"
          >
            <span class="lines" aria-hidden="true">
              <i v-for="k in t.staves.length" :key="k" />
            </span>
            <b>{{ t.label }}</b>
            <span class="hint">{{ t.hint }}</span>
            <v-icon class="plus" :icon="mdiPlus" size="18" />
          </button>
        </div>
      </section>

      <section>
        <h2 class="kicker">Mes partitions</h2>
        <p v-if="isPending" class="empty">Chargement…</p>
        <p v-else-if="!scores?.length" class="empty">Aucune partition pour l'instant. Choisis un modèle pour commencer.</p>
        <ul v-else class="list">
          <li v-for="s in scores" :key="s.id" class="item card">
            <router-link :to="{ name: 'editor', params: { id: s.id } }" class="open">
              <b>{{ s.title }}</b>
              <span class="meta mono">{{ s.staves }} portée{{ s.staves > 1 ? 's' : '' }} · {{ dateFmt.format(s.updatedAt) }}</span>
            </router-link>
            <button
              type="button"
              class="del"
              :aria-label="`Supprimer ${s.title}`"
              title="Supprimer"
              @click="confirmRemove(s.id, s.title)"
            >
              <v-icon :icon="mdiDeleteOutline" size="20" />
            </button>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
.scores {
  min-height: 100dvh; max-width: 1100px; margin: 0 auto;
  padding: 0 max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
}
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; }
.topbar-actions { display: flex; gap: 8px; }
.brand {
  display: inline-flex; align-items: center; gap: 10px; font-weight: 800; font-size: 1.25rem;
  letter-spacing: -0.02em; color: var(--ink); text-decoration: none;
}
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 32px; align-items: start; }
h2 { margin-bottom: 10px; }
.templates { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.template {
  position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left;
  border: 2px solid var(--ink); border-radius: 14px; background: var(--card); color: var(--ink);
  box-shadow: 0 3px 0 var(--ink); padding: 10px 12px; font: inherit; cursor: pointer;
  transition: transform 0.08s, box-shadow 0.08s;
}
.template:active { transform: translateY(3px); box-shadow: 0 0 0 var(--ink); }
.template:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.template .hint { color: var(--ink-2); font-size: 0.85rem; }
.template .plus { position: absolute; top: 10px; right: 10px; color: var(--accent); }
.lines { display: flex; flex-direction: column; gap: 3px; width: 46px; margin-bottom: 6px; }
.lines i { display: block; height: 4px; border-top: 1px solid var(--ink-2); border-bottom: 1px solid var(--ink-2); }
.empty { color: var(--ink-2); margin: 0; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.item { display: flex; align-items: center; }
.open {
  flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 10px 14px; color: var(--ink); text-decoration: none;
}
.open b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { font-size: 0.75rem; color: var(--ink-2); }
.del {
  width: 44px; height: 44px; margin-right: 6px; border: 0; border-radius: 10px; background: transparent;
  color: var(--ink-2); cursor: pointer; display: grid; place-items: center;
}
.del:hover { color: var(--bad); background: var(--paper-2); }
@media (max-width: 700px) and (orientation: portrait) {
  .grid { grid-template-columns: 1fr; }
}
@media (orientation: landscape) and (max-height: 500px) {
  .topbar { padding: 6px 0; }
  .templates { grid-template-columns: repeat(4, 1fr); }
  .grid { grid-template-columns: 1fr; gap: 12px; }
}
</style>
