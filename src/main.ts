import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import './styles/main.scss'

createApp(App).use(router).use(vuetify).use(VueQueryPlugin).mount('#app')
