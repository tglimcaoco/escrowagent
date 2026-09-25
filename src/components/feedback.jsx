import { useCallback, useEffect, useRef, useState } from 'react'

// const [dialog, confirm] = useConfirm();  await confirm({title, body, yes, danger})
export function useConfirm() {
  const ref = useRef(null)
  const resolver = useRef(null)
  const [opts, setOpts] = useState(null)

  const confirm = useCallback((o) => new Promise((res) => { resolver.current = res; setOpts(o) }), [])

  useEffect(() => {
    if (opts && ref.current && !ref.current.open) ref.current.showModal()
  }, [opts])

  const close = (v) => {
    ref.current?.close()
    resolver.current?.(v)
    resolver.current = null
    setOpts(null)
  }

  const dialog = (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); close(false) }}>
      {opts && (
        <>
          <h3>{opts.title}</h3>
          <p>{opts.body}</p>
          <div className="dlg-actions">
            <button className="btn ghost" type="button" onClick={() => close(false)}>Keep as is</button>
            <button className={'btn' + (opts.danger ? ' danger' : '')} type="button" onClick={() => close(true)}>{opts.yes}</button>
          </div>
        </>
      )}
    </dialog>
  )
  return [dialog, confirm]
}

// const [toastEl, toast] = useToast();  toast('Saved.')
export function useToast() {
  const [msg, setMsg] = useState(null)
  const timer = useRef(null)
  const toast = useCallback((m) => {
    clearTimeout(timer.current)
    setMsg(m)
    timer.current = setTimeout(() => setMsg(null), 3500)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const el = msg ? <div className="toast" role="status">{msg}</div> : null
  return [el, toast]
}
