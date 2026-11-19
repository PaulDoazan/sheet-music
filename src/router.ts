import { createRouter, createWebHashHistory } from 'vue-router'

// Hash history : GitHub Pages ne sait pas réécrire les URL d'une SPA.
export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'menu', component: () => import('./features/reading/views/MenuView.vue') },
    { path: '/play', name: 'play', component: () => import('./features/reading/views/GameView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
