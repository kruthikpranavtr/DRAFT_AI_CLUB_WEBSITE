import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// In local shared-preview mode the remote backend sets Secure session cookies.
// Browsers accept those on localhost, but may reject them on 127.0.0.1.
// Use one stable local origin so sessions survive refresh and browser restarts.
if (import.meta.env.MODE === 'preview-local' && window.location.hostname === '127.0.0.1') {
  const url = new URL(window.location.href)
  url.hostname = 'localhost'
  window.location.replace(url.href)
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
