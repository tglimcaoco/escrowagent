import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTransactions } from '../lib/useTransactions'
import { STATUSES, STATUS_LABEL, buyerOf, errMsg, fmtDate, peso, sellerOf } from '../lib/format'
import { useConfirm, useToast } from '../components/feedback'
import Header from '../components/Header'
import PartyName from '../components/PartyName'

export default function AdminApp({ session }) {
  const [isAdmin, setIsAdmin] = useState(null)

  useEffect(() => {
    supabase.rpc('is_admin').then(({ data, error }) => setIsAdmin(!error && data === true))
  }, [session.user.id])

  const header = (
    <Header title="EscrowAgent Admin">
      <span>{session.user.email}</span>
      <button className="btn ghost small" type="button" onClick={() => supabase.auth.signOut()}>Log out</button>
    </Header>
  )

  if (isAdmin === null) return <div className="wrap">{header}<div className="center">Checking your access…</div></div>
  if (!isAdmin) {
    return (
      <div className="wrap">
        {header}
        <div className="center">
          <div>
            <h2>This account isn't an administrator</h2>
            <p>Ask an existing administrator to add {session.user.email}, or log in with an administrator account.</p>
          </div>
        </div>
      </div>
    )
  }
  return <Ledger header={header} />
}

function Ledger({ header }) {
  const { rows, error, reload } = useTransactions('admin-txns')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [dialog, confirm] = useConfirm()
  const [toastEl, toast] = useToast()

  const all = rows || []
  const stats = useMemo(() => {
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]))
    let held = 0
    for (const t of all) {
      counts[t.status] += 1
      if (t.status === 'Funded') held += Number(t.amount)
    }
    return { counts, held }
  }, [all])

  const q = query.trim().toLowerCase()
  const shown = all.filter((t) =>
    (filter === 'All' || t.status === filter) &&
    (!q || [t.code, t.creator_email, t.counterparty_email, t.description].some((x) => String(x || '').toLowerCase().includes(q))))

  async function setStatus(t, to, note) {
    const ok = await confirm({
      title: `Set ${t.code} to “${STATUS_LABEL[to]}”?`,
      body: `Currently “${STATUS_LABEL[t.status]}”. Both parties will see the new status immediately.`,
      yes: 'Update status',
      danger: to === 'Cancelled' || to === 'Refunded',
    })
    if (!ok) return false
    const { error } = await supabase.rpc('admin_set_status', { p_code: t.code, p_status: to, p_note: note || null })
    if (error) { toast(errMsg(error)); return false }
    toast(`${t.code}: ${STATUS_LABEL[to]}.`)
    reload()
    return true
  }

  return (
    <div className="wrap">
      {header}
      <main>
        <div className="adm-head">
          <div>
            <h2>Transaction ledger</h2>
            <p>Every escrow across all users. Set a status here and both parties see it immediately.</p>
          </div>
        </div>
        {error && <div className="banner">Couldn't load transactions: {error}</div>}
        <div className="adm-stats">
          <span><b className="num">{all.length}</b>transactions</span>
          {STATUSES.map((s) => <span key={s}><b className="num">{stats.counts[s]}</b>{s}</span>)}
          <span><b className="num">{peso.format(stats.held)}</b>held in escrow</span>
        </div>
        <div className="adm-tools">
          <input type="text" placeholder="Search code, email or description" aria-label="Search transactions" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="All">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>{['Code', 'Buyer', 'Seller', 'Description', 'Amount', 'Status', 'Change status'].map((h) => <th key={h} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: '#B7AEC7' }}>Loading…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: '#B7AEC7' }}>{all.length ? 'No transactions match.' : 'No transactions yet.'}</td></tr>
              ) : (
                shown.map((t) => <Row key={t.code} t={t} onSet={setStatus} />)
              )}
            </tbody>
          </table>
        </div>
      </main>
      {dialog}
      {toastEl}
    </div>
  )
}

function Row({ t, onSet }) {
  const [to, setTo] = useState(t.status)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setTo(t.status), [t.status])

  async function update() {
    setBusy(true)
    const ok = await onSet(t, to, note.trim())
    setBusy(false)
    if (ok) setNote('')
  }

  return (
    <tr>
      <td><span className="tx-code">{t.code}</span><div className="hist">{fmtDate(t.created_at)}</div></td>
      <td><PartyName email={buyerOf(t)} /></td>
      <td><PartyName email={sellerOf(t)} /></td>
      <td>{t.description}<History code={t.code} updatedAt={t.updated_at} /></td>
      <td className="num">{peso.format(t.amount)}</td>
      <td><span className={'status s-' + t.status}>{STATUS_LABEL[t.status]}</span></td>
      <td>
        <div className="adm-row-actions">
          <select aria-label={'New status for ' + t.code} value={to} onChange={(e) => setTo(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <input type="text" placeholder="Note (optional)" aria-label={'Note for ' + t.code} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="adm-btn" type="button" disabled={busy || to === t.status} onClick={update}>Update</button>
        </div>
      </td>
    </tr>
  )
}

// Loads the status history only when the administrator opens it.
function History({ code, updatedAt }) {
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState(null)

  useEffect(() => {
    if (!open) return
    supabase
      .from('transaction_events')
      .select('*')
      .eq('code', code)
      .order('created_at', { ascending: false })
      .then(({ data }) => setEvents(data || []))
  }, [open, code, updatedAt])

  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>History</summary>
      {open && (
        <ul className="hist">
          {events === null ? <li>Loading…</li> : events.map((h) => (
            <li key={h.id}>
              {fmtDate(h.created_at)}: {h.from_status || '—'} → {h.to_status} by {h.by_admin ? 'admin ' : ''}{h.actor_email}
              {h.note ? ` (${h.note})` : ''}
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
