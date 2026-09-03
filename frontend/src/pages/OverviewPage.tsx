import {
  BusFront,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Download,
  FileText,
  MapPinned,
  Route,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Metric, PageHeader, Panel } from '../components/UI'
import { useData } from '../context/DataContext'
import type { PersistedTransportPlan, Shift, TransportPlanStatus } from '../types'
import { formatNumber, fullDate, isoDayLocal, sameIsoDay } from '../utils/format'

export default function OverviewPage() {
  const {
    employees,
    vehicles,
    pickupPoints,
    depots,
    shifts,
    attendance,
    shiftAssignments,
    vehicleAvailability,
    plans,
    loading,
    error,
  } = useData()
  const navigate = useNavigate()
  const [day, setDay] = useState(isoDayLocal())
  const [shiftId, setShiftId] = useState(0)

  const selectedShift = shifts.find((shift) => shift.id === shiftId) ?? shifts[0]
  const activeEmployees = employees.filter((employee) => employee.active)

  const scheduledIds = useMemo(() => new Set(
    shiftAssignments
      .filter((assignment) => sameIsoDay(assignment.date, day) && (!selectedShift || assignment.shiftId === selectedShift.id))
      .map((assignment) => assignment.employeeId),
  ), [shiftAssignments, day, selectedShift])

  const scheduledEmployees = scheduledIds.size
    ? activeEmployees.filter((employee) => scheduledIds.has(employee.id))
    : activeEmployees

  const dayRecords = useMemo(() => attendance.filter(
    (record) => sameIsoDay(record.date, day) && (!selectedShift || record.shiftId === selectedShift.id),
  ), [attendance, day, selectedShift])

  const presentIds = new Set(dayRecords.filter((record) => record.present).map((record) => record.employeeId))
  const presentEmployees = scheduledEmployees.filter((employee) => presentIds.has(employee.id))
  const absentCount = dayRecords.filter((record) => !record.present).length
  const demandEmployees = dayRecords.length ? presentEmployees : scheduledEmployees
  const missingStops = demandEmployees.filter((employee) => !employee.pickupPointId)

  const unavailableVehicleIds = new Set(
    vehicleAvailability
      .filter((item) => sameIsoDay(item.date, day) && item.available === false)
      .map((item) => item.vehicleId),
  )
  const availableVehicles = vehicles.filter((vehicle) => vehicle.active && !unavailableVehicleIds.has(vehicle.id))
  const seats = availableVehicles.reduce((sum, vehicle) => sum + vehicle.capacity, 0)
  const readinessDemand = demandEmployees.length
  const ready = !!selectedShift && !!depots.length && readinessDemand > 0 && seats >= readinessDemand && missingStops.length === 0 && dayRecords.length > 0

  const matchingPlans = useMemo(() => plans.filter(
    (plan) => sameIsoDay(plan.date, day) && (!selectedShift || plan.shiftId === selectedShift.id),
  ), [plans, day, selectedShift])
  const inboundPlan = bestPlan(matchingPlans.filter((plan) => plan.direction === 'INBOUND'))
  const outboundPlan = bestPlan(matchingPlans.filter((plan) => plan.direction === 'OUTBOUND'))

  const demandByPoint = pickupPoints.map((point) => ({
    point,
    count: demandEmployees.filter((employee) => employee.pickupPointId === point.id).length,
  })).sort((a, b) => b.count - a.count)
  const maxDemand = Math.max(1, ...demandByPoint.map((item) => item.count))

  const actionIssues = [
    ...(dayRecords.length === 0 ? ['Attendance has not been confirmed for the selected shift.'] : []),
    ...(missingStops.length ? [`${missingStops.length} travelling employee${missingStops.length === 1 ? '' : 's'} ${missingStops.length === 1 ? 'is' : 'are'} missing a pickup point.`] : []),
    ...(seats < readinessDemand ? [`Fleet is short by ${readinessDemand - seats} seat${readinessDemand - seats === 1 ? '' : 's'}.`] : []),
    ...(unavailableVehicleIds.size ? [`${unavailableVehicleIds.size} active vehicle${unavailableVehicleIds.size === 1 ? ' is' : 's are'} unavailable on this date.`] : []),
  ]

  const openPlanning = () => navigate(`/planning?date=${day}${selectedShift ? `&shift=${selectedShift.id}` : ''}`)

  return <>
    <PageHeader
      eyebrow="OPERATIONS CONTROL"
      title="Operations overview"
      subtitle={`${fullDate(day)} · workforce, readiness and current transport plans in one place.`}
      actions={<div className="overview-header-actions">
        <input type="date" value={day} onChange={(event) => setDay(event.target.value)}/>
        {!!shifts.length && <select value={selectedShift?.id ?? ''} onChange={(event) => setShiftId(Number(event.target.value))}>
          {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} · {shift.startTime}–{shift.endTime}</option>)}
        </select>}
        <button className="btn primary" onClick={openPlanning}><Route size={16}/> Build transport plan</button>
      </div>}
    />

    {error && <div className="alert error">{error}</div>}

    {!scheduledIds.size && <div className="overview-context-note">
      <CircleAlert size={16}/><span>No explicit workforce schedule is saved for this shift/date, so RoutePilot is using the active workforce as the planning baseline.</span>
    </div>}

    <div className="metrics-strip six overview-metrics-v14">
      <Metric icon={<Users size={19}/>} value={scheduledEmployees.length} label="Scheduled" note={scheduledIds.size ? 'Shift assignments' : 'Active-workforce fallback'}/>
      <Metric icon={<CheckCircle2 size={19}/>} value={dayRecords.length ? presentEmployees.length : '—'} label="Present" note={dayRecords.length ? `${absentCount} absent` : 'Attendance not confirmed'} tone="green"/>
      <Metric icon={<BusFront size={19}/>} value={availableVehicles.length} label="Available vehicles" note={`${seats} seats`} tone="green"/>
      <Metric icon={<MapPinned size={19}/>} value={demandByPoint.filter((item) => item.count > 0).length} label="Stops in demand" note={`${pickupPoints.length} configured`}/>
      <Metric icon={<Route size={19}/>} value={matchingPlans.length} label="Plan versions" note={matchingPlans.length ? 'For selected shift/day' : 'No plan generated'} tone="purple"/>
      <Metric icon={ready ? <CheckCircle2 size={19}/> : <CircleAlert size={19}/>} value={ready ? 'Ready' : 'Review'} label="Planning status" note={ready ? 'Inputs look complete' : `${actionIssues.length || 1} item${actionIssues.length === 1 ? '' : 's'} to check`} tone={ready ? 'green' : 'amber'}/>
    </div>

    <div className="overview-command-grid-v14">
      <Panel title="Planning readiness" subtitle="Business inputs needed before a reliable plan can be generated.">
        <div className="readiness-list">
          <Readiness ok={dayRecords.length > 0} title="Attendance confirmed" detail={dayRecords.length ? `${presentEmployees.length} present · ${absentCount} absent` : 'Attendance is not saved for this shift/day'}/>
          <Readiness ok={depots.length > 0} title="Depot configured" detail={depots[0]?.name ?? 'Create a depot before planning'}/>
          <Readiness ok={seats >= readinessDemand && readinessDemand > 0} title="Fleet capacity" detail={`${seats} seats available vs ${readinessDemand} required`}/>
          <Readiness ok={missingStops.length === 0 && readinessDemand > 0} title="Pickup data" detail={missingStops.length ? `${missingStops.length} travelling employees need a pickup point` : readinessDemand ? 'All travelling employees have a pickup point' : 'No workforce in scope'}/>
        </div>
        <div className="overview-readiness-actions">
          <button className="btn" onClick={() => navigate(`/attendance?date=${day}${selectedShift ? `&shift=${selectedShift.id}` : ''}`)}><Users size={15}/> Review attendance</button>
          <button className="btn primary" onClick={openPlanning}><Route size={15}/> Open planning</button>
        </div>
      </Panel>

      <Panel title="Current transport plans" subtitle="Best saved version for each direction on the selected shift/day.">
        <div className="overview-plan-stack">
          <DirectionPlanCard direction="INBOUND" plan={inboundPlan} shift={selectedShift} onBuild={openPlanning} onPlans={() => navigate('/plans')} onDocuments={() => navigate('/exports')}/>
          <DirectionPlanCard direction="OUTBOUND" plan={outboundPlan} shift={selectedShift} onBuild={openPlanning} onPlans={() => navigate('/plans')} onDocuments={() => navigate('/exports')}/>
        </div>
      </Panel>
    </div>

    <div className="overview-lower-grid-v14">
      <Panel title="Shift board" subtitle={`Operational status across every shift on ${fullDate(day)}.`}>
        <div className="shift-board-v14">
          {shifts.map((shift) => <ShiftBoardRow key={shift.id} shift={shift} day={day} employees={activeEmployees} attendance={attendance} assignments={shiftAssignments} plans={plans} onOpen={() => setShiftId(shift.id)} />)}
          {!shifts.length && <div className="empty-mini">Create a shift to start scheduling transport.</div>}
        </div>
      </Panel>

      <Panel title="Demand by pickup point" subtitle={dayRecords.length ? 'Present workforce distribution for the selected shift.' : 'Scheduled workforce distribution until attendance is confirmed.'}>
        <div className="bar-list">
          {demandByPoint.slice(0, 8).map(({ point, count }) => <div className="bar-row" key={point.id}>
            <span>{point.name}</span><div><i style={{ width: `${count / maxDemand * 100}%` }}/></div><b>{count}</b>
          </div>)}
        </div>
      </Panel>
    </div>

    <div className="overview-footer-grid-v14">
      <Panel title="Operational attention" subtitle="Items that may need action before dispatch.">
        {actionIssues.length ? <div className="overview-issues-v14">{actionIssues.map((issue) => <div key={issue}><CircleAlert size={17}/><span>{issue}</span></div>)}</div> : <div className="overview-all-clear"><CheckCircle2 size={20}/><div><b>No immediate blockers</b><span>The selected shift is ready for planning and review.</span></div></div>}
      </Panel>
      <Panel title="Quick actions" subtitle="Continue the operational workflow.">
        <div className="action-stack overview-actions-v14">
          <button onClick={() => navigate('/calendar')}><CalendarClock size={17}/><span><b>Open weekly calendar</b><small>See schedules, attendance and plans across the week</small></span><Route size={14}/></button>
          <button onClick={() => navigate('/fleet')}><BusFront size={17}/><span><b>Inspect fleet</b><small>Availability, usage and vehicle economics</small></span><Route size={14}/></button>
          <button onClick={() => navigate('/plans')}><FileText size={17}/><span><b>Review saved plans</b><small>Versions, lifecycle and manual adjustments</small></span><Route size={14}/></button>
          <button onClick={() => navigate('/exports')}><Download size={17}/><span><b>Prepare documents</b><small>Driver, employee and dispatch outputs</small></span><Route size={14}/></button>
        </div>
      </Panel>
    </div>

    {loading && <div className="loading-line">Synchronizing backend data…</div>}
  </>
}

function DirectionPlanCard({ direction, plan, shift, onBuild, onPlans, onDocuments }: {
  direction: 'INBOUND' | 'OUTBOUND'
  plan?: PersistedTransportPlan
  shift?: Shift
  onBuild: () => void
  onPlans: () => void
  onDocuments: () => void
}) {
  const title = direction === 'INBOUND' ? 'To workplace' : 'From workplace'
  const timing = direction === 'INBOUND' ? `Arrive by ${shift?.startTime ?? '—'}` : `Depart after ${shift?.endTime ?? '—'}`
  if (!plan) return <div className="direction-plan-card-v14 empty">
    <div className="direction-plan-head"><div><span>{direction}</span><b>{title}</b><small>{timing}</small></div><Badge tone="neutral">No plan</Badge></div>
    <p>No saved transport plan exists for this direction yet.</p>
    <button className="btn compact" onClick={onBuild}><Route size={14}/> Build plan</button>
  </div>

  const totals = plan.result.optimizationInput.totals
  const completeCost = totals.costDataComplete !== false
  return <div className="direction-plan-card-v14">
    <div className="direction-plan-head"><div><span>{direction}</span><b>{title}</b><small>{timing}</small></div><Badge tone={statusTone(plan.status)}>{plan.status}</Badge></div>
    <div className="direction-plan-kpis">
      <span><b>{totals.totalTrips}</b><small>trips</small></span>
      <span><b>{plan.result.employeeCount}</b><small>employees</small></span>
      <span><b>{formatNumber(totals.totalDistanceKm, 1)} km</b><small>distance</small></span>
      <span><b>{completeCost ? '' : '≥ '}{formatNumber(totals.totalOperatingCost, 2)} MAD</b><small>variable cost</small></span>
    </div>
    <div className="direction-plan-foot"><span>v{plan.version} · {friendlyStrategy(plan.strategy)}</span><div><button className="btn compact" onClick={onPlans}>Open plan</button><button className="btn compact" onClick={onDocuments}>Documents</button></div></div>
  </div>
}

function ShiftBoardRow({ shift, day, employees, attendance, assignments, plans, onOpen }: {
  shift: Shift
  day: string
  employees: Array<{ id: number }>
  attendance: Array<{ shiftId: number; date: string; employeeId: number; present: boolean }>
  assignments: Array<{ shiftId: number; date: string; employeeId: number }>
  plans: PersistedTransportPlan[]
  onOpen: () => void
}) {
  const assignmentIds = new Set(assignments.filter((item) => item.shiftId === shift.id && sameIsoDay(item.date, day)).map((item) => item.employeeId))
  const scheduled = assignmentIds.size ? employees.filter((employee) => assignmentIds.has(employee.id)).length : 0
  const records = attendance.filter((item) => item.shiftId === shift.id && sameIsoDay(item.date, day))
  const present = records.filter((item) => item.present).length
  const dayPlans = plans.filter((plan) => plan.shiftId === shift.id && sameIsoDay(plan.date, day))
  const best = bestPlan(dayPlans)
  return <button className="shift-board-row-v14" onClick={onOpen}>
    <div><b>{shift.name}</b><span>{shift.startTime}–{shift.endTime}</span></div>
    <span><b>{scheduled || '—'}</b><small>scheduled</small></span>
    <span><b>{records.length ? present : '—'}</b><small>present</small></span>
    <span><Badge tone={best ? statusTone(best.status) : records.length ? 'amber' : 'neutral'}>{best ? best.status : records.length ? 'Needs plan' : 'No attendance'}</Badge></span>
    <Route size={14}/>
  </button>
}

function Readiness({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return <div className="readiness-item">{ok ? <CheckCircle2 className="ok" size={20}/> : <CircleAlert className="warn" size={20}/>}<div><strong>{title}</strong><span>{detail}</span></div></div>
}

function bestPlan(plans: PersistedTransportPlan[]) {
  return [...plans].sort((a, b) => statusScore(b.status) - statusScore(a.status) || b.version - a.version || String(b.createdAt).localeCompare(String(a.createdAt)))[0]
}

function statusScore(status: TransportPlanStatus) {
  if (status === 'PUBLISHED') return 4
  if (status === 'APPROVED') return 3
  if (status === 'DRAFT') return 2
  return 1
}

function statusTone(status: TransportPlanStatus): 'green' | 'blue' | 'purple' | 'neutral' {
  if (status === 'PUBLISHED') return 'green'
  if (status === 'APPROVED') return 'blue'
  if (status === 'DRAFT') return 'purple'
  return 'neutral'
}

function friendlyStrategy(strategy: string) {
  return strategy.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}
