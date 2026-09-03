import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Mail, MapPin, MoreHorizontal, Pencil, Phone, Plus, Route, Search, Trash2, UserCheck, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { employeesApi } from '../api/resources'
import { apiErrorMessage } from '../api/client'
import { Badge, Drawer, EmptyState, Modal, PageHeader, Panel } from '../components/UI'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import type { Employee, PersistedTransportPlan, ShiftAssignment } from '../types'
import { addDays, fullDate, initials, isoDayLocal, sameIsoDay, shortDay, startOfWeek, weekDays, weekRangeLabel } from '../utils/format'

const emptyForm = { firstName: '', lastName: '', email: '', phone: '', pickupPointId: '', active: true }

type ProfileTab = 'overview' | 'schedule' | 'transport'

export default function EmployeesPage() {
  const { employees, pickupPoints, attendance, shifts, shiftAssignments, plans, refreshAll } = useData()
  const { push } = useToast()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [point, setPoint] = useState('all')
  const [status, setStatus] = useState('active')
  const [selected, setSelected] = useState<Employee | null>(null)
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview')
  const [profileWeek, setProfileWeek] = useState(isoDayLocal())
  const [editing, setEditing] = useState<Employee | 'new' | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { const focus = Number(params.get('focus')); if (focus) setSelected(employees.find((employee) => employee.id === focus) ?? null) }, [params, employees])
  useEffect(() => { if (selected) { setProfileTab('overview'); setProfileWeek(isoDayLocal()) } }, [selected?.id])

  const filtered = useMemo(() => employees.filter((employee) => {
    const q = query.toLowerCase()
    return (!q || `${employee.firstName} ${employee.lastName} ${employee.email} ${employee.phone ?? ''}`.toLowerCase().includes(q)) && (point === 'all' || String(employee.pickupPointId ?? 'none') === point) && (status === 'all' || (status === 'active' ? employee.active : !employee.active))
  }), [employees, query, point, status])

  const openForm = (employee: Employee | 'new') => {
    setEditing(employee)
    setForm(employee === 'new' ? emptyForm : { firstName: employee.firstName, lastName: employee.lastName, email: employee.email, phone: employee.phone ?? '', pickupPointId: employee.pickupPointId ? String(employee.pickupPointId) : '', active: employee.active })
  }

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.includes('@')) return push('First name, last name and a valid email are required.', 'error')
    setSaving(true)
    const payload = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim() || null, pickupPointId: form.pickupPointId ? Number(form.pickupPointId) : null, active: form.active }
    try {
      if (editing === 'new') await employeesApi.create(payload)
      else if (editing) await employeesApi.update(editing.id, payload)
      await refreshAll(); setEditing(null); push(editing === 'new' ? 'Employee created.' : 'Employee updated.')
    } catch (err) { push(apiErrorMessage(err), 'error') } finally { setSaving(false) }
  }

  const remove = async (employee: Employee) => {
    if (!window.confirm(`Delete ${employee.firstName} ${employee.lastName}?`)) return
    try { await employeesApi.remove(employee.id); await refreshAll(); if (selected?.id === employee.id) setSelected(null); push('Employee deleted.') } catch (err) { push(apiErrorMessage(err), 'error') }
  }

  return <>
    <PageHeader eyebrow="RESOURCES" title="Employees" subtitle="Manage transport eligibility, pickup assignment, weekly shift records, and each employee's generated transport experience." actions={<button className="btn primary" onClick={() => openForm('new')}><Plus size={16}/> Add employee</button>}/>
    <div className="resource-summary"><div><Users size={18}/><span><b>{employees.length}</b>Total employees</span></div><div><UserCheck size={18}/><span><b>{employees.filter((employee) => employee.active).length}</b>Active</span></div><div><MapPin size={18}/><span><b>{employees.filter((employee) => employee.pickupPointId).length}</b>Pickup assigned</span></div><div className="resource-warning"><span><b>{employees.filter((employee) => employee.active && !employee.pickupPointId).length}</b> active employees need a pickup point</span></div></div>
    <Panel className="resource-panel"><div className="resource-toolbar"><div className="inline-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee..."/></div><select value={point} onChange={(event) => setPoint(event.target.value)}><option value="all">All pickup points</option><option value="none">Missing pickup point</option>{pickupPoints.map((pickupPoint) => <option value={pickupPoint.id} key={pickupPoint.id}>{pickupPoint.name}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select><span className="result-count">{filtered.length} results</span></div>
      {filtered.length ? <div className="data-table"><div className="table-head employee-cols"><span>Employee</span><span>Pickup point</span><span>Contact</span><span>Status</span><span/></div>{filtered.map((employee) => <div className="table-row employee-cols clickable" key={employee.id} onClick={() => setSelected(employee)}><div className="employee-cell"><span className="avatar">{initials(employee.firstName, employee.lastName)}</span><div><b>{employee.firstName} {employee.lastName}</b><small>{employee.email}</small></div></div><span>{employee.pickupPoint?.name ?? <em className="missing-text">Not assigned</em>}</span><span>{employee.phone ?? '—'}</span><Badge tone={employee.active ? 'green' : 'neutral'}>{employee.active ? 'Active' : 'Inactive'}</Badge><button className="icon-btn" onClick={(event) => { event.stopPropagation(); setSelected(employee) }}><MoreHorizontal size={17}/></button></div>)}</div> : <EmptyState title="No employees found" description="Try changing your search or filters."/>}
    </Panel>

    {selected && <Drawer title={`${selected.firstName} ${selected.lastName}`} subtitle={`Employee #${selected.id} · ${selected.pickupPoint?.name ?? 'No pickup point'}`} onClose={() => setSelected(null)}>
      <div className="drawer-profile"><span className="avatar large">{initials(selected.firstName, selected.lastName)}</span><Badge tone={selected.active ? 'green' : 'neutral'}>{selected.active ? 'Active' : 'Inactive'}</Badge></div>
      <div className="profile-tabs"><button className={profileTab === 'overview' ? 'active' : ''} onClick={() => setProfileTab('overview')}>Overview</button><button className={profileTab === 'schedule' ? 'active' : ''} onClick={() => setProfileTab('schedule')}>Schedule</button><button className={profileTab === 'transport' ? 'active' : ''} onClick={() => setProfileTab('transport')}>Transport</button></div>
      {profileTab === 'overview' && <EmployeeOverview employee={selected}/>} 
      {profileTab === 'schedule' && <EmployeeSchedule employee={selected} week={profileWeek} setWeek={setProfileWeek} attendance={attendance} shifts={shifts} assignments={shiftAssignments}/>} 
      {profileTab === 'transport' && <EmployeeTransport employee={selected} plans={plans}/>} 
      <div className="drawer-actions"><button className="btn ghost danger" onClick={() => void remove(selected)}><Trash2 size={15}/> Delete</button><button className="btn primary" onClick={() => openForm(selected)}><Pencil size={15}/> Edit employee</button></div>
    </Drawer>}

    {editing && <Modal title={editing === 'new' ? 'Add employee' : 'Edit employee'} subtitle="Employee transport profile and pickup assignment." onClose={() => setEditing(null)}><div className="form-grid"><label>First name<input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })}/></label><label>Last name<input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })}/></label><label className="span-2">Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label><label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/></label><label>Pickup point<select value={form.pickupPointId} onChange={(event) => setForm({ ...form, pickupPointId: event.target.value })}><option value="">No pickup point</option>{pickupPoints.map((pickupPoint) => <option value={pickupPoint.id} key={pickupPoint.id}>{pickupPoint.name}</option>)}</select></label><label className="toggle-row span-2"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })}/><span>Active employee</span></label><div className="form-actions span-2"><button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save employee'}</button></div></div></Modal>}
  </>
}

function EmployeeOverview({ employee }: { employee: Employee }) {
  return <><div className="detail-section"><h3>Contact</h3><Detail icon={<Mail size={16}/>} label="Email" value={employee.email}/><Detail icon={<Phone size={16}/>} label="Phone" value={employee.phone ?? 'Not provided'}/></div><div className="detail-section"><h3>Transport</h3><Detail icon={<MapPin size={16}/>} label="Pickup point" value={employee.pickupPoint?.name ?? 'Not assigned'}/>{employee.pickupPoint?.address && <Detail icon={<MapPin size={16}/>} label="Address" value={employee.pickupPoint.address}/>}</div></>
}

function EmployeeSchedule({ employee, week, setWeek, attendance, shifts, assignments }: { employee: Employee; week: string; setWeek: (day: string) => void; attendance: any[]; shifts: any[]; assignments: ShiftAssignment[] }) {
  const days = weekDays(week)
  return <div className="employee-schedule"><div className="employee-week-head"><button className="icon-btn" onClick={() => setWeek(addDays(startOfWeek(week), -7))}><ChevronLeft size={16}/></button><div><b>{weekRangeLabel(week)}</b><span>Scheduled shift vs actual attendance</span></div><button className="icon-btn" onClick={() => setWeek(addDays(startOfWeek(week), 7))}><ChevronRight size={16}/></button></div><div className="employee-week-list">{days.map((day) => {
    const scheduled = assignments.find((item) => item.employeeId === employee.id && sameIsoDay(item.date, day))
    const record = attendance.find((item) => item.employeeId === employee.id && sameIsoDay(item.date, day))
    const shiftId = scheduled?.shiftId ?? record?.shiftId
    const shift = shiftId ? shifts.find((item) => item.id === shiftId) : null
    return <div className={`employee-day ${day === isoDayLocal() ? 'today' : ''}`} key={day}><div className="employee-day-date"><b>{shortDay(day)}</b><span>{day}</span></div>{scheduled ? <><div className="employee-day-shift"><CalendarDays size={15}/><span><b>{shift?.name ?? `Shift #${scheduled.shiftId}`}</b><small>{shift ? `${shift.startTime}–${shift.endTime}` : 'Shift timing unavailable'}</small></span></div>{record ? <Badge tone={record.present ? 'green' : 'red'}>{record.present ? 'Present' : 'Absent'}</Badge> : <Badge tone="blue">Scheduled</Badge>}</> : record ? <><div className="employee-day-shift"><CalendarDays size={15}/><span><b>{shift?.name ?? `Shift #${record.shiftId}`}</b><small>Attendance exists without a schedule assignment</small></span></div><Badge tone={record.present ? 'green' : 'red'}>{record.present ? 'Present' : 'Absent'}</Badge></> : <div className="employee-day-empty">Not scheduled</div>}</div>
  })}</div><div className="schedule-boundary-note"><CalendarDays size={14}/><span>Scheduled workforce is stored separately from attendance. Attendance records show what actually happened.</span></div></div>
}

function EmployeeTransport({ employee, plans }: { employee: Employee; plans: PersistedTransportPlan[] }) {
  const journeys = plans.flatMap((plan) => plan.result.optimizationInput.routes.flatMap((trip) => {
    if (!trip.employeeIds.includes(employee.id)) return []
    const ride = trip.employeeRideTimes.find((item) => item.employeeId === employee.id)
    if (!ride) return []
    const point = plan.result.optimizationInput.pickupPoints.find((pickupPoint) => pickupPoint.id === ride.pickupPointId)
    return [{ plan, trip, ride, point }]
  })).slice(0, 12)
  const avg = journeys.length ? Math.round(journeys.reduce((sum, item) => sum + item.ride.rideTimeMinutes, 0) / journeys.length) : 0
  const longest = journeys.length ? Math.max(...journeys.map((item) => item.ride.rideTimeMinutes)) : 0
  return <div className="employee-transport"><div className="employee-transport-kpis"><div><Route size={16}/><span><b>{journeys.length}</b>persisted journeys</span></div><div><Clock3 size={16}/><span><b>{avg || '—'}</b>{avg ? 'min average ride' : 'average ride'}</span></div><div><Clock3 size={16}/><span><b>{longest || '—'}</b>{longest ? 'min longest ride' : 'longest ride'}</span></div></div>{journeys.length ? <div className="journey-list">{journeys.map(({ plan, trip, ride, point }, index) => <div className="journey-row" key={`${plan.id}-${trip.tripId}-${index}`}><div className="journey-date"><b>{String(plan.date).slice(0,10)}</b><Badge tone={plan.result.direction === 'INBOUND' ? 'blue' : 'purple'}>{plan.result.direction === 'INBOUND' ? 'TO WORK' : 'FROM WORK'}</Badge></div><div><span>{trip.assignedVehicle.name}</span><small>{point?.name ?? 'Pickup point'} · {ride.originTime} → {ride.destinationTime}</small></div><strong>{ride.rideTimeMinutes} min</strong></div>)}</div> : <EmptyState title="No transport history" description="Persisted plans containing this employee will appear here with vehicle, stop and ride time."/>}</div>
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="detail-row">{icon}<div><span>{label}</span><b>{value}</b></div></div> }
