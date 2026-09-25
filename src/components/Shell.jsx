import { configured } from '../lib/supabase'
import { useSession } from '../lib/useSession'
import Auth from './Auth'
import Header from './Header'
import SetPassword from './SetPassword'

// Handles configuration, loading, login, and password recovery, then
// hands the signed-in session to the program.
export default function Shell({ title, authHeading, authLede, allowJoin, children }) {
  if (!configured) {
    return (
      <div className="wrap">
        <Header title={title} />
        <div className="banner">
          Supabase isn't connected. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (in .env.local locally, or in Vercel's
          Environment Variables), then rebuild.
        </div>
      </div>
    )
  }
  return <Connected {...{ title, authHeading, authLede, allowJoin }}>{children}</Connected>
}

function Connected({ title, authHeading, authLede, allowJoin, children }) {
  const { session, recovery, clearRecovery } = useSession()
  let body
  if (session === undefined) body = <div className="center">Opening your escrow ledger…</div>
  else if (recovery && session) body = <SetPassword onDone={clearRecovery} />
  else if (!session) body = <Auth heading={authHeading} lede={authLede} allowJoin={allowJoin} />
  else return children(session)
  return (
    <div className="wrap">
      <Header title={title} />
      <main>{body}</main>
    </div>
  )
}
