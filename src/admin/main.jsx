import React from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import Shell from '../components/Shell'
import AdminApp from './AdminApp'

document.body.classList.add('admin-mode')

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Shell
      title="EscrowAgent Admin"
      authHeading="Administrator console"
      authLede="Log in with an administrator account to review every escrow and update its status."
      allowJoin={false}
    >
      {(session) => <AdminApp session={session} />}
    </Shell>
  </React.StrictMode>
)
