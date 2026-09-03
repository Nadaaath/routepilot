import { Check, CheckCircle2, Filter, Save, Search, UserMinus, Users, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { attendanceApi } from '../api/resources'
import { apiErrorMessage } from '../api/client'
import { Badge, Metric, PageHeader, Panel } from '../components/UI'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { fullDate, isoDayLocal, sameIsoDay } from '../utils/format'

export default function AttendancePage() {
  const { employees, pickupPoints, shifts, attendance, shiftAssignments, refreshAll } = useData()
  const { push } = useToast()
  const [params] = useSearchParams()
  const [day, setDay] = useState(params.get('date') ?? isoDayLocal())
  const [shiftId, setShiftId] = useState(Number(params.get('shift')) || shifts[0]?.id || 0)
  const [query, setQuery] = useState('')
  const [pointFilter, setPointFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all'|'present'|'absent'>('all')
  const [draft, setDraft] = useState<Record<number, boolean>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!shiftId && shifts[0]) setShiftId(shifts[0].id) }, [shifts, shiftId])
  useEffect(() => { setDraft({}) }, [day, shiftId])

  const activeEmployees = useMemo(() => employees.filter((e) => e.active), [employees])
  const scheduledIds = useMemo(() => shiftAssignments.filter((assignment) => assignment.shiftId === shiftId && sameIsoDay(assignment.date, day)).map((assignment) => assignment.employeeId), [shiftAssignments, shiftId, day])
  const scheduledEmployees = useMemo(() => scheduledIds.length ? activeEmployees.filter((employee) => scheduledIds.includes(employee.id)) : activeEmployees, [activeEmployees, scheduledIds])
  const scheduleFallback = scheduledIds.length === 0
  const sameDayRecords = useMemo(() => attendance.filter((a) => sameIsoDay(a.date, day)), [attendance, day])
  const selectedShiftRecords = sameDayRecords.filter((a) => a.shiftId === shiftId)
  const recordFor = (employeeId: number) => selectedShiftRecords.find((a) => a.employeeId === employeeId) ?? sameDayRecords.find((a) => a.employeeId === employeeId)
  const presentFor = (employeeId: number) => draft[employeeId] ?? recordFor(employeeId)?.present ?? true
  const pendingCount = scheduledEmployees.filter((e) => !recordFor(e.id)).length
  const dirtyCount = Object.keys(draft).length
  const presentCount = scheduledEmployees.filter((e) => presentFor(e.id)).length
  const absentCount = scheduledEmployees.length - presentCount

  const filtered = scheduledEmployees.filter((e) => {
    const q = query.toLowerCase()
    const matchesQuery = !q || `${e.firstName} ${e.lastName} ${e.email} ${e.pickupPoint?.name ?? ''}`.toLowerCase().includes(q)
    const matchesPoint = pointFilter === 'all' || String(e.pickupPointId ?? 'none') === pointFilter
    const status = presentFor(e.id)
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'present' ? status : !status)
    return matchesQuery && matchesPoint && matchesStatus
  })

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const employee of filtered) {
      const name = employee.pickupPoint?.name ?? 'Missing pickup point'
      map.set(name, [...(map.get(name) ?? []), employee])
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const setAll = (value: boolean) => {
    const next: Record<number, boolean> = { ...draft }
    filtered.forEach((e) => { next[e.id] = value })
    setDraft(next)
  }

  const save = async () => {
    if (!shiftId) return push('Select a shift first.', 'error')
    setSaving(true)
    try {
      await Promise.all(scheduledEmployees.map(async (employee) => {
        const existing = recordFor(employee.id)
        const payload = { employeeId: employee.id, shiftId, date: day, present: presentFor(employee.id) }
        if (existing) await attendanceApi.update(existing.id, payload)
        else await attendanceApi.create(payload)
      }))
      await refreshAll(); setDraft({}); push('Attendance saved successfully.')
    } catch (err) { push(apiErrorMessage(err), 'error') }
    finally { setSaving(false) }
  }

  return <>
    <PageHeader eyebrow="DAILY OPERATIONS" title="Attendance" subtitle="Confirm who is travelling on a specific shift before planning routes." actions={<div className="save-actions"><span className={dirtyCount || pendingCount ? 'unsaved' : 'saved'}>{dirtyCount ? `${dirtyCount} changes not saved` : pendingCount ? `${pendingCount} records not yet stored` : 'All changes saved'}</span><button className="btn primary" onClick={save} disabled={saving || !shiftId}><Save size={16}/>{saving ? 'Saving…' : 'Save attendance'}</button></div>}/>

    <Panel className="control-panel"><div className="attendance-toolbar">
      <label>Date<input type="date" value={day} onChange={(e) => setDay(e.target.value)}/></label>
      <label>Shift<select value={shiftId} onChange={(e) => setShiftId(Number(e.target.value))}><option value="">Choose shift</option>{shifts.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.startTime}–{s.endTime}</option>)}</select></label>
      <label className="search-field"><span>Search employee</span><div><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email or pickup point"/></div></label>
      <label>Pickup point<select value={pointFilter} onChange={(e) => setPointFilter(e.target.value)}><option value="all">All pickup points</option><option value="none">Missing pickup point</option>{pickupPoints.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Status<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}><option value="all">All statuses</option><option value="present">Present</option><option value="absent">Absent</option></select></label>
      <button className="btn ghost filter-button"><Filter size={15}/> Filters</button>
    </div></Panel>

    <div className="attendance-summary">
      <Metric icon={<Users size={19}/>} value={scheduledEmployees.length} label="Scheduled workforce" note={fullDate(day)}/>
      <Metric icon={<CheckCircle2 size={19}/>} value={presentCount} label="Present" note={`${scheduledEmployees.length ? Math.round(presentCount / scheduledEmployees.length * 100) : 0}% attendance`} tone="green"/>
      <Metric icon={<UserMinus size={19}/>} value={absentCount} label="Absent" note="Excluded from optimization" tone="red"/>
      <div className="bulk-actions"><button className="btn ghost good" onClick={() => setAll(true)}><Check size={15}/> Mark all present</button><button className="btn ghost danger" onClick={() => setAll(false)}><XCircle size={15}/> Mark all absent</button></div>
    </div>

    {scheduleFallback && <div className="info-banner"><Users size={18}/><span><b>No workforce schedule exists for this shift/day.</b> RoutePilot is temporarily showing all active employees so attendance can still be recorded. Use Shifts → Schedule to create the real roster.</span></div>}

    {scheduledEmployees.some((e) => !e.pickupPointId) && <div className="warning-banner"><UserMinus size={18}/><span><b>{scheduledEmployees.filter((e) => !e.pickupPointId).length} employee(s) are missing a pickup point.</b> Present employees without a pickup point cannot be routed correctly.</span></div>}

    <section className="attendance-table panel">
      <div className="table-head attendance-cols"><span/><span>Employee</span><span>Pickup point</span><span>Shift</span><span>Status</span><span>Record</span></div>
      <div className="attendance-groups">
        {groups.map(([groupName, groupEmployees]) => <div className="attendance-group" key={groupName}>
          <div className="group-head"><span className="group-chevron">⌄</span><strong>{groupName}</strong><Badge tone="blue">{groupEmployees.length}</Badge><div className="group-stat">{groupEmployees.filter((e) => presentFor(e.id)).length} present, {groupEmployees.filter((e) => !presentFor(e.id)).length} absent</div></div>
          {groupEmployees.map((e) => { const present = presentFor(e.id); const record = recordFor(e.id); return <div className="table-row attendance-cols" key={e.id}>
            <input type="checkbox" checked={present} onChange={(ev) => setDraft((d) => ({ ...d, [e.id]: ev.target.checked }))}/>
            <div className="employee-cell"><span className="avatar">{e.firstName[0]}{e.lastName[0]}</span><div><b>{e.firstName} {e.lastName}</b><small>{e.email}</small></div></div>
            <span>{e.pickupPoint?.name ?? <em className="missing-text">Missing</em>}</span>
            <span>{shifts.find((s) => s.id === shiftId)?.name ?? '—'}</span>
            <button className={`status-select ${present ? 'present' : 'absent'}`} onClick={() => setDraft((d) => ({ ...d, [e.id]: !present }))}>{present ? 'Present' : 'Absent'} <span>⌄</span></button>
            <span>{record ? <Badge tone="green">Stored</Badge> : <Badge tone="amber">New</Badge>}</span>
          </div> })}
        </div>)}
        {!groups.length && <div className="empty-table">No employees match these filters.</div>}
      </div>
      <div className="table-footer">Showing {filtered.length} of {scheduledEmployees.length} scheduled employees</div>
    </section>
  </>
}
