import { createRouter, createWebHashHistory } from 'vue-router'

// Hash history : GitHub Pages ne sait pas réécrire les URL d'une SPA.
export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'menu', component: () => import('./features/reading/views/MenuView.vue') },
    { path: '/play', name: 'play', component: () => import('./features/reading/views/GameView.vue') },
    { path: '/scores', name: 'scores', component: () => import('./features/editor/views/ScoresView.vue') },
    { path: '/scores/:id', name: 'editor', component: () => import('./features/editor/views/EditorView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
