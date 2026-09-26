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

function TxCard({ t, userId, onAct, onAccept }) {
  const v = viewOf(t, userId)
  const invited = !v.iAmCreator && t.status === 'Waiting'
  const waitingNote = t.status === 'Waiting'
    ? v.iAmCreator ? 'Waiting for the other party to accept' : 'Sent to you — accept to proceed'
    : null
  return (
    <article className="tx">
      <div>
        <div className="tx-top">
          <span className="tx-code">{t.code}</span>
          <span className={'status s-' + t.status}>{STATUS_LABEL[t.status]}</span>
          <span className="role">You: {v.role}</span>
        </div>
        <div className="tx-desc">{t.description}</div>
        <div className="tx-meta">
          <span>Counterparty <PartyName email={v.counterparty} /></span>
          <span>Updated {fmtDate(t.updated_at)}</span>
          {waitingNote && <span>{waitingNote}</span>}
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
