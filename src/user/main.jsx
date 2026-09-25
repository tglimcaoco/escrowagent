import React from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import Shell from '../components/Shell'
import App from './App'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Shell
      title="EscrowAgent"
      authHeading="Hold the money until both sides are happy."
      authLede="Log in or join with your email to open an escrow, share its code with the other party, and release payment only when the deal is done."
    >
      {(session) => <App session={session} />}
    </Shell>
  </React.StrictMode>
)
