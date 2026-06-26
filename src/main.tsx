import { scan } from 'react-scan'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  scan({
    enabled: true,
    log: true, 
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
