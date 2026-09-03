import { ArrowDownToLine, ArrowUpFromLine, CalendarClock, CalendarDays, Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { shiftAssignmentsApi, shiftsApi } from '../api/resources'
import { apiErrorMessage } from '../api/client'
import { Badge, EmptyState, Modal, PageHeader, Panel } from '../components/UI'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import type { Shift } from '../types'
import { isoDayLocal, sameIsoDay } from '../utils/format'

const emptyForm = { name: '', startTime: '08:00', endTime: '16:00' }

export default function ShiftsPage() {
  const { shifts, attendance, shiftAssignments, employees, refreshAll } = useData()
  const { push } = useToast()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<Shift | 'new' | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [scheduleShift, setScheduleShift] = useState<Shift | null>(null)
  const [scheduleDate, setScheduleDate] = useState(isoDayLocal())
  const [scheduleQuery, setScheduleQuery] = useState('')
  const [scheduleEmployeeIds, setScheduleEmployeeIds] = useState<number[]>([])

  const open = (shift: Shift|'new') => { setEditing(shift); setForm(shift === 'new' ? emptyForm : { name: shift.name, startTime: shift.startTime, endTime: shift.endTime }) }
  const save = async () => {
    if (!form.name.trim() || !/^\d{2}:\d{2}$/.test(form.startTime) || !/^\d{2}:\d{2}$/.test(form.endTime)) return push('Name and valid HH:mm times are required.', 'error')
    setSaving(true)
    try { if (editing === 'new') await shiftsApi.create(form); else if (editing) await shiftsApi.update(editing.id, form); await refreshAll(); setEditing(null); push('Shift saved.') } catch (err) { push(apiErrorMessage(err),'error') } finally { setSaving(false) }
  }
  const remove = async (shift: Shift) => { if (!window.confirm(`Delete ${shift.name}? Existing attendance or schedules may prevent deletion.`)) return; try { await shiftsApi.remove(shift.id); await refreshAll(); push('Shift deleted.') } catch (err) { push(apiErrorMessage(err),'error') } }

  const openSchedule = (shift: Shift) => {
    setScheduleShift(shift)
    const existing = shiftAssignments.filter((assignment) => assignment.shiftId === shift.id && sameIsoDay(assignment.date, scheduleDate)).map((assignment) => assignment.employeeId)
    setScheduleEmployeeIds(existing)
    setScheduleQuery('')
  }

  const changeScheduleDate = (date: string) => {
    setScheduleDate(date)
    if (!scheduleShift) return
    setScheduleEmployeeIds(shiftAssignments.filter((assignment) => assignment.shiftId === scheduleShift.id && sameIsoDay(assignment.date, date)).map((assignment) => assignment.employeeId))
  }

  const saveSchedule = async () => {
    if (!scheduleShift) return
    setSaving(true)
    try {
      await shiftAssignmentsApi.replaceDay({ shiftId: scheduleShift.id, date: scheduleDate, employeeIds: scheduleEmployeeIds })
      await refreshAll()
      push(`${scheduleEmployeeIds.length} employee${scheduleEmployeeIds.length === 1 ? '' : 's'} scheduled for ${scheduleShift.name}.`)
      setScheduleShift(null)
    } catch (err) { push(apiErrorMessage(err), 'error') } finally { setSaving(false) }
  }

  const activeEmployees = useMemo(() => employees.filter((employee) => employee.active && (!scheduleQuery || `${employee.firstName} ${employee.lastName} ${employee.email}`.toLowerCase().includes(scheduleQuery.toLowerCase()))), [employees, scheduleQuery])

  return <>
    <PageHeader eyebrow="RESOURCES" title="Shifts" subtitle="Define working windows and schedule the workforce separately from actual attendance." actions={<button className="btn primary" onClick={() => open('new')}><Plus size={16}/> Add shift</button>}/>
    {shifts.length ? <div className="shift-grid">{shifts.map((shift) => {
      const records = attendance.filter((a) => a.shiftId === shift.id).length
      const scheduled = shiftAssignments.filter((a) => a.shiftId === shift.id).length
      return <article className="shift-card" key={shift.id}>
        <div className="shift-card-head"><div className="shift-icon"><CalendarClock size={22}/></div><div><h3>{shift.name}</h3><Badge tone="blue">Configured</Badge></div><button className="icon-btn" onClick={() => open(shift)}><Pencil size={16}/></button></div>
        <div className="shift-time-line"><div><ArrowDownToLine size={18}/><span><small>Inbound arrival target</small><b>{shift.startTime}</b></span></div><i/><div><ArrowUpFromLine size={18}/><span><small>Outbound departure</small><b>{shift.endTime}</b></span></div></div>
        <div className="shift-card-meta"><Users size={15}/><span>{scheduled} scheduled assignments · {records} attendance records</span></div>
        <div className="shift-actions three"><button className="btn ghost" onClick={() => openSchedule(shift)}><CalendarDays size={14}/> Schedule</button><button className="btn ghost" onClick={() => navigate(`/attendance?shift=${shift.id}`)}>Attendance</button><button className="btn primary" onClick={() => navigate(`/planning?shift=${shift.id}`)}>Build plan</button></div>
        <button className="text-danger" onClick={() => void remove(shift)}><Trash2 size={13}/> Delete shift</button>
      </article>
    })}</div> : <Panel><EmptyState title="No shifts configured" description="Create a shift to define arrival and departure times." action={<button className="btn primary" onClick={() => open('new')}>Add shift</button>}/></Panel>}

    {editing && <Modal title={editing === 'new' ? 'Add shift' : 'Edit shift'} subtitle="Times are stored as HH:mm and are used by inbound/outbound scheduling." onClose={() => setEditing(null)}><div className="form-grid"><label className="span-2">Shift name<input value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} placeholder="Morning"/></label><label>Start / arrival time<input type="time" value={form.startTime} onChange={(e) => setForm({...form,startTime:e.target.value})}/></label><label>End / departure time<input type="time" value={form.endTime} onChange={(e) => setForm({...form,endTime:e.target.value})}/></label><div className="form-actions span-2"><button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save shift'}</button></div></div></Modal>}

    {scheduleShift && <Modal wide title={`Schedule ${scheduleShift.name}`} subtitle="Choose who is expected to work. Attendance remains a separate day-of record." onClose={() => setScheduleShift(null)}>
      <div className="schedule-editor-head"><label>Date<input type="date" value={scheduleDate} onChange={(e) => changeScheduleDate(e.target.value)}/></label><div className="inline-search"><Search size={15}/><input value={scheduleQuery} onChange={(e) => setScheduleQuery(e.target.value)} placeholder="Search employee..."/></div></div>
      <div className="schedule-editor-actions"><button className="btn ghost" onClick={() => setScheduleEmployeeIds(employees.filter((employee) => employee.active).map((employee) => employee.id))}>Select all active</button><button className="btn ghost" onClick={() => setScheduleEmployeeIds([])}>Clear</button><span>{scheduleEmployeeIds.length} scheduled</span></div>
      <div className="schedule-employee-list">{activeEmployees.map((employee) => <label key={employee.id}><input type="checkbox" checked={scheduleEmployeeIds.includes(employee.id)} onChange={() => setScheduleEmployeeIds((current) => current.includes(employee.id) ? current.filter((id) => id !== employee.id) : [...current, employee.id])}/><span><b>{employee.firstName} {employee.lastName}</b><small>{employee.pickupPoint?.name ?? 'No pickup point'} · {employee.email}</small></span></label>)}</div>
      <div className="form-actions"><button className="btn ghost" onClick={() => setScheduleShift(null)}>Cancel</button><button className="btn primary" disabled={saving} onClick={saveSchedule}>{saving ? 'Saving…' : 'Save workforce schedule'}</button></div>
    </Modal>}
  </>
}
