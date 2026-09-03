import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return <div className="page-header">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
}

export function Panel({ title, subtitle, action, className = '', children }: { title?: string; subtitle?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return <section className={`panel ${className}`}>
    {(title || action) && <div className="panel-head"><div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>{action}</div>}
    <div className="panel-body">{children}</div>
  </section>
}

export function Metric({ icon, value, label, note, tone = 'blue' }: { icon: ReactNode; value: ReactNode; label: string; note?: string; tone?: 'blue'|'green'|'amber'|'purple'|'red' }) {
  return <div className="metric"><div className={`metric-icon ${tone}`}>{icon}</div><div><strong>{value}</strong><span>{label}</span>{note && <small>{note}</small>}</div></div>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral'|'green'|'amber'|'red'|'blue'|'purple' }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-orb"/><h3>{title}</h3><p>{description}</p>{action}</div>
}

export function Modal({ title, subtitle, onClose, children, wide = false, className = '' }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean; className?: string }) {
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className={`modal ${wide ? 'wide' : ''} ${className}`} role="dialog" aria-modal="true">
      <div className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>
      <div className="modal-body">{children}</div>
    </div>
  </div>
}

export function Drawer({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <aside className="drawer"><div className="drawer-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div><div className="drawer-body">{children}</div></aside>
  </div>
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return <div className="skeleton-list">{Array.from({ length: count }, (_, i) => <div className="skeleton" key={i}/>)}</div>
}
