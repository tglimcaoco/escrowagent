import { STATUSES, STATUS_LABEL, emptyMatrix, fmtDate, peso, viewOf } from '../lib/format'
import { useEffect, useRef, useState } from 'react'
import StatusRoleTable from '../components/StatusRoleTable'
import PartyName from '../components/PartyName'

export default function Dashboard({ rows, userId, filter, setFilter, onAct, onAccept }) {
  const [fundingTx, setFundingTx] = useState(null)
  const all = rows || []
  const shown = sortForUser(all.filter((t) => filter === 'All' || t.status === filter), userId)
  const matrix = emptyMatrix()
  for (const t of all) matrix[t.status][viewOf(t, userId).role] += 1
  const count = (s) => (s === 'All' ? all.length : all.filter((t) => t.status === s).length)
  return (
    <section>
      {rows && rows.length > 0 && (
        <div className="panel summary">
          <h2>Your summary</h2>
          <p className="sub">Your transactions by status and by your role. Tap a status to show those transactions.</p>
          <StatusRoleTable counts={matrix} onPick={setFilter} />
        </div>
      )}
      <div className="dash-head">
        <h2>Your transactions</h2>
        <div className="filters" role="group" aria-label="Filter by status">
          {['All', ...STATUSES].map((s) => (
            <button key={s} type="button" className="chip" aria-pressed={filter === s} onClick={() => setFilter(s)}>
              {s}{rows && <span className="count">{count(s)}</span>}
            </button>
          ))}
        </div>
      </div>
      {rows === null ? (
        <div className="empty">Loading your transactions…</div>
      ) : shown.length === 0 ? (
        <div className="empty">
          {filter === 'All'
            ? 'No transactions yet. Start one above, or enter a code someone sent you.'
            : `No ${filter.toLowerCase()} transactions.`}
        </div>
      ) : (
        <div className="list">
          {shown.map((t) => <TxCard key={t.code} t={t} userId={userId} onAct={onAct} onAccept={onAccept} onHowToFund={setFundingTx} />)}
        </div>
      )}
      <FundingInstructions t={fundingTx} onClose={() => setFundingTx(null)} />
    </section>
  )
}

// ---- How to send funds -------------------------------------------------
// Placeholders until the escrow account and QR code are finalised.
const ESCROW_ACCOUNT = 'XXXX'
const ESCROW_QR_SRC = null // e.g. '/escrow-qr.png' once the QR image is added to the public folder

function FundingInstructions({ t, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (t && !d.open) d.showModal()
    if (!t && d.open) d.close()
  }, [t])

  return (
    <dialog ref={ref} aria-labelledby="fund-title" onCancel={(e) => { e.preventDefault(); onClose() }}>
      {t && (
        <>
          <h3 id="fund-title">How to send funds</h3>
          <p style={{ color: 'var(--ink)' }}>
            Send funds to BPI account {ESCROW_ACCOUNT} or use this QR code to transfer <b className="num">{peso.format(t.amount)}</b>.
          </p>
          <div
            style={{
              width: 180, height: 180, margin: '0 auto 18px', borderRadius: 12,
              border: ESCROW_QR_SRC ? '0' : '2px dashed var(--line)',
              display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: '.85rem',
            }}
          >
            {ESCROW_QR_SRC
              ? <img src={ESCROW_QR_SRC} alt={`QR code to transfer ${peso.format(t.amount)} to escrow`} style={{ width: '100%', height: '100%' }} />
              : 'QR code'}
          </div>
          <p style={{ fontSize: '.85rem', margin: '0 0 18px' }}>Transaction {t.code}</p>
          <div className="dlg-actions">
            <button className="btn" type="button" onClick={onClose} autoFocus>Close</button>
          </div>
        </>
      )}
    </dialog>
  )
}

const STATUS_ORDER = ['Waiting', 'Pending', 'Funded', 'Completed', 'Refunded', 'Cancelled']

// Transactions needing the user's action come first (Waiting, Pending, Funded),
// then the rest (Waiting, Pending, Funded, Completed, Refunded, Cancelled).
// Within a group, the most recently updated stays on top.
function sortForUser(list, userId) {
  const key = (t) => {
    const acts = nextStep(t, viewOf(t, userId))?.tone === 'act'
    return (acts ? 0 : 10) + STATUS_ORDER.indexOf(t.status)
  }
  return list
    .map((t, i) => ({ t, i, k: key(t) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.t)
}

function Track({ status }) {
  const order = ['Waiting', 'Pending', 'Funded', 'Completed']
  let n = order.indexOf(status) + 1
  let cls = 'track'
  if (status === 'Cancelled') { n = 4; cls += ' bad' }
  if (status === 'Refunded') { n = 4; cls += ' ref' }
  return (
    <div className={cls} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => <i key={i} className={i < n ? 'on' : ''} />)}
    </div>
  )
}

// What this transaction means for the signed-in user, by status and role.
// tone "act" = the user needs to do something; "info" = nothing needed from them.
function nextStep(t, v) {
  const buyer = v.role === 'Buyer'
  switch (t.status) {
    case 'Waiting':
      return v.iAmCreator
        ? { tone: 'info', text: 'Waiting for the other party to accept' }
        : { tone: 'act', text: 'Sent to you — accept to proceed' }
    case 'Pending':
      return buyer
        ? { tone: 'act', text: 'Waiting for you to send funds to escrow' }
        : { tone: 'info', text: 'Waiting for Buyer to send funds to escrow' }
    case 'Funded':
      return buyer
        ? { tone: 'act', text: 'Release payment when Seller has delivered' }
        : { tone: 'act', text: 'Refund payment to Buyer if you are unable to deliver' }
    case 'Completed':
      return { tone: 'info', text: 'Transaction successfully completed with payment released to Seller' }
    case 'Refunded':
      return { tone: 'info', text: 'Transaction refunded by Seller to Buyer' }
    case 'Cancelled':
      return { tone: 'info', text: 'This transaction was cancelled' }
    default:
      return null
  }
}

function TxCard({ t, userId, onAct, onAccept, onHowToFund }) {
  const v = viewOf(t, userId)
  const invited = !v.iAmCreator && t.status === 'Waiting'
  const next = nextStep(t, v)
  return (
    <article className="tx">
      <div>
        <div className="tx-top">
          <span className="tx-code">{t.code}</span>
          <span className={'status s-' + t.status}>{STATUS_LABEL[t.status]}</span>
          <span className="role">You: {v.role}</span>
        </div>
        {next && <div className={'tx-next ' + next.tone}>{next.text}</div>}
        <div className="tx-desc">{t.description}</div>
        <div className="tx-meta">
          <span>{v.role === 'Buyer' ? 'Seller' : 'Buyer'} ID <PartyName email={v.counterparty} /></span>
          <span>Updated {fmtDate(t.updated_at)}</span>
        </div>
      </div>
      <div className="tx-right">
        <div className="tx-amt num">{peso.format(t.amount)}</div>
        <div className="tx-actions">
          {invited && <button className="btn small" type="button" onClick={() => onAccept(t, v.role)}>Accept</button>}
          {t.status === 'Pending' && v.role === 'Buyer' && (
            <button className="btn small" type="button" onClick={() => onHowToFund(t)}>How to send funds</button>
          )}
          {(t.status === 'Waiting' || t.status === 'Pending') && (
            <button className="btn danger small" type="button" onClick={() => onAct(t, 'cancel')}>Cancel</button>
          )}
          {t.status === 'Funded' && v.role === 'Buyer' && (
            <button className="btn release small" type="button" onClick={() => onAct(t, 'release')}>Release Payment</button>
          )}
          {t.status === 'Funded' && v.role === 'Seller' && (
            <button className="btn return small" type="button" onClick={() => onAct(t, 'return')}>Return Payment</button>
          )}
        </div>
      </div>
      <Track status={t.status} />
    </article>
  )
}
