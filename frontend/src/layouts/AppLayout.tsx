import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BusFront, CalendarClock, ChevronLeft, ChevronRight, ClipboardCheck, Command,
  Download, FileText, Gauge, MapPinned, Menu, Route, Search, Settings, Users, X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'

const groups = [
  { label: 'OPERATIONS', items: [
    { to: '/', label: 'Overview', icon: Gauge },
    { to: '/calendar', label: 'Calendar', icon: CalendarClock },
    { to: '/attendance', label: 'Attendance', icon: ClipboardCheck },
    { to: '/planning', label: 'Planning', icon: Route },
  ]},
  { label: 'RESOURCES', items: [
    { to: '/employees', label: 'Employees', icon: Users },
    { to: '/fleet', label: 'Fleet', icon: BusFront },
    { to: '/locations', label: 'Stops & Depots', icon: MapPinned },
    { to: '/shifts', label: 'Shifts', icon: CalendarClock },
  ]},
  { label: 'OUTPUTS', items: [
    { to: '/plans', label: 'Plans', icon: FileText },
    { to: '/exports', label: 'Exports', icon: Download },
  ]},
  { label: 'SYSTEM', items: [{ to: '/settings', label: 'Settings', icon: Settings }]},
]

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { employees, pickupPoints, vehicles, backendOnline } = useData()

  const current = useMemo(() => groups.flatMap((g) => g.items).find((n) => n.to === location.pathname)?.label ?? 'RoutePilot', [location.pathname])
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return [
      ...employees.filter((e) => `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(q)).slice(0, 4).map((e) => ({ label: `${e.firstName} ${e.lastName}`, sub: e.pickupPoint?.name ?? 'No pickup point', to: `/employees?focus=${e.id}`, type: 'Employee' })),
      ...pickupPoints.filter((p) => `${p.name} ${p.address ?? ''}`.toLowerCase().includes(q)).slice(0, 3).map((p) => ({ label: p.name, sub: p.address ?? 'Pickup point', to: `/locations?stop=${p.id}`, type: 'Stop' })),
      ...vehicles.filter((v) => `${v.name} ${v.registration}`.toLowerCase().includes(q)).slice(0, 3).map((v) => ({ label: v.name, sub: v.registration, to: `/fleet?focus=${v.id}`, type: 'Vehicle' })),
    ].slice(0, 8)
  }, [query, employees, pickupPoints, vehicles])

  return <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-mark"><Route size={21}/></div>
        {!collapsed && <div className="brand-copy"><strong>RoutePilot</strong><span>Transport operations</span></div>}
        <button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={18}/></button>
      </div>
      <nav className="nav-groups">
        {groups.map((group) => <div className="nav-group" key={group.label}>
          {!collapsed && <div className="nav-label">{group.label}</div>}
          {group.items.map(({ to, label, icon: Icon }) => <NavLink end={to === '/'} key={to} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title={collapsed ? label : undefined}>
            <Icon size={18}/>{!collapsed && <span>{label}</span>}{!collapsed && <ChevronRight className="nav-chevron" size={14}/>} 
          </NavLink>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        {!collapsed && <div className="connection-card"><span className={`connection-dot ${backendOnline ? 'online' : 'offline'}`}/><div><strong>{backendOnline ? 'Backend connected' : 'Backend offline'}</strong><small>{backendOnline ? 'Local API is responding' : 'Check localhost:5000'}</small></div></div>}
        <button className="collapse-btn" onClick={() => setCollapsed((x) => !x)}>{collapsed ? <ChevronRight size={17}/> : <><ChevronLeft size={17}/><span>Collapse</span></>}</button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={19}/></button>
        <div className="breadcrumb"><span>{location.pathname === '/' ? 'Operations' : current}</span><b>/</b><strong>{current}</strong></div>
        <div className="topbar-spacer"/>
        <div className="global-search">
          <Search size={16}/><input value={query} onFocus={() => setSearchOpen(true)} onChange={(e) => { setQuery(e.target.value); setSearchOpen(true) }} placeholder="Search employee, stop, vehicle..."/>
          <kbd><Command size={11}/> K</kbd>
          {searchOpen && query && <div className="search-results">
            {results.length ? results.map((r, i) => <button key={`${r.type}-${i}`} onMouseDown={() => { navigate(r.to); setSearchOpen(false); setQuery('') }}><span><b>{r.label}</b><small>{r.sub}</small></span><em>{r.type}</em></button>) : <div className="search-empty">No matching records</div>}
          </div>}
        </div>
        <div className="profile-chip"><span>NT</span></div>
      </header>
      <div className="page-wrap"><Outlet/></div>
    </main>
  </div>
}
