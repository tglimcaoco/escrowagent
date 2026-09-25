import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SetPassword({ onDone }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (pw.length < 8) return setErr('Use a password of at least 8 characters.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setErr(error.message)
    else onDone()
  }

  return (
    <section className="auth">
      <div className="auth-inner">
        <h1>Set a new password</h1>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="npw">New password</label>
            <input id="npw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div className="err" role="alert">{err}</div>
          <button className="btn" type="submit" disabled={busy}>Save password</button>
        </form>
      </div>
    </section>
  )
}
