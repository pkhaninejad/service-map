import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LicenseProvider } from './license/LicenseProvider'
import { LicenseGate } from './license/LicenseGate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LicenseProvider>
      <LicenseGate>
        <App />
      </LicenseGate>
    </LicenseProvider>
  </StrictMode>,
)
