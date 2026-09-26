import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUSES, STATUS_LABEL } from '../lib/format'

// Counts are cached briefly so hovering back and forth doesn't re-query.
const cache = new Map() // email -> { at, counts }
const FRESH_MS = 30000

async function fetchCounts(email) {
  const hit = cache.get(email)
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.counts
  const { data, error } = await supabase.rpc('user_status_counts', { p_email: email })
  if (error) throw error
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]))
  for (const r of data || []) counts[r.status] = Number(r.total)
  cache.set(email, { at: Date.now(), counts })
  return counts
}

// An email that shows the person's transaction summary on hover (mouse)
// or tap (phone), and on keyboard focus.
export default function PartyName({ email }) {
  const [open, setOpen] = useState(false)
  const [counts, setCounts] = useState(null)
  const [err, setErr] = useState('')
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const pop = useRef(null)
  const lastPointer = useRef('mouse')
  const timer = useRef(null)

  const show = () => {
    setOpen(true)
    setErr('')
    fetchCounts(email).then(setCounts).catch((e) => setErr(e.message || "Couldn't load the summary."))
  }
  const hide = () => { clearTimeout(timer.current); setOpen(false) }
  // Mouse: a short grace period lets the pointer travel from the name onto the card.
  const hideSoon = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 180) }
  const keep = () => clearTimeout(timer.current)
  useEffect(() => () => clearTimeout(timer.current), [])

  // Place the card under the name, kept inside the screen (fixed, so tables can't clip it).
  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const w = pop.current ? pop.current.offsetWidth : 250
    const h = pop.current ? pop.current.offsetHeight : 200
    const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12))
    const below = r.bottom + 6
    const top = below + h > window.innerHeight - 12 ? Math.max(12, r.top - h - 6) : below
    setPos({ left, top })
  }, [open, counts, err])

  // Close on outside tap, Escape, or scroll.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!btn.current?.contains(e.target) && !pop.current?.contains(e.target)) hide() }
    const onKey = (e) => { if (e.key === 'Escape') hide() }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', hide, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', hide, true)
    }
  }, [open])

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0

  return (
    <span className="party">
      <button
        ref={btn}
        type="button"
        className="party-name"
        aria-expanded={open}
        aria-label={`${email}, show transaction summary`}
        onPointerDown={(e) => { lastPointer.current = e.pointerType }}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') { keep(); if (!open) show() } }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') hideSoon() }}
        onFocus={() => { if (lastPointer.current !== 'touch') show() }}
        onBlur={(e) => { if (!pop.current?.contains(e.relatedTarget)) hide() }}
        onClick={() => { if (lastPointer.current !== 'mouse') (open ? hide() : show()) }}
      >
        {email}
      </button>
      {open && (
        <div
          ref={pop}
          className="party-pop"
          role="tooltip"
          style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') keep() }}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') hideSoon() }}
        >
          <h4>{email}</h4>
          {err ? (
            <p className="party-err">{err}</p>
          ) : !counts ? (
            <p className="party-muted">Loading…</p>
          ) : (
            <>
              <p className="party-muted">{total} transaction{total === 1 ? '' : 's'} on EscrowAgent</p>
              <ul>
                {STATUSES.map((s) => (
                  <li key={s} className={counts[s] ? '' : 'zero'}>
                    <span className={'status s-' + s}>{STATUS_LABEL[s]}</span>
                    <b className="num">{counts[s]}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </span>
  )
}
