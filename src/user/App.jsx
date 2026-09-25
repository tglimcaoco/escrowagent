import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTransactions } from '../lib/useTransactions'
import { errMsg, peso } from '../lib/format'
import { useConfirm, useToast } from '../components/feedback'
import Header from '../components/Header'
import CreateForm from './CreateForm'
import AcceptForm from './AcceptForm'
import Dashboard from './Dashboard'

const ACTIONS = {
  cancel: {
    title: 'Cancel this transaction?',
    body: "The other party will see it as Cancelled. This can't be undone from your dashboard.",
    yes: 'Cancel transaction', danger: true, done: 'Transaction cancelled.',
  },
  release: {
    title: 'Release payment to the seller?',
    body: "Only release once you've received what you paid for. The escrowed funds go to the seller.",
    yes: 'Release Payment', done: 'Payment released. Transaction completed.',
  },
  return: {
    title: 'Return payment to the buyer?',
    body: 'The escrowed funds go back to the buyer and the deal is closed.',
    yes: 'Return Payment', done: 'Payment returned. Transaction refunded.',
  },
}

export default function App({ session }) {
  const user = session.user
  const email = (user.email || '').toLowerCase()
  const { rows, error, reload } = useTransactions('user-txns')
  const [dialog, confirm] = useConfirm()
  const [toastEl, toast] = useToast()
  const [filter, setFilter] = useState('All')

  async function accept(t) {
    const { error } = await supabase.rpc('accept_transaction', { p_code: t.code })
    if (error) {
      toast(errMsg(error))
      return false
    }
    toast(`Accepted. ${t.code} is now Pending.`)
    reload()
    return true
  }

  async function confirmAccept(t, role) {
    const ok = await confirm({
      title: `Accept ${t.code}?`,
      body: `You'll join as the ${role.toLowerCase()} for ${peso.format(t.amount)}: ${t.description}`,
      yes: 'Accept',
    })
    if (ok) await accept(t)
  }

  async function act(t, action) {
    const a = ACTIONS[action]
    const ok = await confirm({ title: a.title, body: `${t.code}, ${peso.format(t.amount)}. ${a.body}`, yes: a.yes, danger: a.danger })
    if (!ok) return
    const { error } = await supabase.rpc('update_my_transaction', { p_code: t.code, p_action: action })
    if (error) toast(errMsg(error))
    else { toast(a.done); reload() }
  }

  return (
    <div className="wrap">
      <Header title="EscrowAgent">
        <span>{email}</span>
        <button className="btn ghost small" type="button" onClick={() => supabase.auth.signOut()}>Log out</button>
      </Header>
      <main>
        <div className="grid2">
          <section className="panel">
            <h2>Start a transaction</h2>
            <p className="sub">You'll get a code to send to the other party.</p>
            <CreateForm myEmail={email} onCreated={reload} />
          </section>
          <section className="panel">
            <h2>Join with a code</h2>
            <p className="sub">Got a code? Enter it to accept your role.</p>
            <AcceptForm userId={user.id} myEmail={email} onAccept={accept} />
          </section>
        </div>
        {error && <div className="banner">Couldn't load your transactions: {error}</div>}
        <Dashboard
          rows={rows}
          userId={user.id}
          filter={filter}
          setFilter={setFilter}
          onAct={act}
          onAccept={confirmAccept}
        />
        <p className="note">Status moves to Funded once the administrator confirms the buyer's payment has been received into escrow.</p>
      </main>
      {dialog}
      {toastEl}
    </div>
  )
}
