import {
  BusFront,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  Filter,
  Printer,
  Route,
  Search,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, EmptyState, PageHeader, Panel } from '../components/UI'
import { useData } from '../context/DataContext'
import type { OptimizationTrip, PersistedTransportPlan, TransportPlanStatus } from '../types'
import { downloadText } from '../utils/format'

type OperationalDocument = 'DRIVER' | 'EMPLOYEE' | 'PICKUP' | 'DISPATCH' | 'WEEKLY_EMPLOYEE' | 'WEEKLY_FLEET'
type PlanStatusFilter = 'ALL' | TransportPlanStatus

const operationalDocuments: Array<{
  id: OperationalDocument
  title: string
  description: string
  icon: typeof BusFront
}> = [
  { id: 'DRIVER', title: 'Driver route sheets', description: 'One route sheet per vehicle, with ordered stops, timing and passenger names.', icon: BusFront },
  { id: 'EMPLOYEE', title: 'Employee transport schedules', description: 'Individual pickup, vehicle, destination and ride-time information.', icon: Users },
  { id: 'PICKUP', title: 'Pickup-point manifest', description: 'Boarding checklist grouped by stop and pickup time.', icon: ClipboardList },
  { id: 'DISPATCH', title: 'Fleet dispatch sheet', description: 'Manager summary of every trip, vehicle, load, timing, distance and cost.', icon: Route },
  { id: 'WEEKLY_EMPLOYEE', title: 'Weekly employee schedules', description: 'Employee transport movements collected across the selected plan week.', icon: CalendarDays },
  { id: 'WEEKLY_FLEET', title: 'Weekly fleet dispatch', description: 'Vehicle-by-vehicle transport activity across the selected plan week.', icon: BusFront },
]

export default function ExportsPage() {
  const { plans } = useData()
  const [statusFilter, setStatusFilter] = useState<PlanStatusFilter>('ALL')
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [documentType, setDocumentType] = useState<OperationalDocument>('DRIVER')
  const [tripScope, setTripScope] = useState<'ALL' | number>('ALL')
  const [employeeScope, setEmployeeScope] = useState<'ALL' | number>('ALL')

  const filteredPlans = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...plans]
      .filter((plan) => statusFilter === 'ALL' || plan.status === statusFilter)
      .filter((plan) => directionFilter === 'ALL' || plan.direction === directionFilter)
      .filter((plan) => {
        if (!query) return true
        const haystack = `${plan.date} ${plan.result.shift.name} ${plan.direction} ${plan.status} ${plan.result.depot.name} v${plan.version}`.toLowerCase()
        return haystack.includes(query)
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  }, [plans, statusFilter, directionFilter, search])

  const selected = useMemo(() => {
    return filteredPlans.find((plan) => plan.id === selectedId)
      ?? plans.find((plan) => plan.id === selectedId)
      ?? filteredPlans[0]
      ?? plans[0]
  }, [filteredPlans, plans, selectedId])

  const weekPlans = useMemo(() => selected ? plansForWeek(plans, selected) : [], [plans, selected])
  const routes = selected?.result.optimizationInput.routes ?? []
  const employees = selected ? uniqueEmployeesForPlan(selected) : []

  const selectPlan = (id: number) => {
    setSelectedId(id)
    setTripScope('ALL')
    setEmployeeScope('ALL')
  }

  const exportJson = () => {
    if (!selected) return
    downloadText(`routepilot-plan-${selected.id}-v${selected.version}.json`, JSON.stringify(selected.result, null, 2))
  }

  const exportCsv = () => {
    if (!selected) return
    const r = selected.result
    const rows = [['Trip', 'Vehicle', 'Employee', 'Pickup point', 'Origin', 'Destination', 'Ride time minutes']]
    r.optimizationInput.routes.forEach((trip) => trip.employeeRideTimes.forEach((ride) => rows.push([
      String(trip.tripId),
      trip.assignedVehicle.name,
      `${ride.firstName} ${ride.lastName}`,
      r.optimizationInput.pickupPoints.find((point) => point.id === ride.pickupPointId)?.name ?? '',
      ride.originTime,
      ride.destinationTime,
      String(ride.rideTimeMinutes),
    ])))
    downloadText(`routepilot-manifest-${r.date}.csv`, rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n'), 'text/csv')
  }

  const printCurrent = () => {
    if (!selected) return
    if (documentType === 'DRIVER') printDriverSheet(selected, tripScope)
    if (documentType === 'EMPLOYEE') printEmployeeSchedule(selected, employeeScope)
    if (documentType === 'PICKUP') printPickupManifest(selected)
    if (documentType === 'DISPATCH') printFleetDispatch(selected)
    if (documentType === 'WEEKLY_EMPLOYEE') printWeeklyEmployeeSchedules(weekPlans, selected)
    if (documentType === 'WEEKLY_FLEET') printWeeklyFleetDispatch(weekPlans, selected)
  }

  if (!plans.length) return <>
    <PageHeader eyebrow="OUTPUTS" title="Operational Exports" subtitle="Turn approved transport plans into driver, employee and dispatch documents."/>
    <Panel><EmptyState title="Nothing to export yet" description="Generate and persist a transport plan from Planning first."/></Panel>
  </>

  return <>
    <PageHeader
      eyebrow="OUTPUTS"
      title="Operational Exports"
      subtitle="Prepare distribution-ready documents for drivers, employees and operations teams."
      actions={selected && <div className="export-header-status"><Badge tone={statusTone(selected.status)}>{selected.status}</Badge><span>v{selected.version}</span></div>}
    />

    {selected && selected.status !== 'PUBLISHED' && <div className="export-draft-banner">
      <div><strong>{selected.status} plan</strong><span>Operational documents are available for review, but printed copies will be marked “{selected.status} — NOT FOR DISTRIBUTION”.</span></div>
      <Badge tone={selected.status === 'APPROVED' ? 'blue' : 'amber'}>Preview only</Badge>
    </div>}

    <div className="exports-workspace-v13">
      <Panel title="Plan" subtitle="Choose the plan version you want to prepare." className="export-plan-column">
        <div className="export-plan-filters">
          <label><Search size={14}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search plan…"/></label>
          <div className="export-filter-row">
            <label><Filter size={13}/><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PlanStatusFilter)}><option value="ALL">All statuses</option><option value="PUBLISHED">Published</option><option value="APPROVED">Approved</option><option value="DRAFT">Draft</option><option value="SUPERSEDED">Superseded</option></select></label>
            <select value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value as 'ALL' | 'INBOUND' | 'OUTBOUND')}><option value="ALL">Both directions</option><option value="INBOUND">Inbound</option><option value="OUTBOUND">Outbound</option></select>
          </div>
        </div>

        <div className="export-plan-list">
          {filteredPlans.slice(0, 18).map((plan) => <button key={plan.id} className={plan.id === selected?.id ? 'active' : ''} onClick={() => selectPlan(plan.id)}>
            <div className="export-plan-row-top"><strong>{formatPlanDate(plan.date)} · {plan.result.shift.name}</strong><Badge tone={statusTone(plan.status)}>{plan.status}</Badge></div>
            <span>{plan.direction === 'INBOUND' ? 'To workplace' : 'From workplace'} · v{plan.version}</span>
            <small>{plan.result.employeeCount} employees · {plan.result.optimizationInput.totals.totalTrips} trips · {plan.result.depot.name}</small>
          </button>)}
          {!filteredPlans.length && <div className="empty-mini">No plans match these filters.</div>}
        </div>

        {selected && <div className="selected-plan-card-v13">
          <div><span>Selected version</span><strong>v{selected.version}</strong></div>
          <div><span>Employees</span><strong>{selected.result.employeeCount}</strong></div>
          <div><span>Trips</span><strong>{selected.result.optimizationInput.totals.totalTrips}</strong></div>
          <div><span>Strategy</span><strong>{friendlyStrategy(selected.strategy)}</strong></div>
        </div>}
      </Panel>

      <Panel title="Documents" subtitle="Operational documents first; technical data exports stay separate." className="export-document-column">
        <div className="document-category-label">Operational documents</div>
        <div className="document-picker-v13">
          {operationalDocuments.map((document) => {
            const Icon = document.icon
            return <button key={document.id} className={documentType === document.id ? 'active' : ''} onClick={() => setDocumentType(document.id)}>
              <span className="doc-icon"><Icon size={19}/></span>
              <span><strong>{document.title}</strong><small>{document.description}</small></span>
              {documentType === document.id && <CheckCircle2 size={16}/>} 
            </button>
          })}
        </div>

        {documentType === 'DRIVER' && selected && <div className="document-scope-box">
          <label>Vehicle sheet<select value={tripScope} onChange={(event) => setTripScope(event.target.value === 'ALL' ? 'ALL' : Number(event.target.value))}><option value="ALL">All vehicles ({routes.length} sheets)</option>{routes.map((trip) => <option key={trip.tripId} value={trip.tripId}>{trip.assignedVehicle.name} · {trip.employeeCount} passengers</option>)}</select></label>
        </div>}

        {documentType === 'EMPLOYEE' && selected && <div className="document-scope-box">
          <label>Employee schedule<select value={employeeScope} onChange={(event) => setEmployeeScope(event.target.value === 'ALL' ? 'ALL' : Number(event.target.value))}><option value="ALL">All employees ({employees.length} schedules)</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
        </div>}

        {(documentType === 'WEEKLY_EMPLOYEE' || documentType === 'WEEKLY_FLEET') && <div className="week-source-note"><CalendarDays size={16}/><span><strong>{weekPlans.length} plan versions selected for the week</strong><small>RoutePilot uses the latest published version per day/direction when available, otherwise the latest saved version.</small></span></div>}

        <div className="document-category-label data">Data exports</div>
        <div className="data-export-list-v13">
          <button onClick={exportCsv}><FileSpreadsheet size={18}/><span><strong>Passenger manifest CSV</strong><small>Trip, vehicle, employee, stop and ride-time rows.</small></span><Download size={15}/></button>
          <button onClick={exportJson}><FileJson size={18}/><span><strong>Full JSON plan</strong><small>Complete persisted optimizer response for archival/debugging.</small></span><Download size={15}/></button>
        </div>
      </Panel>

      <Panel title="Preview" subtitle="What the recipient will actually receive." className="export-preview-column" action={<button className="btn primary compact" onClick={printCurrent}><Printer size={15}/> Print / Save PDF</button>}>
        {selected && <DocumentPreview plan={selected} documentType={documentType} tripScope={tripScope} employeeScope={employeeScope} weekPlans={weekPlans}/>} 
      </Panel>
    </div>
  </>
}

function DocumentPreview({ plan, documentType, tripScope, employeeScope, weekPlans }: {
  plan: PersistedTransportPlan
  documentType: OperationalDocument
  tripScope: 'ALL' | number
  employeeScope: 'ALL' | number
  weekPlans: PersistedTransportPlan[]
}) {
  const r = plan.result
  const watermark = plan.status !== 'PUBLISHED' ? `${plan.status} · NOT FOR DISTRIBUTION` : null
  const routes = tripScope === 'ALL' ? r.optimizationInput.routes : r.optimizationInput.routes.filter((trip) => trip.tripId === tripScope)
  const allEmployees = uniqueEmployeesForPlan(plan)
  const employees = employeeScope === 'ALL' ? allEmployees : allEmployees.filter((employee) => employee.id === employeeScope)

  return <div className="document-preview-shell">
    {watermark && <div className="document-watermark">{watermark}</div>}
    <div className="paper-head"><div><span className="paper-brand">RoutePilot</span><strong>{previewTitle(documentType)}</strong></div><div className="paper-meta"><b>{formatPlanDate(plan.date)}</b><span>{r.shift.name} · {r.direction}</span></div></div>

    {documentType === 'DRIVER' && <div className="paper-content">{routes.slice(0, tripScope === 'ALL' ? 2 : 1).map((trip, index) => <div className="preview-trip" key={trip.tripId}>
      <div className="preview-trip-head"><div><b>{trip.assignedVehicle.name}</b><span>{trip.employeeCount} passengers</span></div><div><strong>{trip.schedule.departureTime} → {trip.schedule.arrivalTime}</strong><span>{trip.totalDistanceKm.toFixed(1)} km</span></div></div>
      {trip.schedule.stops.slice(0, 4).map((stop, stopIndex) => <div className="preview-stop" key={`${trip.tripId}-${stop.pickupPointId}-${stopIndex}`}><span>{stop.arrivalTime}</span><div><b>{r.optimizationInput.pickupPoints.find((point) => point.id === stop.pickupPointId)?.name ?? `Stop ${stop.pickupPointId}`}</b><small>{trip.employeeRideTimes.filter((ride) => ride.pickupPointId === stop.pickupPointId).slice(0, 4).map((ride) => `${ride.firstName} ${ride.lastName}`).join(' · ') || 'No passenger names'}</small></div></div>)}
      {trip.schedule.stops.length > 4 && <div className="preview-more">+ {trip.schedule.stops.length - 4} more stops</div>}
      {tripScope === 'ALL' && index === 1 && routes.length > 2 && <div className="preview-more">+ {routes.length - 2} additional vehicle sheets in PDF</div>}
    </div>)}</div>}

    {documentType === 'EMPLOYEE' && <div className="paper-content">{employees.slice(0, employeeScope === 'ALL' ? 3 : 1).map((employee, index) => <div className="employee-preview-card" key={employee.id}><div className="employee-preview-name"><span>{employee.initials}</span><div><b>{employee.name}</b><small>Employee #{employee.id}</small></div></div><div className="employee-preview-grid"><span>Pickup<strong>{employee.origin}</strong></span><span>Stop<strong>{employee.stop}</strong></span><span>Vehicle<strong>{employee.vehicle}</strong></span><span>Arrival<strong>{employee.destination}</strong></span><span>Ride<strong>{employee.ride} min</strong></span></div>{employeeScope === 'ALL' && index === 2 && employees.length > 3 && <div className="preview-more">+ {employees.length - 3} employee schedules in PDF</div>}</div>)}</div>}

    {documentType === 'PICKUP' && <div className="paper-content">{pickupGroups(plan).slice(0, 5).map((group) => <div className="manifest-preview-row" key={`${group.tripId}-${group.pointId}`}><span className="manifest-time">{group.time}</span><div><b>{group.stop}</b><small>{group.vehicle} · {group.names.length} passengers</small><p>{group.names.slice(0, 5).map((name) => `□ ${name}`).join('   ')}</p></div></div>)}</div>}

    {documentType === 'DISPATCH' && <div className="paper-content"><div className="dispatch-summary-preview"><span><b>{r.optimizationInput.totals.totalTrips}</b> vehicles</span><span><b>{r.employeeCount}</b> employees</span><span><b>{r.optimizationInput.totals.totalDistanceKm.toFixed(1)}</b> km</span><span><b>{r.optimizationInput.totals.totalEstimatedFuelLiters.toFixed(1)}</b> L fuel</span></div><div className="dispatch-table-preview"><div className="head"><span>Vehicle</span><span>Load</span><span>Window</span><span>Distance</span></div>{r.optimizationInput.routes.map((trip) => <div key={trip.tripId}><b>{trip.assignedVehicle.name}</b><span>{trip.employeeCount}/{trip.assignedVehicle.capacity}</span><span>{trip.schedule.departureTime}–{trip.schedule.arrivalTime}</span><span>{trip.totalDistanceKm.toFixed(1)} km</span></div>)}</div></div>}

    {documentType === 'WEEKLY_EMPLOYEE' && <WeeklyEmployeePreview plans={weekPlans}/>} 
    {documentType === 'WEEKLY_FLEET' && <WeeklyFleetPreview plans={weekPlans}/>} 

    <div className="paper-footer"><span>Generated from RoutePilot plan #{plan.id} · v{plan.version}</span><span>{plan.status}</span></div>
  </div>
}

function WeeklyEmployeePreview({ plans }: { plans: PersistedTransportPlan[] }) {
  const map = weeklyEmployeeMap(plans)
  const employees = [...map.values()]
  return <div className="paper-content"><div className="weekly-preview-title"><b>{employees.length} employees</b><span>{plans.length} plan versions in this week</span></div>{employees.slice(0, 3).map((employee, index) => <div className="weekly-employee-row" key={employee.id}><b>{employee.name}</b><div>{employee.entries.slice(0, 5).map((entry) => <span key={`${entry.date}-${entry.direction}`}><small>{shortDay(entry.date)}</small><strong>{entry.time}</strong><em>{entry.vehicle}</em></span>)}</div>{index === 2 && employees.length > 3 && <div className="preview-more">+ {employees.length - 3} employee schedules in PDF</div>}</div>)}</div>
}

function WeeklyFleetPreview({ plans }: { plans: PersistedTransportPlan[] }) {
  const rows = plans.flatMap((plan) => plan.result.optimizationInput.routes.map((trip) => ({ plan, trip }))).sort((a, b) => String(a.plan.date).localeCompare(String(b.plan.date)))
  return <div className="paper-content"><div className="weekly-preview-title"><b>{rows.length} vehicle journeys</b><span>{plans.length} selected plan versions</span></div><div className="dispatch-table-preview"><div className="head"><span>Date / vehicle</span><span>Load</span><span>Window</span><span>Distance</span></div>{rows.slice(0, 7).map(({ plan, trip }) => <div key={`${plan.id}-${trip.tripId}`}><b>{shortDay(plan.date)} · {trip.assignedVehicle.name}</b><span>{trip.employeeCount}/{trip.assignedVehicle.capacity}</span><span>{trip.schedule.departureTime}–{trip.schedule.arrivalTime}</span><span>{trip.totalDistanceKm.toFixed(1)} km</span></div>)}</div>{rows.length > 7 && <div className="preview-more">+ {rows.length - 7} additional journeys in PDF</div>}</div>
}

function printDriverSheet(plan: PersistedTransportPlan, scope: 'ALL' | number) {
  const r = plan.result
  const routes = scope === 'ALL' ? r.optimizationInput.routes : r.optimizationInput.routes.filter((trip) => trip.tripId === scope)
  const sections = routes.map((trip) => driverSectionHtml(plan, trip)).join('')
  openPrint(`Driver route sheets · ${r.date}`, plan, `<div class="document-title"><h1>Driver Route Sheet${routes.length > 1 ? 's' : ''}</h1><p>${esc(formatPlanDate(plan.date))} · ${esc(r.shift.name)} · ${esc(r.direction)}</p></div>${sections}`)
}

function driverSectionHtml(plan: PersistedTransportPlan, trip: OptimizationTrip) {
  const r = plan.result
  const stops = trip.schedule.stops.map((stop, index) => {
    const point = r.optimizationInput.pickupPoints.find((candidate) => candidate.id === stop.pickupPointId)
    const names = trip.employeeRideTimes.filter((ride) => ride.pickupPointId === stop.pickupPointId).map((ride) => `${ride.firstName} ${ride.lastName}`)
    return `<div class="stop"><div class="stop-time">${esc(stop.arrivalTime)}</div><div><b>${index + 1}. ${esc(point?.name ?? `Stop ${stop.pickupPointId}`)}</b><span>${esc(names.join(', ') || 'No passengers listed')}</span></div></div>`
  }).join('')
  return `<section class="sheet page-break"><div class="sheet-head"><div><h2>${esc(trip.assignedVehicle.name)}</h2><p>${trip.employeeCount} passengers · ${trip.employeeCount}/${trip.assignedVehicle.capacity} seats</p></div><div class="right"><b>${esc(trip.schedule.departureTime)} → ${esc(trip.schedule.arrivalTime)}</b><span>${trip.totalDistanceKm.toFixed(1)} km</span></div></div>${stops}<div class="destination"><b>${esc(trip.schedule.arrivalTime)} · ${esc(r.depot.name)}</b><span>Destination / company arrival</span></div></section>`
}

function printEmployeeSchedule(plan: PersistedTransportPlan, scope: 'ALL' | number) {
  const employees = uniqueEmployeesForPlan(plan).filter((employee) => scope === 'ALL' || employee.id === scope)
  const content = employees.map((employee) => `<section class="sheet employee-sheet page-break"><div class="document-title"><h1>${esc(employee.name)}</h1><p>${esc(formatPlanDate(plan.date))} · ${esc(plan.result.shift.name)} · ${esc(plan.result.direction)}</p></div><div class="employee-grid"><div><span>Pickup / origin</span><b>${esc(employee.origin)}</b></div><div><span>Pickup point</span><b>${esc(employee.stop)}</b></div><div><span>Vehicle</span><b>${esc(employee.vehicle)}</b></div><div><span>Destination / arrival</span><b>${esc(employee.destination)}</b></div><div><span>Ride time</span><b>${employee.ride} min</b></div></div></section>`).join('')
  openPrint(`Employee schedules · ${plan.result.date}`, plan, content)
}

function printPickupManifest(plan: PersistedTransportPlan) {
  const groups = pickupGroups(plan)
  const content = `<div class="document-title"><h1>Pickup-point Manifest</h1><p>${esc(formatPlanDate(plan.date))} · ${esc(plan.result.shift.name)} · ${esc(plan.result.direction)}</p></div>${groups.map((group) => `<section class="manifest-group"><div class="manifest-head"><div><h2>${esc(group.stop)}</h2><p>${esc(group.vehicle)}</p></div><div><b>${esc(group.time)}</b><span>${group.names.length} passengers</span></div></div>${group.names.map((name) => `<div class="check-row"><span>□</span>${esc(name)}</div>`).join('')}</section>`).join('')}`
  openPrint(`Pickup manifest · ${plan.result.date}`, plan, content)
}

function printFleetDispatch(plan: PersistedTransportPlan) {
  const r = plan.result
  const totals = r.optimizationInput.totals
  const rows = r.optimizationInput.routes.map((trip) => `<tr><td>${esc(trip.assignedVehicle.name)}</td><td>${trip.employeeCount}/${trip.assignedVehicle.capacity}</td><td>${esc(trip.schedule.departureTime)}–${esc(trip.schedule.arrivalTime)}</td><td>${trip.totalDistanceKm.toFixed(1)} km</td><td>${trip.routeCost.estimatedFuelLiters?.toFixed(2) ?? '—'} L</td><td>${trip.routeCost.operatingCost != null ? `${trip.routeCost.operatingCost.toFixed(2)} MAD` : 'Incomplete'}</td></tr>`).join('')
  const content = `<div class="document-title"><h1>Fleet Dispatch Sheet</h1><p>${esc(formatPlanDate(plan.date))} · ${esc(r.shift.name)} · ${esc(r.direction)}</p></div><div class="summary-grid"><div><span>Trips</span><b>${totals.totalTrips}</b></div><div><span>Employees</span><b>${r.employeeCount}</b></div><div><span>Distance</span><b>${totals.totalDistanceKm.toFixed(1)} km</b></div><div><span>Fuel</span><b>${totals.totalEstimatedFuelLiters.toFixed(2)} L</b></div></div><table><thead><tr><th>Vehicle</th><th>Load</th><th>Window</th><th>Distance</th><th>Fuel</th><th>Variable cost</th></tr></thead><tbody>${rows}</tbody></table>`
  openPrint(`Fleet dispatch · ${r.date}`, plan, content)
}

function printWeeklyEmployeeSchedules(plans: PersistedTransportPlan[], reference: PersistedTransportPlan) {
  const map = weeklyEmployeeMap(plans)
  const content = [...map.values()].map((employee) => `<section class="sheet employee-sheet page-break"><div class="document-title"><h1>${esc(employee.name)}</h1><p>Weekly transport schedule · week of ${esc(formatPlanDate(weekStart(reference.date)))}</p></div><table><thead><tr><th>Day</th><th>Direction</th><th>Time</th><th>Stop</th><th>Vehicle</th></tr></thead><tbody>${employee.entries.map((entry) => `<tr><td>${esc(shortDay(entry.date))}</td><td>${esc(entry.direction)}</td><td>${esc(entry.time)}</td><td>${esc(entry.stop)}</td><td>${esc(entry.vehicle)}</td></tr>`).join('')}</tbody></table></section>`).join('')
  openPrint('Weekly employee schedules', reference, content)
}

function printWeeklyFleetDispatch(plans: PersistedTransportPlan[], reference: PersistedTransportPlan) {
  const rows = plans.flatMap((plan) => plan.result.optimizationInput.routes.map((trip) => ({ plan, trip }))).sort((a, b) => String(a.plan.date).localeCompare(String(b.plan.date)))
  const content = `<div class="document-title"><h1>Weekly Fleet Dispatch</h1><p>Week of ${esc(formatPlanDate(weekStart(reference.date)))}</p></div><table><thead><tr><th>Date</th><th>Direction</th><th>Vehicle</th><th>Load</th><th>Window</th><th>Distance</th></tr></thead><tbody>${rows.map(({ plan, trip }) => `<tr><td>${esc(formatPlanDate(plan.date))}</td><td>${esc(plan.direction)}</td><td>${esc(trip.assignedVehicle.name)}</td><td>${trip.employeeCount}/${trip.assignedVehicle.capacity}</td><td>${esc(trip.schedule.departureTime)}–${esc(trip.schedule.arrivalTime)}</td><td>${trip.totalDistanceKm.toFixed(1)} km</td></tr>`).join('')}</tbody></table>`
  openPrint('Weekly fleet dispatch', reference, content)
}

function openPrint(title: string, plan: PersistedTransportPlan, content: string) {
  const watermark = plan.status === 'PUBLISHED' ? '' : `<div class="watermark">${esc(plan.status)} — NOT FOR DISTRIBUTION</div>`
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}html,body{min-height:100%;background:#fff}body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#142033;font-size:12px}.watermark{position:fixed;left:0;right:0;top:45%;text-align:center;font-size:42px;font-weight:800;color:rgba(185,74,74,.13);transform:rotate(-25deg);z-index:99;pointer-events:none}.document-title{margin-bottom:22px}.document-title h1{font-size:25px;margin:0 0 5px}.document-title p,.sheet-head p{color:#637084;margin:0}.sheet{padding:4px 0 24px}.sheet-head,.manifest-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #17263b;padding-bottom:10px;margin-bottom:5px}.sheet-head h2,.manifest-head h2{margin:0;font-size:18px}.sheet-head .right,.manifest-head>div:last-child{text-align:right}.sheet-head span,.manifest-head span{display:block;color:#697487;margin-top:3px}.stop{display:grid;grid-template-columns:58px 1fr;gap:12px;padding:10px 0;border-bottom:1px solid #dce2e8}.stop-time{font-weight:800;color:#1e62c9}.stop b,.stop span{display:block}.stop span{font-size:11px;margin-top:4px;color:#4d5969}.destination{padding:12px;background:#f2f6fb;border-radius:7px;margin-top:12px}.destination b,.destination span{display:block}.destination span{font-size:11px;color:#677487;margin-top:3px}.employee-grid,.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:20px}.employee-grid>div,.summary-grid>div{padding:14px;border:1px solid #dce2e8;border-radius:8px}.employee-grid span,.summary-grid span{display:block;color:#748092;font-size:10px;text-transform:uppercase;letter-spacing:.06em}.employee-grid b,.summary-grid b{display:block;font-size:15px;margin-top:5px}.manifest-group{margin-bottom:24px}.check-row{padding:7px 0;border-bottom:1px solid #e2e6eb}.check-row span{display:inline-block;width:28px;color:#667386}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:9px 8px;border-bottom:1px solid #dfe4e9;text-align:left;font-size:11px}th{background:#f3f6f9;color:#526075;text-transform:uppercase;font-size:9px;letter-spacing:.05em}.page-break{break-after:page}.page-break:last-child{break-after:auto}@media print{html,body{background:#fff!important}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page-break{break-after:page}.page-break:last-child{break-after:auto}}
  </style></head><body>${watermark}${content}</body></html>`

  // Use a Blob URL rather than document.write(). Some browsers can open the
  // print dialog before a document.write() tab has painted, producing a blank PDF.
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) {
    URL.revokeObjectURL(url)
    return
  }
  try { win.opener = null } catch { /* browser may prevent assigning opener */ }

  let printed = false
  const triggerPrint = async () => {
    if (printed || win.closed) return
    printed = true
    try {
      if ('fonts' in win.document && win.document.fonts) await win.document.fonts.ready
    } catch { /* system fonts are enough if FontFaceSet is unavailable */ }
    // Two animation frames + a short delay gives Chromium/Edge time to paint
    // tables and multipage content before opening print preview.
    win.requestAnimationFrame(() => win.requestAnimationFrame(() => {
      window.setTimeout(() => {
        if (win.closed) return
        win.focus()
        win.print()
      }, 250)
    }))
  }

  win.addEventListener('load', () => { void triggerPrint() }, { once: true })
  // Fallback for browsers where the Blob tab load event completes before the
  // listener becomes observable to the opener.
  window.setTimeout(() => { void triggerPrint() }, 900)
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function uniqueEmployeesForPlan(plan: PersistedTransportPlan) {
  const rows = plan.result.optimizationInput.routes.flatMap((trip) => trip.employeeRideTimes.map((ride) => ({
    id: ride.employeeId,
    name: `${ride.firstName} ${ride.lastName}`,
    initials: `${ride.firstName?.[0] ?? ''}${ride.lastName?.[0] ?? ''}`.toUpperCase(),
    stop: plan.result.optimizationInput.pickupPoints.find((point) => point.id === ride.pickupPointId)?.name ?? 'Unknown stop',
    vehicle: trip.assignedVehicle.name,
    origin: ride.originTime,
    destination: ride.destinationTime,
    ride: ride.rideTimeMinutes,
  })))
  return [...new Map(rows.map((row) => [row.id, row])).values()].sort((a, b) => a.name.localeCompare(b.name))
}

function pickupGroups(plan: PersistedTransportPlan) {
  const r = plan.result
  return r.optimizationInput.routes.flatMap((trip) => trip.schedule.stops.map((stop) => ({
    tripId: trip.tripId,
    pointId: stop.pickupPointId,
    stop: r.optimizationInput.pickupPoints.find((point) => point.id === stop.pickupPointId)?.name ?? `Stop ${stop.pickupPointId}`,
    time: stop.arrivalTime,
    vehicle: trip.assignedVehicle.name,
    names: trip.employeeRideTimes.filter((ride) => ride.pickupPointId === stop.pickupPointId).map((ride) => `${ride.firstName} ${ride.lastName}`),
  }))).filter((group) => group.names.length > 0)
}

function plansForWeek(plans: PersistedTransportPlan[], reference: PersistedTransportPlan) {
  const start = weekStart(reference.date)
  const end = addDays(start, 6)
  const inWeek = plans.filter((plan) => dateOnly(plan.date) >= start && dateOnly(plan.date) <= end && plan.shiftId === reference.shiftId)
  const groups = new Map<string, PersistedTransportPlan[]>()
  inWeek.forEach((plan) => {
    const key = `${dateOnly(plan.date)}-${plan.direction}`
    const current = groups.get(key) ?? []
    current.push(plan)
    groups.set(key, current)
  })
  return [...groups.values()].map((versions) => [...versions].sort((a, b) => {
    const statusScore = (plan: PersistedTransportPlan) => plan.status === 'PUBLISHED' ? 3 : plan.status === 'APPROVED' ? 2 : plan.status === 'DRAFT' ? 1 : 0
    return statusScore(b) - statusScore(a) || b.version - a.version
  })[0]).sort((a, b) => dateOnly(a.date).localeCompare(dateOnly(b.date)) || a.direction.localeCompare(b.direction))
}

function weeklyEmployeeMap(plans: PersistedTransportPlan[]) {
  const map = new Map<number, { id: number; name: string; entries: Array<{ date: string; direction: string; time: string; stop: string; vehicle: string }> }>()
  plans.forEach((plan) => {
    plan.result.optimizationInput.routes.forEach((trip) => trip.employeeRideTimes.forEach((ride) => {
      const current = map.get(ride.employeeId) ?? { id: ride.employeeId, name: `${ride.firstName} ${ride.lastName}`, entries: [] }
      current.entries.push({
        date: plan.date,
        direction: plan.direction,
        time: ride.originTime,
        stop: plan.result.optimizationInput.pickupPoints.find((point) => point.id === ride.pickupPointId)?.name ?? 'Unknown stop',
        vehicle: trip.assignedVehicle.name,
      })
      map.set(ride.employeeId, current)
    }))
  })
  map.forEach((employee) => employee.entries.sort((a, b) => `${dateOnly(a.date)}-${a.time}`.localeCompare(`${dateOnly(b.date)}-${b.time}`)))
  return map
}

function previewTitle(documentType: OperationalDocument) {
  if (documentType === 'DRIVER') return 'Driver route sheet'
  if (documentType === 'EMPLOYEE') return 'Employee transport schedule'
  if (documentType === 'PICKUP') return 'Pickup-point manifest'
  if (documentType === 'DISPATCH') return 'Fleet dispatch sheet'
  if (documentType === 'WEEKLY_EMPLOYEE') return 'Weekly employee schedules'
  return 'Weekly fleet dispatch'
}

function statusTone(status: TransportPlanStatus): 'green' | 'blue' | 'purple' | 'amber' | 'neutral' {
  if (status === 'PUBLISHED') return 'green'
  if (status === 'APPROVED') return 'blue'
  if (status === 'DRAFT') return 'purple'
  return 'neutral'
}

function friendlyStrategy(strategy: string) {
  return strategy.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatPlanDate(value: string) {
  const [year, month, day] = dateOnly(value).split('-')
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function shortDay(value: string) {
  const [year, month, day] = dateOnly(value).split('-')
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
}

function dateOnly(value: string) { return String(value).slice(0, 10) }
function addDays(value: string, days: number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }
function weekStart(value: string) { const date = new Date(`${dateOnly(value)}T00:00:00Z`); const day = date.getUTCDay(); const delta = day === 0 ? -6 : 1 - day; date.setUTCDate(date.getUTCDate() + delta); return date.toISOString().slice(0, 10) }
function esc(value: unknown) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;') }
