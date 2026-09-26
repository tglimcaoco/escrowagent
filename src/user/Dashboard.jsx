import { STATUSES, STATUS_LABEL, emptyMatrix, fmtDate, peso, viewOf } from '../lib/format'
import StatusRoleTable from '../components/StatusRoleTable'
import PartyName from '../components/PartyName'

export default function Dashboard({ rows, userId, filter, setFilter, onAct, onAccept }) {
  const all = rows || []
  const shown = all.filter((t) => filter === 'All' || t.status === filter)
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
          {shown.map((t) => <TxCard key={t.code} t={t} userId={userId} onAct={onAct} onAccept={onAccept} />)}
        </div>
      )}
    </section>
  )
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

function TxCard({ t, userId, onAct, onAccept }) {
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
        <div className="tx-desc">{t.description}</div>
        {next && <div className={'tx-next ' + next.tone}>{next.text}</div>}
        <div className="tx-meta">
          <span>Counterparty <PartyName email={v.counterparty} /></span>
          <span>Updated {fmtDate(t.updated_at)}</span>
        </div>
      </div>
      <div className="tx-right">
        <div className="tx-amt num">{peso.format(t.amount)}</div>
        <div className="tx-actions">
          {invited && <button className="btn small" type="button" onClick={() => onAccept(t, v.role)}>Accept</button>}
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
