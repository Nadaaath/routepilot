import { createContext, useContext, useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
type ToastItem = { id: number; message: string; kind: ToastKind }
type ToastContextValue = { push: (message: string, kind?: ToastKind) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = (message: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random()
    setItems((current) => [...current, { id, message, kind }])
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3500)
  }
  const value = useMemo(() => ({ push }), [])
  return <ToastContext.Provider value={value}>
    {children}
    <div className="toast-stack" aria-live="polite">
      {items.map((item) => <div className={`toast ${item.kind}`} key={item.id}>
        {item.kind === 'success' ? <CheckCircle2 size={18}/> : <CircleAlert size={18}/>}<span>{item.message}</span>
        <button aria-label="Dismiss" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}><X size={15}/></button>
      </div>)}
    </div>
  </ToastContext.Provider>
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside ToastProvider')
  return value
}
