import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Route, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, PageHeader, Panel } from '../components/UI'
import { useData } from '../context/DataContext'
import { addDays, isoDayLocal, sameIsoDay, shortDay, startOfWeek, weekDays, weekRangeLabel } from '../utils/format'

export default function CalendarPage() {
  const { shifts, attendance, employees, shiftAssignments, plans } = useData()
  const navigate = useNavigate()
  const [anchorDay, setAnchorDay] = useState(isoDayLocal())
  const days = weekDays(anchorDay)
  const activeEmployeeCount = employees.filter((employee) => employee.active).length

  const weekAssignments = useMemo(() => shiftAssignments.filter((record) => days.some((day) => sameIsoDay(record.date, day))), [shiftAssignments, days.join('|')])
  const weekAttendance = useMemo(() => attendance.filter((record) => days.some((day) => sameIsoDay(record.date, day))), [attendance, days.join('|')])
  const plannedCells = shifts.reduce((count, shift) => count + days.filter((day) => plans.some((plan) => plan.shiftId === shift.id && sameIsoDay(plan.date, day))).length, 0)
  const moveWeek = (offset: number) => setAnchorDay(addDays(startOfWeek(anchorDay), offset * 7))

  return <>
    <PageHeader eyebrow="OPERATIONS" title="Calendar" subtitle="Weekly workforce schedule, attendance status and persisted transport plans." actions={<div className="week-nav"><button className="icon-btn" onClick={() => moveWeek(-1)}><ChevronLeft size={17}/></button><button className="week-label" onClick={() => setAnchorDay(isoDayLocal())}>{weekRangeLabel(anchorDay)}</button><button className="icon-btn" onClick={() => moveWeek(1)}><ChevronRight size={17}/></button></div>}/>

    <div className="calendar-summary">
      <div><CalendarDays size={18}/><span><b>{weekAssignments.length}</b>scheduled assignments</span></div>
      <div><Users size={18}/><span><b>{weekAttendance.filter((record) => record.present).length}</b>present records</span></div>
      <div><Route size={18}/><span><b>{plannedCells}</b>shift-days with saved plans</span></div>
      <div className="calendar-note"><span><b>{activeEmployeeCount}</b> active employees</span></div>
    </div>

    <Panel className="calendar-panel">
      <div className="week-grid">
        <div className="week-grid-corner"><span>Shift</span><small>Schedule / attendance / plan</small></div>
        {days.map((day) => <div className={`week-day-head ${day === isoDayLocal() ? 'today' : ''}`} key={day}><b>{shortDay(day)}</b><small>{day}</small></div>)}
        {shifts.map((shift) => <WeekShiftRow key={shift.id} shift={shift} days={days} attendance={attendance} assignments={shiftAssignments} plans={plans} navigate={navigate}/>) }
      </div>
      {!shifts.length && <div className="empty-table">Create a shift to populate the weekly operations calendar.</div>}
    </Panel>

    <div className="calendar-legend"><span><i className="legend-dot ready"/> Workforce scheduled</span><span><i className="legend-dot planned"/> Plan persisted</span><span><i className="legend-dot missing"/> No schedule yet</span><em>Schedule assignments are now stored separately from attendance.</em></div>
  </>
}

function WeekShiftRow({ shift, days, attendance, assignments, plans, navigate }: any) {
  return <>
    <div className="week-shift-label"><b>{shift.name}</b><span>{shift.startTime}–{shift.endTime}</span></div>
    {days.map((day: string) => {
      const scheduled = assignments.filter((record: any) => record.shiftId === shift.id && sameIsoDay(record.date, day))
      const records = attendance.filter((record: any) => record.shiftId === shift.id && sameIsoDay(record.date, day))
      const present = records.filter((record: any) => record.present).length
      const absent = records.filter((record: any) => !record.present).length
      const dayPlans = plans.filter((plan: any) => plan.shiftId === shift.id && sameIsoDay(plan.date, day))
      const published = dayPlans.some((plan: any) => plan.status === 'PUBLISHED')
      const hasPlan = dayPlans.length > 0
      return <div key={`${shift.id}-${day}`} className={`week-cell ${hasPlan ? 'has-plan' : ''} ${scheduled.length === 0 ? 'no-data' : ''}`}>
        <button className="week-cell-main" onClick={() => navigate(`/attendance?date=${day}&shift=${shift.id}`)}>
          <div className="week-cell-top">{scheduled.length ? <Badge tone="blue">{scheduled.length} scheduled</Badge> : <Badge tone="neutral">No schedule</Badge>}{hasPlan && <CheckCircle2 size={14}/>}</div>
          {scheduled.length ? <div className="week-cell-kpis"><b>{present || '—'}</b><span>{records.length ? 'present' : 'attendance pending'}</span>{absent > 0 && <small><CircleAlert size={11}/>{absent} absent</small>}</div> : <div className="week-plan-state muted">Schedule workforce</div>}
          {hasPlan ? <div className="week-plan-state"><Route size={12}/>{published ? 'Published' : `${dayPlans.length} draft plan${dayPlans.length === 1 ? '' : 's'}`}</div> : scheduled.length ? <div className="week-plan-state pending">Needs planning</div> : null}
        </button>
      </div>
    })}
  </>
}
