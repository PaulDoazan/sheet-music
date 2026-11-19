import 'vuetify/styles'
import { createVuetify, type ThemeDefinition } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

// Charte reprise de big-or-small (papier crème, encre, accent orange), déclinée en sombre.
const light: ThemeDefinition = {
  dark: false,
  colors: {
    background: '#f6f1e7',
    surface: '#fffdf8',
    'surface-variant': '#efe7d8',
    'on-surface-variant': '#1d1b2f',
    'on-background': '#1d1b2f',
    'on-surface': '#1d1b2f',
    primary: '#ff5a36',
    'on-primary': '#ffffff',
    success: '#18a957',
    error: '#d93a2b',
    ink: '#1d1b2f',
    'ink-2': '#5c5873',
    line: '#e2d8c6',
    paper: '#f6f1e7',
    'paper-2': '#efe7d8',
    card: '#fffdf8',
    dot: '#1d1b2f',
  },
}

const dark: ThemeDefinition = {
  dark: true,
  colors: {
    background: '#16151f',
    surface: '#1f1d2c',
    'surface-variant': '#2a2839',
    'on-surface-variant': '#f6f1e7',
    'on-background': '#f6f1e7',
    'on-surface': '#f6f1e7',
    primary: '#ff6a48',
    'on-primary': '#ffffff',
    success: '#1fbf65',
    error: '#ff5c5c',
    ink: '#f6f1e7',
    'ink-2': '#a9a5bd',
    line: '#3a374d',
    paper: '#16151f',
    'paper-2': '#2a2839',
    card: '#1f1d2c',
    dot: '#f6f1e7',
  },
}

export function initialTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem('sheet-music:theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default createVuetify({
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  theme: { defaultTheme: initialTheme(), themes: { light, dark } },
})
