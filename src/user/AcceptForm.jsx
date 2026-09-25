import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { errMsg, normCode, peso, viewOf } from '../lib/format'

export default function AcceptForm({ userId, myEmail, onAccept }) {
  // A shared link like https://your-app.vercel.app/?code=EA-XXXX-XXXX pre-fills the code.
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('code') || '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState(null)

  async function lookup(e) {
    e?.preventDefault()
    setErr(''); setFound(null)
    const c = normCode(code)
    if (!c) return setErr('Codes look like EA-7K3M-Q9XP. Check the code and try again.')
    setBusy(true)
    const { data: t, error } = await supabase.from('transactions').select('*').eq('code', c).maybeSingle()
    setBusy(false)
    if (error) return setErr(errMsg(error))
    if (!t) return setErr(`No transaction with that code was sent to ${myEmail}. Check the code, or ask the sender which email they used.`)
    if (t.creator_id === userId) return setErr('You created this transaction. Share the code with the other party instead.')
    if (t.status !== 'Waiting') return setErr(`This transaction is already ${t.status.toLowerCase()}. It's on your dashboard.`)
    setFound(t)
  }

  useEffect(() => {
    if (code) lookup()
    // Run once for a code that arrived in the link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function accept() {
    setBusy(true)
    const ok = await onAccept(found)
    setBusy(false)
    if (ok) {
      setFound(null); setCode('')
      if (window.location.search) window.history.replaceState(null, '', window.location.pathname)
    }
  }

  const v = found && viewOf(found, userId)
  return (
    <form onSubmit={lookup} noValidate>
      <div className="field">
        <label htmlFor="code">Transaction code</label>
        <input id="code" type="text" autoComplete="off" autoCapitalize="characters" placeholder="EA-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <div className="err" role="alert">{err}</div>
      <button className="btn" type="submit" disabled={busy}>Find transaction</button>
      {found && (
        <div className="tx" style={{ marginTop: 16 }}>
          <div>
            <div className="tx-top">
              <span className="tx-code">{found.code}</span>
              <span className="role">You: {v.role}</span>
            </div>
            <div className="tx-desc">{found.description}</div>
            <div className="tx-meta"><span>From <b>{found.creator_email}</b></span></div>
          </div>
          <div className="tx-right">
            <div className="tx-amt num">{peso.format(found.amount)}</div>
            <button className="btn" type="button" disabled={busy} onClick={accept}>Accept as {v.role.toLowerCase()}</button>
          </div>
        </div>
      )}
    </form>
  )
}
