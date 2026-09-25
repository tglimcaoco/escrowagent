import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { errMsg, normEmail, validEmail } from '../lib/format'

export default function CreateForm({ myEmail, onCreated }) {
  const [role, setRole] = useState('Buyer')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [cp, setCp] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    const desc = description.trim()
    const amt = Math.round(parseFloat(amount) * 100) / 100
    const cpEmail = normEmail(cp)
    if (!desc) return setErr("Describe what's being bought or sold.")
    if (!(amt > 0)) return setErr('Enter an amount greater than zero.')
    if (!validEmail(cpEmail)) return setErr("Enter the other party's email address.")
    if (cpEmail === myEmail) return setErr('The other party must use a different email from yours.')
    setBusy(true)
    const { data: code, error } = await supabase.rpc('create_transaction', {
      p_role: role, p_description: desc, p_amount: amt, p_counterparty_email: cpEmail,
    })
    setBusy(false)
    if (error) return setErr(errMsg(error))
    setIssued({ code, cp: cpEmail })
    setRole('Buyer'); setDescription(''); setAmount(''); setCp('')
    onCreated()
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="roles" role="radiogroup" aria-label="Your role">
        {[
          ['Buyer', "I'm the buyer", "I'll fund the escrow"],
          ['Seller', "I'm the seller", "I'll deliver the goods"],
        ].map(([v, label, sub]) => (
          <div key={v}>
            <input type="radio" name="role" id={'r-' + v} value={v} checked={role === v} onChange={() => setRole(v)} />
            <label htmlFor={'r-' + v}>{label}<small>{sub}</small></label>
          </div>
        ))}
      </div>
      <div className="field">
        <label htmlFor="desc">What's the deal?</label>
        <textarea id="desc" maxLength={500} placeholder="e.g. 2019 Toyota Vios, plate ABC 1234, as inspected on 20 Sept" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="amt">Amount</label>
        <div className="amount-wrap">
          <span aria-hidden="true">₱</span>
          <input id="amt" type="number" min="1" step="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="cp">Other party's email</label>
        <input id="cp" type="email" autoComplete="off" placeholder="them@company.com" value={cp} onChange={(e) => setCp(e.target.value)} />
      </div>
      <div className="err" role="alert">{err}</div>
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create transaction'}</button>
      {issued && <Stub code={issued.code} cp={issued.cp} />}
    </form>
  )
}

function Stub({ code, cp }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    const link = `${window.location.origin}/?code=${code}`
    const text = `I've opened an escrow on EscrowAgent. Log in with ${cp} and enter code ${code} to accept it: ${link}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy this message:', text)
    }
  }
  return (
    <div className="stub" role="status">
      <div className="stub-main">
        <div className="lbl">Send this code to {cp}</div>
        <div className="stub-code">{code}</div>
      </div>
      <div className="stub-side">
        <button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
    </div>
  )
}
