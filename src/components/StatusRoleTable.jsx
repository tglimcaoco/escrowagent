import { STATUSES, STATUS_LABEL } from '../lib/format'

// Counts by status (rows) and role (columns), with totals.
export default function StatusRoleTable({ counts, onPick }) {
  const tot = { Buyer: 0, Seller: 0 }
  for (const s of STATUSES) { tot.Buyer += counts[s].Buyer; tot.Seller += counts[s].Seller }
  const cell = (n) => <td className={'num' + (n ? '' : ' zero')}>{n}</td>
  return (
    <div className="srt-wrap">
      <table className="srt">
        <thead>
          <tr><th scope="col">Status</th><th scope="col">As buyer</th><th scope="col">As seller</th><th scope="col">Total</th></tr>
        </thead>
        <tbody>
          {STATUSES.map((s) => {
            const { Buyer, Seller } = counts[s]
            const label = <span className={'status s-' + s}>{STATUS_LABEL[s]}</span>
            return (
              <tr key={s}>
                <th scope="row">
                  {onPick ? <button type="button" className="srt-pick" onClick={() => onPick(s)} aria-label={`Show ${STATUS_LABEL[s]} transactions`}>{label}</button> : label}
                </th>
                {cell(Buyer)}{cell(Seller)}{cell(Buyer + Seller)}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr><th scope="row">All</th>{cell(tot.Buyer)}{cell(tot.Seller)}{cell(tot.Buyer + tot.Seller)}</tr>
        </tfoot>
      </table>
    </div>
  )
}
