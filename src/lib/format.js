export const STATUSES = ['Waiting', 'Pending', 'Funded', 'Completed', 'Refunded', 'Cancelled']

// Identifiers stay short in the database; this is what people read on screen.
export const STATUS_LABEL = {
  Waiting: 'Waiting to be accepted',
  Pending: 'Pending funds from buyer',
  Funded: 'Escrow funded by buyer',
  Completed: 'Completed',
  Refunded: 'Refunded',
  Cancelled: 'Cancelled',
}

export const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : ''

export const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

export const normEmail = (s) => String(s || '').trim().toLowerCase()

// Accepts "ea7k3mq9xp", "EA-7K3M-Q9XP", "7K3M Q9XP" ... returns "EA-7K3M-Q9XP" or null.
export function normCode(s) {
  const raw = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const body = raw.length === 10 && raw.startsWith('EA') ? raw.slice(2) : raw
  return body.length === 8 ? `EA-${body.slice(0, 4)}-${body.slice(4)}` : null
}

// The signed-in user's view of a transaction.
export function viewOf(t, userId) {
  const iAmCreator = t.creator_id === userId
  const role = iAmCreator ? t.creator_role : t.creator_role === 'Buyer' ? 'Seller' : 'Buyer'
  const counterparty = iAmCreator ? t.counterparty_email : t.creator_email
  return { iAmCreator, role, counterparty }
}

export const buyerOf = (t) => (t.creator_role === 'Buyer' ? t.creator_email : t.counterparty_email)
export const sellerOf = (t) => (t.creator_role === 'Seller' ? t.creator_email : t.counterparty_email)

export const errMsg = (e) => (e && e.message) || 'Something went wrong. Try again.'
