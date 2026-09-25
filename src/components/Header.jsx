export default function Header({ title, children }) {
  return (
    <header className="bar">
      <div className="brand">
        <div className="lock" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <span>{title}</span>
      </div>
      <div className="who">{children}</div>
    </header>
  )
}
