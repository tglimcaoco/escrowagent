import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { normEmail, validEmail } from '../lib/format'

const here = () => window.location.origin + window.location.pathname

export default function Auth({ heading, lede, allowJoin = true }) {
  const [mode, setMode] = useState('login') // login | join | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const switchTo = (m) => { setMode(m); setErr(''); setInfo('') }

  async function submit(e) {
    e.preventDefault()
    setErr(''); setInfo('')
    const em = normEmail(email)
    if (!validEmail(em)) return setErr('Enter a valid email address, like name@company.com.')
    if (mode !== 'forgot' && password.length < 8) return setErr('Use a password of at least 8 characters.')
    setBusy(true)
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: here() })
        if (error) throw error
        setInfo('Check your email for a link to set a new password.')
      } else if (mode === 'join') {
        const { data, error } = await supabase.auth.signUp({
          email: em, password, options: { emailRedirectTo: here() },
        })
        if (error) throw error
        if (!data.session) setInfo(`We sent a confirmation link to ${em}. Open it, then log in here.`)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password })
        if (error) throw error
      }
    } catch (e) {
      const m = e.message || ''
      if (/invalid login credentials/i.test(m)) setErr("That email and password don't match. Try again or reset your password.")
      else if (/email not confirmed/i.test(m)) setErr('Confirm your email first — open the link we sent you, then log in.')
      else if (/rate limit/i.test(m)) setErr('Too many emails sent recently. Wait a few minutes and try again.')
      else setErr(m || 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="auth">
      <div className="auth-inner">
        <h1>{heading}</h1>
        <p className="lede">{lede}</p>
        {mode !== 'forgot' && allowJoin && (
          <div className="tabs" role="group" aria-label="Log in or join">
            <button type="button" className="chip" aria-pressed={mode === 'login'} onClick={() => switchTo('login')}>Log in</button>
            <button type="button" className="chip" aria-pressed={mode === 'join'} onClick={() => switchTo('join')}>Join</button>
          </div>
        )}
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="em">Email address</label>
            <input id="em" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            {mode === 'join' && <span className="hint">Transactions sent to this email will appear on your dashboard.</span>}
          </div>
          {mode !== 'forgot' && (
            <div className="field">
              <label htmlFor="pw">Password</label>
              <input id="pw" type="password" autoComplete={mode === 'join' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
              {mode === 'join' && <span className="hint">At least 8 characters.</span>}
            </div>
          )}
          <div className="err" role="alert">{err}</div>
          {info && <div className="info" role="status">{info}</div>}
          <button className="btn" type="submit" disabled={busy}>
            {mode === 'join' ? 'Join EscrowAgent' : mode === 'forgot' ? 'Send reset link' : 'Log in'}
          </button>
        </form>
        {mode === 'login' && <button type="button" className="linkbtn" onClick={() => switchTo('forgot')}>Forgot your password?</button>}
        {mode === 'forgot' && <button type="button" className="linkbtn" onClick={() => switchTo('login')}>Back to log in</button>}
      </div>
    </section>
  )
}
