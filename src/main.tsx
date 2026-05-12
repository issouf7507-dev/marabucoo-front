import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Applique le thème sauvegardé avant le premier render pour éviter le flash
const savedTheme = localStorage.getItem('marabu_theme');
if (savedTheme === 'light') document.documentElement.dataset.theme = 'light';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
