import {
  ArrowDown,
  ArrowUp,
  BusFront,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  Fuel,
  GripVertical,
  MapPin,
  Plus,
  Route,
  RotateCcw,
  Save,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { runOptimization, transportPlansApi } from '../api/resources'
import { Badge, Drawer, EmptyState, Metric, Modal, PageHeader, Panel } from '../components/UI'
import { NetworkMap, TripMap } from '../components/Maps'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { getStoredPlans, saveStoredPlan } from '../store/plans'
import type {
  OptimizationConstraintOverrides,
  OptimizationPreviewRequest,
  OptimizationPreviewResponse,
  OptimizationStrategy,
  OptimizationTrip,
  ManualPlanValidationResponse,
  ManualTripEdit,
  PersistedTransportPlan,
  StoredPlan,
  TripDirection,
  Vehicle,
} from '../types'
import {
  addDays,
  downloadText,
  formatMoney,
  formatNumber,
  isoDayLocal,
  sameIsoDay,
  shortDay,
  startOfWeek,
  weekDays,
  weekRangeLabel,
} from '../utils/format'

type PlanningControlMode = 'AUTOMATIC' | 'GUIDED'
type FleetMode = 'AUTO' | 'MANUAL'

type PolicyDraft = Required<OptimizationConstraintOverrides> & { fuelPricePerLiter: number }

const DEFAULT_POLICY: PolicyDraft = {
  maxClusterDistanceKm: 10,
  dwellMinutesPerStop: 2,
  maxEmployeeRideMinutes: 45,
  minimumVehicleUtilization: 0.65,
  maxStopsPerTrip: 6,
  fuelPricePerLiter: 14,
}


const STRATEGY_COPY: Record<OptimizationStrategy, { title: string; short: string; description: string }> = {
  BALANCED: {
    title: 'Balanced',
    short: 'Balanced',
    description: 'A practical compromise between employee time, vehicle use and operating cost.',
  },
  LOWEST_COST: {
    title: 'Lowest cost',
    short: 'Cost',
    description: 'Prefer cheaper feasible vehicle combinations and tolerate denser transport plans.',
  },
  EMPLOYEE_COMFORT: {
    title: 'Employee comfort',
    short: 'Comfort',
    description: 'Prefer tighter groups, more spare capacity and shorter employee ride-time targets.',
  },
  FLEET_EFFICIENCY: {
    title: 'Fleet efficiency',
    short: 'Fleet',
    description: 'Prefer fewer vehicles and strong seat utilization before secondary cost trade-offs.',
  },
}

export default function PlanningPage() {
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'day'|'week'>(params.get('view') === 'week' ? 'week' : 'day')
  const [day, setDay] = useState(params.get('date') ?? isoDayLocal())
  return <>
    <PageHeader
      eyebrow="OPERATIONS / PLANNING"
      title={mode === 'day' ? 'Build transport plan' : 'Weekly transport planning'}
      subtitle={mode === 'day'
        ? 'Choose the operating policy. RoutePilot handles clustering, fleet allocation, routing, schedules and plan diagnostics.'
        : 'Apply one planning strategy across the week, then inspect or refine each day individually.'}
      actions={<div className="planning-view-toggle"><button className={mode === 'day' ? 'active' : ''} onClick={() => setMode('day')}>Day</button><button className={mode === 'week' ? 'active' : ''} onClick={() => setMode('week')}>Week</button></div>}
    />
    {mode === 'day'
      ? <DayPlanning day={day} setDay={setDay}/>
      : <WeekPlanning anchorDay={day} setAnchorDay={setDay} openDay={(nextDay) => { setDay(nextDay); setMode('day') }}/>} 
  </>
}

function DayPlanning({ day, setDay }: { day: string; setDay: (day: string) => void }) {
  const { shifts, depots, attendance, employees, vehicles, pickupPoints, vehicleAvailability, plans, refreshAll } = useData()
  const { push } = useToast()
  const [params] = useSearchParams()

  const [shiftId, setShiftId] = useState(Number(params.get('shift')) || shifts[0]?.id || 0)
  const [depotId, setDepotId] = useState(depots[0]?.id || 0)
  const [direction, setDirection] = useState<TripDirection>('INBOUND')
  const [controlMode, setControlMode] = useState<PlanningControlMode>('GUIDED')
  const [strategy, setStrategy] = useState<OptimizationStrategy>('BALANCED')
  const [fleetMode, setFleetMode] = useState<FleetMode>('AUTO')
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<number[]>([])
  const [policy, setPolicy] = useState<PolicyDraft>({ ...DEFAULT_POLICY })
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<OptimizationPreviewResponse | null>(null)
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null)
  const [tab, setTab] = useState<'stops'|'passengers'|'metrics'>('stops')
  const [scenarioResults, setScenarioResults] = useState<OptimizationPreviewResponse[]>([])
  const [issuesOpen, setIssuesOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [persistedPlanId, setPersistedPlanId] = useState<number | null>(null)
  const [scenarioPlanIds, setScenarioPlanIds] = useState<Record<string, number>>({})

  useEffect(() => { if (!shiftId && shifts[0]) setShiftId(shifts[0].id) }, [shifts, shiftId])
  useEffect(() => { if (!depotId && depots[0]) setDepotId(depots[0].id) }, [depots, depotId])
  useEffect(() => {
    const activeIds = vehicles.filter((vehicle) => vehicle.active).map((vehicle) => vehicle.id)
    setSelectedVehicleIds((current) => current.length ? current.filter((id) => activeIds.includes(id)) : activeIds)
  }, [vehicles])
  useEffect(() => { setResult(null); setSelectedTripId(null); setScenarioResults([]); setPersistedPlanId(null); setScenarioPlanIds({}); setManualOpen(false) }, [day, shiftId, depotId, direction])

  const selectedShift = shifts.find((shift) => shift.id === shiftId)
  const selectedDepot = depots.find((depot) => depot.id === depotId)
  const presentRecords = useMemo(
    () => attendance.filter((record) => record.shiftId === shiftId && record.present && sameIsoDay(record.date, day)),
    [attendance, shiftId, day],
  )
  const presentEmployees = useMemo(
    () => presentRecords.map((record) => employees.find((employee) => employee.id === record.employeeId)).filter(Boolean),
    [presentRecords, employees],
  )
  const activeFleet = useMemo(() => vehicles.filter((vehicle) => vehicle.active && !vehicleAvailability.some((item) => item.vehicleId === vehicle.id && sameIsoDay(item.date, day) && item.available === false)), [vehicles, vehicleAvailability, day])
  const eligibleFleet = useMemo(
    () => fleetMode === 'AUTO' || controlMode === 'AUTOMATIC'
      ? activeFleet.filter((vehicle) => vehicle.optimizerEligible !== false)
      : activeFleet.filter((vehicle) => selectedVehicleIds.includes(vehicle.id)),
    [activeFleet, fleetMode, controlMode, selectedVehicleIds],
  )
  const fleetCapacity = eligibleFleet.reduce((sum, vehicle) => sum + vehicle.capacity, 0)
  const missingPickupCount = presentEmployees.filter((employee) => !employee?.pickupPointId).length
  const capacityHeadroom = fleetCapacity - presentRecords.length
  const requiredUtilization = fleetCapacity > 0 ? Math.round((presentRecords.length / fleetCapacity) * 100) : 0
  const demandByPoint = useMemo(() => pickupPoints.map((point) => ({
    point,
    count: presentEmployees.filter((employee) => employee?.pickupPointId === point.id).length,
  })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count), [pickupPoints, presentEmployees])
  const activePickupPoints = demandByPoint.map((item) => item.point)
  const selectedTrip = result?.optimizationInput.routes.find((route) => route.tripId === selectedTripId) ?? result?.optimizationInput.routes[0] ?? null
  const readyToPlan = Boolean(
    selectedShift && selectedDepot && presentRecords.length > 0 && eligibleFleet.length > 0 && fleetCapacity >= presentRecords.length && missingPickupCount === 0,
  )
  const targetTime = direction === 'INBOUND' ? selectedShift?.startTime : selectedShift?.endTime

  const matchingPlans = useMemo(() => plans
    .filter((plan) => plan.shiftId === shiftId
      && plan.depotId === depotId
      && plan.direction === direction
      && sameIsoDay(plan.date, day)
      && plan.status !== 'SUPERSEDED')
    .sort((a, b) => b.version - a.version || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  [plans, shiftId, depotId, direction, day])
  const latestMatchingPlan = matchingPlans[0] ?? null

  const planForCurrentResult = useMemo(() => {
    if (!result) return null
    const resultStrategy = result.strategy ?? result.policyApplied?.strategy
    return matchingPlans.find((plan) => plan.id === persistedPlanId)
      ?? matchingPlans.find((plan) => plan.strategy === resultStrategy)
      ?? null
  }, [matchingPlans, persistedPlanId, result])

  const openSavedPlan = (plan: PersistedTransportPlan, editImmediately = false) => {
    setResult(plan.result)
    setPersistedPlanId(plan.id)
    setSelectedTripId(plan.result.optimizationInput.routes[0]?.tripId ?? null)
    setTab('stops')
    if (editImmediately) setManualOpen(true)
  }

  const openManualEditor = () => {
    if (result && persistedPlanId) {
      setManualOpen(true)
      return
    }
    if (result && planForCurrentResult) {
      setPersistedPlanId(planForCurrentResult.id)
      setManualOpen(true)
      return
    }
    if (latestMatchingPlan) {
      openSavedPlan(latestMatchingPlan, true)
      return
    }
    push('Generate a plan first. RoutePilot will then let you adjust it manually.', 'info')
  }

  const applyStrategy = (next: OptimizationStrategy) => {
    // Strategy changes the objective only. Business constraints stay fixed so
    // scenario comparison is apples-to-apples.
    setStrategy(next)
  }

  const updatePolicy = (field: keyof PolicyDraft, value: number) => {
    setPolicy((current) => ({ ...current, [field]: value }))
    setScenarioResults([])
    setResult(null)
  }

  const toggleVehicle = (vehicleId: number) => {
    setSelectedVehicleIds((current) => current.includes(vehicleId)
      ? current.filter((id) => id !== vehicleId)
      : [...current, vehicleId])
    setScenarioResults([])
    setResult(null)
  }

  const buildPayload = (): OptimizationPreviewRequest => {
    const payload: OptimizationPreviewRequest = { shiftId, date: day, depotId, direction, strategy }
    if (controlMode === 'GUIDED') {
      if (fleetMode === 'MANUAL') payload.vehicleIds = selectedVehicleIds
      payload.constraints = {
        maxClusterDistanceKm: policy.maxClusterDistanceKm,
        dwellMinutesPerStop: policy.dwellMinutesPerStop,
        maxEmployeeRideMinutes: policy.maxEmployeeRideMinutes,
        minimumVehicleUtilization: policy.minimumVehicleUtilization,
        maxStopsPerTrip: policy.maxStopsPerTrip,
      }
      payload.costAssumptions = { fuelPricePerLiter: policy.fuelPricePerLiter }
    }
    return payload
  }

  const run = async () => {
    if (!shiftId || !depotId) return push('Choose a shift and depot first.', 'error')
    if (fleetMode === 'MANUAL' && controlMode === 'GUIDED' && selectedVehicleIds.length === 0) return push('Select at least one eligible vehicle.', 'error')
    setRunning(true); setResult(null)
    try {
      const response = await runOptimization(buildPayload())
      setResult(response)
      setSelectedTripId(response.optimizationInput.routes[0]?.tripId ?? null)
      saveStoredPlan(response)
      const persisted = await transportPlansApi.create({ request: buildPayload(), result: response, status: 'DRAFT' })
      const scenarioKey = response.strategy ?? response.policyApplied?.strategy ?? 'BALANCED'
      setPersistedPlanId(persisted.id)
      setScenarioPlanIds((current) => ({ ...current, [scenarioKey]: persisted.id }))
      setScenarioResults((current) => [response, ...current].slice(0, 4))
      const warningCount = response.optimizationInput.diagnostics?.warningCount ?? 0
      if (response.optimizationInput.allEmployeesAssigned && warningCount === 0) push('Transport plan generated with no quality warnings.')
      else if (response.optimizationInput.allEmployeesAssigned) push(`Plan generated with ${warningCount} quality warning(s).`, 'info')
      else push(`Plan generated with ${response.optimizationInput.unassignedEmployeeIds.length} unassigned employee(s).`, 'info')
    } catch (err) { push(apiErrorMessage(err), 'error') }
    finally { setRunning(false) }
  }

  const exportJson = () => { if (result) downloadText(`routepilot-${result.date}-${result.direction.toLowerCase()}.json`, JSON.stringify(result, null, 2)) }
  const exportCsv = () => {
    if (!result) return
    const rows = [['Trip','Vehicle','Employee','Pickup point','Origin time','Destination time','Ride time (min)']]
    for (const trip of result.optimizationInput.routes) for (const ride of trip.employeeRideTimes) {
      const point = result.optimizationInput.pickupPoints.find((pickupPoint) => pickupPoint.id === ride.pickupPointId)
      rows.push([String(trip.tripId), trip.assignedVehicle.name, `${ride.firstName} ${ride.lastName}`, point?.name ?? String(ride.pickupPointId), ride.originTime, ride.destinationTime, String(ride.rideTimeMinutes)])
    }
    downloadText(`routepilot-manifest-${result.date}.csv`, rows.map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv')
  }

  return <div className="planning-day v6-planner">
    <Panel className="plan-scope-panel">
      <div className="plan-scope-grid">
        <label>Date<input type="date" value={day} onChange={(event) => setDay(event.target.value)}/></label>
        <label>Shift<select value={shiftId} onChange={(event) => setShiftId(Number(event.target.value))}><option value="">Choose shift</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} · {shift.startTime}–{shift.endTime}</option>)}</select></label>
        <label>Depot<select value={depotId} onChange={(event) => setDepotId(Number(event.target.value))}><option value="">Choose depot</option>{depots.map((depot) => <option key={depot.id} value={depot.id}>{depot.name}</option>)}</select></label>
        <div className="direction-control"><span>Direction</span><div><button className={direction === 'INBOUND' ? 'active' : ''} onClick={() => setDirection('INBOUND')}>To workplace</button><button className={direction === 'OUTBOUND' ? 'active' : ''} onClick={() => setDirection('OUTBOUND')}>From workplace</button></div></div>
        <div className="scope-fact"><Users size={17}/><span><small>Demand</small><b>{presentRecords.length} present</b></span></div>
        <div className="scope-fact"><BusFront size={17}/><span><small>Eligible fleet</small><b>{eligibleFleet.length} · {fleetCapacity} seats</b></span></div>
      </div>
    </Panel>

    {!result && !running && <>
      <div className="planner-mode-row">
        <button className={`planner-mode-card ${controlMode === 'AUTOMATIC' ? 'active' : ''}`} onClick={() => { setControlMode('AUTOMATIC'); setFleetMode('AUTO') }}>
          <span className="mode-icon"><Sparkles size={19}/></span><span><b>Automatic</b><small>Choose a strategy. RoutePilot applies the backend defaults and considers every active vehicle.</small></span>{controlMode === 'AUTOMATIC' && <CheckCircle2 size={18}/>} 
        </button>
        <button className={`planner-mode-card ${controlMode === 'GUIDED' ? 'active' : ''}`} onClick={() => setControlMode('GUIDED')}>
          <span className="mode-icon"><SlidersHorizontal size={19}/></span><span><b>Guided</b><small>Control fleet eligibility, ride-time targets, stop limits, clustering, dwell and fuel assumptions.</small></span>{controlMode === 'GUIDED' && <CheckCircle2 size={18}/>} 
        </button>
      </div>

      {latestMatchingPlan && <SavedPlanResume
        plan={latestMatchingPlan}
        count={matchingPlans.length}
        onOpen={() => openSavedPlan(latestMatchingPlan)}
        onEdit={() => openSavedPlan(latestMatchingPlan, true)}
      />}

      <Panel className="strategy-panel" title="Optimization objective" subtitle="Choose what RoutePilot should optimize. The business constraints below remain the same across strategies so comparisons stay fair.">
        <div className="strategy-grid">
          {(Object.keys(STRATEGY_COPY) as OptimizationStrategy[]).map((key) => <button key={key} className={`strategy-card ${strategy === key ? 'active' : ''}`} onClick={() => applyStrategy(key)}>
            <span className={`strategy-radio ${strategy === key ? 'active' : ''}`}/>
            <b>{STRATEGY_COPY[key].title}</b>
            <small>{STRATEGY_COPY[key].description}</small>
            <em>{strategySummary(key)}</em>
          </button>)}
        </div>
      </Panel>

      {controlMode === 'GUIDED' && <div className="guided-layout">
        <Panel className="fleet-policy" title="Fleet eligibility" subtitle="Let RoutePilot choose from every active vehicle or explicitly control which vehicles are allowed.">
          <div className="segmented-policy"><button className={fleetMode === 'AUTO' ? 'active' : ''} onClick={() => { setFleetMode('AUTO'); setScenarioResults([]); setResult(null) }}>Automatic fleet</button><button className={fleetMode === 'MANUAL' ? 'active' : ''} onClick={() => { setFleetMode('MANUAL'); setScenarioResults([]); setResult(null) }}>Select manually</button></div>
          <div className="fleet-selection-summary"><span><b>{eligibleFleet.length}</b><small>eligible vehicles</small></span><span><b>{fleetCapacity}</b><small>available seats</small></span><span><b>{capacityHeadroom}</b><small>seat headroom</small></span><span><b>{requiredUtilization}%</b><small>required occupancy</small></span></div>
          {fleetMode === 'AUTO'
            ? <div className="auto-fleet-note"><Sparkles size={16}/><span><b>Automatic eligibility</b><small>Every active vehicle may be considered. The selected strategy chooses the feasible combination.</small></span></div>
            : <div className="vehicle-picker">{activeFleet.map((vehicle) => <VehicleChoice key={vehicle.id} vehicle={vehicle} checked={selectedVehicleIds.includes(vehicle.id)} onToggle={() => toggleVehicle(vehicle.id)}/>)}</div>}
        </Panel>

        <Panel className="constraints-panel" title="Operational constraints" subtitle="Business-facing limits and quality targets. Thresholds are reported as diagnostics by the current backend.">
          <div className="constraint-grid">
            <PolicyInput label="Maximum employee ride" value={policy.maxEmployeeRideMinutes} suffix="min" min={5} max={240} step={5} onChange={(value) => updatePolicy('maxEmployeeRideMinutes', value)}/>
            <PolicyInput label="Maximum stops / trip" value={policy.maxStopsPerTrip} suffix="stops" min={1} max={25} step={1} onChange={(value) => updatePolicy('maxStopsPerTrip', value)}/>
            <PolicyInput label="Minimum utilization" value={Math.round(policy.minimumVehicleUtilization * 100)} suffix="%" min={0} max={100} step={5} onChange={(value) => updatePolicy('minimumVehicleUtilization', value / 100)}/>
          </div>
          <button className="advanced-toggle" onClick={() => setAdvancedOpen((value) => !value)}><Settings2 size={15}/>Advanced planning assumptions<ChevronDown size={15} className={advancedOpen ? 'open' : ''}/></button>
          {advancedOpen && <div className="advanced-policy-grid">
            <PolicyInput label="Cluster distance" value={policy.maxClusterDistanceKm} suffix="km" min={1} max={100} step={1} onChange={(value) => updatePolicy('maxClusterDistanceKm', value)}/>
            <PolicyInput label="Stop dwell" value={policy.dwellMinutesPerStop} suffix="min" min={0} max={30} step={1} onChange={(value) => updatePolicy('dwellMinutesPerStop', value)}/>
            <PolicyInput label="Fuel price" value={policy.fuelPricePerLiter} suffix="MAD/L" min={0} max={100} step={0.5} onChange={(value) => updatePolicy('fuelPricePerLiter', value)}/>
          </div>}
        </Panel>
      </div>}

      <div className="planning-snapshot">
        <div><span className="snapshot-icon green"><Users size={19}/></span><p><strong>{presentRecords.length}</strong><span>Employees in scope</span><small>{missingPickupCount ? `${missingPickupCount} missing pickup point` : 'All pickup assignments complete'}</small></p></div>
        <div><span className="snapshot-icon blue"><MapPin size={19}/></span><p><strong>{activePickupPoints.length}</strong><span>Pickup points</span><small>{direction === 'INBOUND' ? 'Collection network' : 'Drop-off network'}</small></p></div>
        <div><span className="snapshot-icon purple"><BusFront size={19}/></span><p><strong>{fleetCapacity}</strong><span>Eligible seats</span><small>{capacityHeadroom >= 0 ? `${capacityHeadroom} seats of headroom` : `${Math.abs(capacityHeadroom)} seats short`}</small></p></div>
        <div><span className="snapshot-icon amber"><Clock3 size={19}/></span><p><strong>{targetTime ?? '—'}</strong><span>{direction === 'INBOUND' ? 'Required arrival' : 'Shift departure'}</span><small>{selectedShift?.name ?? 'Choose a shift'}</small></p></div>
      </div>

      {missingPickupCount > 0 && <div className="planning-warning"><CircleAlert size={18}/><div><b>{missingPickupCount} present employee{missingPickupCount === 1 ? '' : 's'} cannot be routed yet</b><span>Assign a pickup point before running optimization so the plan does not strand employees.</span></div></div>}

      <div className="planning-cockpit v6-cockpit">
        <Panel className="demand-panel" title="Demand by pickup point" subtitle={`${presentRecords.length} present employees across ${activePickupPoints.length} active stops`}>
          {demandByPoint.length ? <div className="demand-list">{demandByPoint.map(({ point, count }, index) => {
            const share = presentRecords.length ? Math.round((count / presentRecords.length) * 100) : 0
            return <div className="demand-row" key={point.id}><div className="demand-index">{String(index + 1).padStart(2, '0')}</div><div className="demand-main"><div><b>{point.name}</b><span>{count} employee{count === 1 ? '' : 's'}</span></div><div className="demand-bar"><i style={{ width: `${Math.max(6, share)}%` }}/></div></div><strong>{share}%</strong></div>
          })}<div className="demand-foot"><span><Users size={13}/>{presentRecords.length} demand</span><span><MapPin size={13}/>{activePickupPoints.length} stops</span></div></div> : <EmptyState title="No pickup demand" description="No present employees with pickup points are available for this shift/date."/>}
        </Panel>

        <Panel className="planning-network-panel" title="Transport network" subtitle="Live pickup points in scope and selected depot">
          <div className="planning-network-map">{selectedDepot && activePickupPoints.length
            ? <NetworkMap pickupPoints={activePickupPoints} depots={[selectedDepot]} />
            : <EmptyState title="Network not ready" description="Choose a depot and load attendance with pickup points."/>}</div>
          <div className="planning-map-legend"><span><i className="legend-stop"/>Pickup stop</span><span><i className="legend-depot"/>Depot</span><em>Planning input view · road routes are calculated after optimization</em></div>
        </Panel>

        <div className="planning-side-stack">
          <Panel className="plan-brief" title="Plan brief" subtitle="Everything RoutePilot will send to the optimizer">
            <div className="brief-route"><div className="brief-terminal"><MapPin size={16}/></div><div><small>{direction === 'INBOUND' ? 'ORIGIN NETWORK' : 'WORKPLACE'}</small><b>{direction === 'INBOUND' ? `${activePickupPoints.length} pickup points` : selectedDepot?.name ?? 'Depot'}</b></div><Route size={17}/><div className="brief-destination"><small>{direction === 'INBOUND' ? 'DESTINATION' : 'DROP-OFF NETWORK'}</small><b>{direction === 'INBOUND' ? selectedDepot?.name ?? 'Depot' : `${activePickupPoints.length} pickup points`}</b></div></div>
            <div className="brief-facts"><div><span>Planning mode</span><b>{controlMode === 'AUTOMATIC' ? 'Automatic' : 'Guided'}</b></div><div><span>Strategy</span><b>{STRATEGY_COPY[strategy].short}</b></div><div><span>Target time</span><b>{targetTime ?? '—'}</b></div><div><span>Fleet eligibility</span><b>{controlMode === 'AUTOMATIC' || fleetMode === 'AUTO' ? 'Automatic' : `${eligibleFleet.length} selected`}</b></div></div>
            <div className="brief-readiness"><Ready ok={presentRecords.length > 0} title="Attendance" detail={`${presentRecords.length} present employees`}/><Ready ok={missingPickupCount === 0 && presentRecords.length > 0} title="Pickup assignments" detail={missingPickupCount ? `${missingPickupCount} employee(s) missing a stop` : 'All present employees routable'}/><Ready ok={eligibleFleet.length > 0 && fleetCapacity >= presentRecords.length} title="Fleet capacity" detail={`${fleetCapacity} seats for ${presentRecords.length} employees`}/><Ready ok={Boolean(selectedDepot)} title="Depot" detail={selectedDepot?.name ?? 'Choose a depot'}/></div>
            <button className="btn primary planning-hero-run" onClick={run} disabled={!readyToPlan}><Sparkles size={19}/><span><b>Generate transport plan</b><small>{readyToPlan ? `${STRATEGY_COPY[strategy].title} · ${controlMode === 'AUTOMATIC' ? 'backend defaults' : 'guided policy'}` : 'Resolve readiness issues first'}</small></span></button>
          </Panel>
          <Panel className="pipeline-panel" title="What RoutePilot optimizes"><div className="pipeline-vertical"><span><em>01</em><div><b>Road matrix</b><small>Real road distance & time</small></div></span><span><em>02</em><div><b>Cluster demand</b><small>Policy-controlled grouping</small></div></span><span><em>03</em><div><b>Allocate fleet</b><small>Strategy-aware vehicle combinations</small></div></span><span><em>04</em><div><b>Create trips</b><small>Passengers and stop order</small></div></span><span><em>05</em><div><b>Schedule & diagnose</b><small>Ride times, cost and warnings</small></div></span></div></Panel>
        </div>
      </div>
    </>}

    {running && <div className="optimizer-progress"><div className="optimizer-spinner"><Sparkles size={24}/></div><h2>Preparing transport plan</h2><p>Road matrix, clustering, strategy-aware fleet selection, routing and quality diagnostics are running on the backend.</p><div className="progress-steps"><span className="done">Scope & policy</span><span className="active">Road matrix & optimizer</span><span>Trips & schedules</span><span>Diagnostics</span></div></div>}

    {result && <>
      <ResultPolicyBar result={result} onReconfigure={() => { setResult(null); setManualOpen(false) }}/>
      <PlanDiagnostics result={result} onReview={() => setIssuesOpen(true)}/>
      <ManualEditLaunch disabled={!persistedPlanId && !planForCurrentResult && !latestMatchingPlan} onOpen={openManualEditor}/>
      {scenarioResults.length > 1 && <ScenarioComparison results={scenarioResults} current={result} onSelect={(scenario) => {
        const scenarioKey = scenario.strategy ?? scenario.policyApplied?.strategy ?? 'BALANCED'
        setResult(scenario)
        setPersistedPlanId(scenarioPlanIds[scenarioKey] ?? null)
        setSelectedTripId(scenario.optimizationInput.routes[0]?.tripId ?? null)
      }}/>} 
      <PlanWorkspace result={result} selectedTrip={selectedTrip} selectedTripId={selectedTripId} setSelectedTripId={setSelectedTripId} tab={tab} setTab={setTab} exportJson={exportJson} exportCsv={exportCsv}/>
    </>}
    {issuesOpen && result && <PlanIssueDrawer result={result} onClose={() => setIssuesOpen(false)} onTryComfort={() => { setIssuesOpen(false); applyStrategy('EMPLOYEE_COMFORT'); setResult(null); setPersistedPlanId(null) }}/>} 
    {manualOpen && result && (persistedPlanId ?? planForCurrentResult?.id ?? latestMatchingPlan?.id) && <ManualPlanEditor
      basePlanId={(persistedPlanId ?? planForCurrentResult?.id ?? latestMatchingPlan?.id)!}
      result={result}
      availableVehicles={activeFleet}
      onClose={() => setManualOpen(false)}
      onSaved={(plan) => {
        setResult(plan.result)
        setPersistedPlanId(plan.id)
        setSelectedTripId(plan.result.optimizationInput.routes[0]?.tripId ?? null)
        setManualOpen(false)
        void refreshAll()
        push(`Manual adjustment saved as plan v${plan.version}.`)
      }}
    />}
  </div>
}

function SavedPlanResume({ plan, count, onOpen, onEdit }: { plan: PersistedTransportPlan; count: number; onOpen: () => void; onEdit: () => void }) {
  return <div className="manual-edit-launch saved-plan-resume">
    <div><span className="manual-edit-icon"><Save size={18}/></span><span><b>Saved plan available</b><small>Latest matching plan: v{plan.version} · {plan.status.toLowerCase()}{count > 1 ? ` · ${count} saved versions` : ''}. Continue without running optimization again.</small></span></div>
    <div className="manual-editor-actions"><button className="btn ghost" onClick={onOpen}>Open plan</button><button className="btn" onClick={onEdit}><Settings2 size={15}/>Edit manually</button></div>
  </div>
}

function ManualEditLaunch({ disabled, onOpen }: { disabled: boolean; onOpen: () => void }) {
  return <div className="manual-edit-launch">
    <div><span className="manual-edit-icon"><Settings2 size={18}/></span><span><b>Operator adjustment</b><small>Change vehicles, passenger assignments and stop order. RoutePilot recalculates the plan on the backend before it can be saved.</small></span></div>
    <button className="btn" disabled={disabled} onClick={onOpen}><Settings2 size={15}/>Edit plan manually</button>
  </div>
}

type ManualTripDraft = Required<Pick<ManualTripEdit, 'vehicleId' | 'employeeIds' | 'orderedPointIds'>> & { tripId: number }

function manualDraftFromResult(result: OptimizationPreviewResponse): ManualTripDraft[] {
  return result.optimizationInput.routes.map((route) => ({
    tripId: route.tripId,
    vehicleId: route.assignedVehicle.id,
    employeeIds: [...route.employeeIds],
    orderedPointIds: [...route.orderedPointIds],
  }))
}

function ManualPlanEditor({ basePlanId, result, availableVehicles, onClose, onSaved }: { basePlanId: number; result: OptimizationPreviewResponse; availableVehicles: Vehicle[]; onClose: () => void; onSaved: (plan: PersistedTransportPlan) => void }) {
  const { push } = useToast()
  const [drafts, setDrafts] = useState<ManualTripDraft[]>(() => manualDraftFromResult(result))
  const [validation, setValidation] = useState<ManualPlanValidationResponse | null>(null)
  const [validating, setValidating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draggedStop, setDraggedStop] = useState<{ tripId: number; pointId: number } | null>(null)

  const employeeById = useMemo(() => new Map(result.optimizationInput.employees.map((employee) => [employee.id, employee])), [result])
  const pointById = useMemo(() => new Map(result.optimizationInput.pickupPoints.map((point) => [point.id, point])), [result])
  const vehicleById = useMemo(() => new Map(availableVehicles.map((vehicle) => [vehicle.id, vehicle])), [availableVehicles])
  const preview = validation?.result ?? result

  const invalidate = (next: ManualTripDraft[]) => { setDrafts(next); setValidation(null) }
  const tripForEmployee = (employeeId: number) => drafts.find((trip) => trip.employeeIds.includes(employeeId))

  const normalizeTripAfterEmployeeRemoval = (trip: ManualTripDraft, remainingEmployeeIds: number[]) => {
    const usedPointIds = new Set(remainingEmployeeIds.map((id) => employeeById.get(id)?.pickupPointId).filter((id): id is number => typeof id === 'number'))
    return { ...trip, employeeIds: remainingEmployeeIds, orderedPointIds: trip.orderedPointIds.filter((pointId) => usedPointIds.has(pointId)) }
  }

  const changeVehicle = (tripId: number, vehicleId: number) => invalidate(drafts.map((trip) => trip.tripId === tripId ? { ...trip, vehicleId } : trip))
  const removeTrip = (tripId: number) => {
    const target = drafts.find((trip) => trip.tripId === tripId)
    if (!target) return
    if (target.employeeIds.length && !window.confirm('Removing this trip will temporarily leave its passengers unassigned. Continue?')) return
    invalidate(drafts.filter((trip) => trip.tripId !== tripId))
  }
  const addTrip = () => {
    const used = new Set(drafts.map((trip) => trip.vehicleId))
    const vehicle = availableVehicles.find((item) => !used.has(item.id))
    if (!vehicle) return push('Every eligible vehicle is already assigned to a trip.', 'info')
    const nextId = Math.max(0, ...drafts.map((trip) => trip.tripId)) + 1
    invalidate([...drafts, { tripId: nextId, vehicleId: vehicle.id, employeeIds: [], orderedPointIds: [] }])
  }
  const moveStop = (fromTripId: number, toTripId: number, pointId: number, targetIndex?: number) => {
    if (fromTripId === toTripId) {
      const trip = drafts.find((item) => item.tripId === fromTripId)
      if (!trip) return
      const currentIndex = trip.orderedPointIds.indexOf(pointId)
      if (currentIndex < 0) return
      const nextOrder = [...trip.orderedPointIds]
      nextOrder.splice(currentIndex, 1)
      const insertAt = Math.max(0, Math.min(targetIndex ?? nextOrder.length, nextOrder.length))
      nextOrder.splice(insertAt, 0, pointId)
      invalidate(drafts.map((item) => item.tripId === fromTripId ? { ...item, orderedPointIds: nextOrder } : item))
      return
    }
    const from = drafts.find((trip) => trip.tripId === fromTripId)
    const to = drafts.find((trip) => trip.tripId === toTripId)
    if (!from || !to) return
    const movingEmployees = from.employeeIds.filter((employeeId) => employeeById.get(employeeId)?.pickupPointId === pointId)
    const next = drafts.map((trip) => {
      if (trip.tripId === fromTripId) return normalizeTripAfterEmployeeRemoval(trip, trip.employeeIds.filter((id) => !movingEmployees.includes(id)))
      if (trip.tripId === toTripId) {
        const employeeIds = [...trip.employeeIds, ...movingEmployees.filter((id) => !trip.employeeIds.includes(id))]
        const orderedPointIds = trip.orderedPointIds.includes(pointId) ? trip.orderedPointIds : [...trip.orderedPointIds, pointId]
        return { ...trip, employeeIds, orderedPointIds }
      }
      return trip
    })
    invalidate(next)
  }
  const reorderStop = (tripId: number, pointId: number, delta: number) => {
    const trip = drafts.find((item) => item.tripId === tripId); if (!trip) return
    const index = trip.orderedPointIds.indexOf(pointId); const nextIndex = index + delta
    if (index < 0 || nextIndex < 0 || nextIndex >= trip.orderedPointIds.length) return
    moveStop(tripId, tripId, pointId, nextIndex)
  }
  const moveEmployee = (employeeId: number, toTripId: number) => {
    const from = tripForEmployee(employeeId); const to = drafts.find((trip) => trip.tripId === toTripId)
    if (!from || !to || from.tripId === toTripId) return
    const pointId = employeeById.get(employeeId)?.pickupPointId
    const next = drafts.map((trip) => {
      if (trip.tripId === from.tripId) return normalizeTripAfterEmployeeRemoval(trip, trip.employeeIds.filter((id) => id !== employeeId))
      if (trip.tripId === toTripId) return {
        ...trip,
        employeeIds: [...trip.employeeIds, employeeId],
        orderedPointIds: pointId && !trip.orderedPointIds.includes(pointId) ? [...trip.orderedPointIds, pointId] : trip.orderedPointIds,
      }
      return trip
    })
    invalidate(next)
  }
  const reset = () => { setDrafts(manualDraftFromResult(result)); setValidation(null) }
  const payload = () => ({ trips: drafts.map(({ tripId, vehicleId, employeeIds, orderedPointIds }) => ({ tripId, vehicleId, employeeIds, orderedPointIds })) })
  const validate = async () => {
    setValidating(true)
    try { const response = await transportPlansApi.validateManual(basePlanId, payload()); setValidation(response); push(response.valid ? 'Manual plan is structurally valid.' : `${response.violations.length} hard validation issue(s) remain.`, response.valid ? 'success' : 'info'); return response }
    catch (err) { push(apiErrorMessage(err), 'error'); return null }
    finally { setValidating(false) }
  }
  const save = async () => {
    setSaving(true)
    try {
      const checked = validation ?? await transportPlansApi.validateManual(basePlanId, payload())
      setValidation(checked)
      if (!checked.valid) { push('Fix hard validation issues before saving a manual version.', 'error'); return }
      const saved = await transportPlansApi.createManualVersion(basePlanId, payload())
      onSaved(saved)
    } catch (err) { push(apiErrorMessage(err), 'error') }
    finally { setSaving(false) }
  }

  const totals = preview.optimizationInput.totals
  return <Modal wide className="manual-editor-modal" title="Manual trip editing" subtitle="Operator changes are recalculated against the original road matrix. Hard structural checks must pass before a new version can be saved." onClose={onClose}>
    <div className="manual-editor-toolbar">
      <div className={`manual-validation-state ${validation ? (validation.valid ? 'valid' : 'invalid') : ''}`}>
        {validation?.valid ? <CheckCircle2 size={18}/> : <CircleAlert size={18}/>}<span><b>{validation ? (validation.valid ? 'Ready to save' : `${validation.violations.length} hard issue(s)`) : 'Not validated yet'}</b><small>{validation ? `${validation.summary.qualityWarningCount} quality warning(s) after recalculation` : 'Edit the plan, then validate it on the backend.'}</small></span>
      </div>
      <div className="manual-editor-actions"><button className="btn ghost" onClick={reset}><RotateCcw size={14}/>Reset</button><button className="btn" disabled={validating} onClick={() => void validate()}><CheckCircle2 size={14}/>{validating ? 'Validating…' : 'Validate'}</button><button className="btn primary" disabled={saving || validation?.valid !== true} onClick={() => void save()}><Save size={14}/>{saving ? 'Saving…' : 'Save new version'}</button></div>
    </div>

    <div className="manual-preview-metrics"><span><b>{totals.totalTrips}</b><small>Trips</small></span><span><b>{formatNumber(totals.totalDistanceKm)} km</b><small>Distance</small></span><span><b>{formatNumber(totals.averageRideMinutes ?? 0,0)} min</b><small>Avg ride</small></span><span><b>{formatNumber(totals.maxRideMinutes ?? 0,0)} min</b><small>Max ride</small></span><span><b>{totals.costDataComplete === false ? '≥ ' : ''}{formatMoney(totals.totalOperatingCost)}</b><small>Variable cost</small></span></div>

    {validation && !validation.valid && <div className="manual-hard-issues">{validation.violations.map((violation, index) => <div key={`${violation.type}-${index}`}><CircleAlert size={15}/><span><b>{violation.type.replaceAll('_',' ')}</b><small>{violation.message}</small></span></div>)}</div>}

    <div className="manual-trip-list">
      {drafts.map((trip) => {
        const vehicle = vehicleById.get(trip.vehicleId)
        const usedByOthers = new Set(drafts.filter((item) => item.tripId !== trip.tripId).map((item) => item.vehicleId))
        const validatedTrip = validation?.result.optimizationInput.routes.find((item) => item.tripId === trip.tripId)
        return <section className="manual-trip-card" key={trip.tripId} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedStop) { moveStop(draggedStop.tripId, trip.tripId, draggedStop.pointId); setDraggedStop(null) } }}>
          <header><div><span className="manual-trip-number">Trip {trip.tripId}</span><b>{vehicle?.name ?? 'Vehicle'}</b><small>{trip.employeeIds.length} passengers · {vehicle?.capacity ?? 0} seats{validatedTrip ? ` · ${formatNumber(validatedTrip.totalDistanceKm)} km` : ''}</small></div><div><select value={trip.vehicleId} onChange={(event) => changeVehicle(trip.tripId, Number(event.target.value))}>{availableVehicles.map((item) => <option key={item.id} value={item.id} disabled={usedByOthers.has(item.id)}>{item.name} · {item.capacity} seats</option>)}</select><button className="icon-btn danger" title="Remove trip" onClick={() => removeTrip(trip.tripId)}><Trash2 size={15}/></button></div></header>
          <div className="manual-trip-columns">
            <div className="manual-stops"><div className="manual-section-head"><b>Stop order</b><small>Drag stops between trips; use arrows to reorder within a trip.</small></div>{trip.orderedPointIds.length ? trip.orderedPointIds.map((pointId, index) => <div className="manual-stop-row" draggable onDragStart={() => setDraggedStop({ tripId: trip.tripId, pointId })} onDragEnd={() => setDraggedStop(null)} key={pointId}><GripVertical size={14}/><span><b>{index + 1}. {pointById.get(pointId)?.name ?? `Stop #${pointId}`}</b><small>{trip.employeeIds.filter((id) => employeeById.get(id)?.pickupPointId === pointId).length} passenger(s)</small></span><button className="icon-btn" disabled={index === 0} onClick={() => reorderStop(trip.tripId, pointId, -1)}><ArrowUp size={13}/></button><button className="icon-btn" disabled={index === trip.orderedPointIds.length - 1} onClick={() => reorderStop(trip.tripId, pointId, 1)}><ArrowDown size={13}/></button><select value={trip.tripId} aria-label="Move stop to trip" onChange={(event) => moveStop(trip.tripId, Number(event.target.value), pointId)}>{drafts.map((target) => <option key={target.tripId} value={target.tripId}>Trip {target.tripId}</option>)}</select></div>) : <div className="manual-empty">Move passengers here to create stops.</div>}</div>
            <div className="manual-passengers"><div className="manual-section-head"><b>Passengers</b><small>Moving a passenger adds/removes their pickup stop automatically.</small></div>{trip.employeeIds.length ? trip.employeeIds.map((employeeId) => { const employee = employeeById.get(employeeId); return <div className="manual-passenger-row" key={employeeId}><span><b>{employee ? `${employee.firstName} ${employee.lastName}` : `Employee #${employeeId}`}</b><small>{employee?.pickupPoint?.name ?? pointById.get(employee?.pickupPointId ?? 0)?.name ?? 'Pickup point'}</small></span><select value={trip.tripId} aria-label="Move passenger to trip" onChange={(event) => moveEmployee(employeeId, Number(event.target.value))}>{drafts.map((target) => <option key={target.tripId} value={target.tripId}>Trip {target.tripId}</option>)}</select></div> }) : <div className="manual-empty">No passengers yet.</div>}</div>
          </div>
        </section>
      })}
      <button className="manual-add-trip" onClick={addTrip}><Plus size={16}/>Add another trip with an unused vehicle</button>
    </div>
  </Modal>
}

function VehicleChoice({ vehicle, checked, onToggle }: { vehicle: Vehicle; checked: boolean; onToggle: () => void }) {
  const variableFuel = vehicle.fuelConsumption == null ? '—' : `${vehicle.fuelConsumption} L/100km`
  const maintenance = vehicle.maintenanceCostPerKm ?? vehicle.costPerKm ?? null
  const fuelCost = vehicle.fuelConsumption == null ? null : vehicle.fuelConsumption / 100 * 14
  const variableCost = (fuelCost ?? 0) + (maintenance ?? 0)
  const complete = fuelCost != null && maintenance != null
  return <button className={`vehicle-choice ${checked ? 'active' : ''}`} onClick={onToggle}>
    <span className="vehicle-check">{checked ? <CheckCircle2 size={16}/> : <span/>}</span>
    <span className="vehicle-choice-main"><b>{vehicle.name}</b><small>{vehicle.registration} · {vehicle.planningPriority === 'RESERVE' ? 'Reserve' : vehicle.planningPriority === 'PREFERRED' ? 'Preferred' : 'Normal'}</small></span>
    <span><b>{vehicle.capacity}</b><small>seats</small></span>
    <span><b>{variableFuel}</b><small>fuel</small></span>
    <span><b>{variableCost ? `${complete ? '' : '≥ '}${formatNumber(variableCost,2)} MAD` : '—'}</b><small>variable / km</small></span>
  </button>
}

function PolicyInput({ label, value, suffix, min, max, step, onChange }: { label: string; value: number; suffix: string; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="policy-input"><span>{label}</span><div><input type="number" min={min} max={max} step={step} value={Number.isFinite(value) ? value : min} onChange={(event) => {
    const parsed = Number(event.target.value)
    if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)))
  }}/><em>{suffix}</em></div></label>
}

function strategySummary(strategy: OptimizationStrategy) {
  if (strategy === 'LOWEST_COST') return 'Select by final routed variable cost'
  if (strategy === 'EMPLOYEE_COMFORT') return 'Minimize ride-time violations and long rides'
  if (strategy === 'FLEET_EFFICIENCY') return 'Minimize trips and improve seat utilization'
  return 'Balance quality, ride time, cost and fleet use'
}

function ResultPolicyBar({ result, onReconfigure }: { result: OptimizationPreviewResponse; onReconfigure: () => void }) {
  const policy = result.policyApplied ?? result.optimizationInput.policyApplied
  const strategy = result.strategy ?? policy?.strategy ?? 'BALANCED'
  return <div className="result-policy-bar">
    <div><span className="policy-mark"><SlidersHorizontal size={18}/></span><span><small>PLAN POLICY</small><b>{STRATEGY_COPY[strategy].title}</b></span></div>
    <span><small>Eligible fleet</small><b>{result.selectedVehicleCount ?? result.optimizationInput.vehicles.length} vehicles · {result.totalVehicleCapacity} seats</b></span>
    <span><small>Max ride target</small><b>{policy?.maxEmployeeRideMinutes ?? '—'} min</b></span>
    <span><small>Max stops</small><b>{policy?.maxStopsPerTrip ?? '—'}</b></span>
    <span><small>Min utilization</small><b>{policy ? `${Math.round(policy.minimumVehicleUtilization * 100)}%` : '—'}</b></span>
    <span><small>Candidates checked</small><b>{result.optimizationInput.optimizationDecision?.candidatePlansEvaluated ?? result.optimizationInput.diagnostics?.candidatePlansEvaluated ?? '—'}</b></span>
    <button className="btn ghost" onClick={onReconfigure}><Settings2 size={15}/>Change policy</button>
  </div>
}

function PlanDiagnostics({ result, onReview }: { result: OptimizationPreviewResponse; onReview: () => void }) {
  const diagnostics = result.optimizationInput.diagnostics
  if (!diagnostics) return null
  const ride = diagnostics.rideTimeWarnings?.length ?? 0
  const stops = diagnostics.stopCountWarnings?.length ?? 0
  const utilization = diagnostics.utilizationWarnings?.length ?? 0
  const cost = diagnostics.costDataWarnings?.length ?? 0
  const unassigned = result.optimizationInput.unassignedEmployeeIds.length
  const total = diagnostics.warningCount ?? ride + stops + utilization + cost + unassigned
  return <div className={`diagnostics-strip v9-diagnostics ${total ? 'warning' : 'clean'}`}>
    <div>{total ? <CircleAlert size={20}/> : <CheckCircle2 size={20}/>}<span><b>{total ? `${total} issue${total === 1 ? '' : 's'} require review` : 'Plan passes current quality checks'}</b><small>{total ? `${ride} ride-time · ${stops} stop-count · ${utilization} utilization · ${cost} cost-data · ${unassigned} unassigned` : 'No current planning thresholds or data checks are violated.'}</small></span></div>
    {total > 0 && <button className="btn ghost" onClick={onReview}>Review issues</button>}
  </div>
}

function PlanIssueDrawer({ result, onClose, onTryComfort }: { result: OptimizationPreviewResponse; onClose: () => void; onTryComfort: () => void }) {
  const d = result.optimizationInput.diagnostics
  const employeeName = (id: number) => {
    const employee = result.optimizationInput.employees.find((item) => item.id === id)
    return employee ? `${employee.firstName} ${employee.lastName}` : `Employee #${id}`
  }
  return <Drawer title="Plan issues" subtitle="Operational exceptions to review before approval or publication." onClose={onClose}>
    <div className="issue-summary-grid">
      <div><b>{d?.rideTimeWarnings?.length ?? 0}</b><span>Ride time</span></div><div><b>{d?.stopCountWarnings?.length ?? 0}</b><span>Stop count</span></div><div><b>{d?.utilizationWarnings?.length ?? 0}</b><span>Utilization</span></div><div><b>{d?.costDataWarnings?.length ?? 0}</b><span>Cost data</span></div>
    </div>
    {(d?.rideTimeWarnings?.length ?? 0) > 0 && <div className="issue-section"><div className="section-title-row"><h3>Ride-time target exceeded</h3><button className="text-link" onClick={onTryComfort}>Try Employee Comfort</button></div>{d!.rideTimeWarnings!.map((item, index) => <div className="issue-row" key={`${item.employeeId}-${index}`}><div><b>{employeeName(item.employeeId)}</b><small>Trip {item.tripId}</small></div><span><strong>{Math.round(item.rideTimeMinutes)} min</strong><small>Target ≤ {item.limitMinutes}</small></span></div>)}</div>}
    {(d?.stopCountWarnings?.length ?? 0) > 0 && <div className="issue-section"><h3>Stop-count target</h3>{d!.stopCountWarnings!.map((item) => <div className="issue-row" key={item.tripId}><div><b>Trip {item.tripId}</b><small>Route contains too many pickup stops</small></div><span><strong>{item.stopCount} stops</strong><small>Target ≤ {item.limitStops}</small></span></div>)}</div>}
    {(d?.utilizationWarnings?.length ?? 0) > 0 && <div className="issue-section"><h3>Low vehicle utilization</h3>{d!.utilizationWarnings!.map((item) => <div className="issue-row" key={`${item.tripId}-${item.vehicleId}`}><div><b>Trip {item.tripId}</b><small>{item.employeeCount} of {item.capacity} seats</small></div><span><strong>{Math.round(item.utilization*100)}%</strong><small>Target ≥ {Math.round(item.minimumUtilization*100)}%</small></span></div>)}</div>}
    {(d?.costDataWarnings?.length ?? 0) > 0 && <div className="issue-section"><h3>Incomplete vehicle economics</h3>{d!.costDataWarnings!.map((item) => <div className="issue-row" key={`${item.tripId}-${item.vehicleId}`}><div><b>{item.vehicleName}</b><small>Trip {item.tripId}</small></div><span><strong>Lower-bound cost</strong><small>{item.missingFuelConsumption ? 'Fuel consumption missing' : ''}{item.missingFuelConsumption && item.missingMaintenanceCost ? ' · ' : ''}{item.missingMaintenanceCost ? 'Maintenance cost missing' : ''}</small></span></div>)}</div>}
    {result.optimizationInput.unassignedEmployeeIds.length > 0 && <div className="issue-section"><h3>Unassigned employees</h3>{result.optimizationInput.unassignedEmployeeIds.map((id) => <div className="issue-row" key={id}><div><b>{employeeName(id)}</b><small>Not assigned to a vehicle trip</small></div><Badge tone="amber">Review</Badge></div>)}</div>}
  </Drawer>
}

function ScenarioComparison({ results, current, onSelect }: { results: OptimizationPreviewResponse[]; current: OptimizationPreviewResponse; onSelect: (result: OptimizationPreviewResponse) => void }) {
  const unique = results.filter((result, index, all) => all.findIndex((item) => (item.strategy ?? item.policyApplied?.strategy) === (result.strategy ?? result.policyApplied?.strategy)) === index).slice(0, 4)
  if (unique.length < 2) return null
  return <Panel className="scenario-compare v9-scenario" title="Scenario comparison" subtitle="Same demand, fleet and business constraints; only the optimization objective changes.">
    <div className="scenario-table"><div className="scenario-row head"><span>Strategy</span><span>Assigned</span><span>Trips</span><span>Distance</span><span>Cost</span><span>Avg ride</span><span>Max ride</span><span>Issues</span><span></span></div>{unique.map((scenario) => {
      const strategy = scenario.strategy ?? scenario.policyApplied?.strategy ?? 'BALANCED'
      const totals = scenario.optimizationInput.totals
      const rides = scenario.optimizationInput.routes.flatMap((route) => route.employeeRideTimes.map((ride) => ride.rideTimeMinutes))
      const avg = rides.length ? rides.reduce((sum, value) => sum + value, 0)/rides.length : 0
      const max = rides.length ? Math.max(...rides) : 0
      const selected = scenario === current
      return <div className={`scenario-row ${selected ? 'selected' : ''}`} key={`${strategy}-${totals.totalDistanceKm}`}><b>{STRATEGY_COPY[strategy].title}</b><span>{scenario.employeeCount - scenario.optimizationInput.unassignedEmployeeIds.length}/{scenario.employeeCount}</span><span>{totals.totalTrips}</span><span>{formatNumber(totals.totalDistanceKm)} km</span><span>{totals.costDataComplete === false ? '≥ ' : ''}{formatMoney(totals.totalOperatingCost)}</span><span>{formatNumber(avg,0)} min</span><span>{formatNumber(max,0)} min</span><span>{scenario.optimizationInput.diagnostics?.warningCount ?? 0}</span><span>{selected ? <Badge tone="blue">Working</Badge> : <button className="text-link" onClick={() => onSelect(scenario)}>Use</button>}</span></div>
    })}</div>
  </Panel>
}

function WeekPlanning({ anchorDay, setAnchorDay, openDay }: { anchorDay: string; setAnchorDay: (day: string) => void; openDay: (day: string) => void }) {
  const { shifts, depots, attendance, vehicles } = useData()
  const { push } = useToast()
  const [shiftId, setShiftId] = useState(shifts[0]?.id || 0)
  const [depotId, setDepotId] = useState(depots[0]?.id || 0)
  const [direction, setDirection] = useState<TripDirection>('INBOUND')
  const [strategy, setStrategy] = useState<OptimizationStrategy>('BALANCED')
  const [generating, setGenerating] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const days = weekDays(anchorDay)
  const plans = useMemo(() => getStoredPlans(), [historyVersion, anchorDay, shiftId, direction, strategy])
  const activeFleet = vehicles.filter((vehicle) => vehicle.active)

  useEffect(() => { if (!shiftId && shifts[0]) setShiftId(shifts[0].id) }, [shifts, shiftId])
  useEffect(() => { if (!depotId && depots[0]) setDepotId(depots[0].id) }, [depots, depotId])

  const latestPlan = (day: string): StoredPlan | undefined => plans.find((plan) => plan.response.date === day && plan.response.shift.id === shiftId && plan.response.direction === direction)
  const weekPlans = days.map(latestPlan).filter((plan): plan is StoredPlan => Boolean(plan))
  const totals = weekPlans.reduce((acc, plan) => {
    const total = plan.response.optimizationInput.totals
    acc.trips += total.totalTrips; acc.distance += total.totalDistanceKm; acc.fuel += total.totalEstimatedFuelLiters; acc.cost += total.totalOperatingCost
    return acc
  }, { trips: 0, distance: 0, fuel: 0, cost: 0 })
  const presentTotal = days.reduce((sum, day) => sum + attendance.filter((record) => record.shiftId === shiftId && record.present && sameIsoDay(record.date, day)).length, 0)

  const generateWeek = async () => {
    if (!shiftId || !depotId) return push('Choose a shift and depot first.', 'error')
    const eligibleDays = days.filter((day) => attendance.some((record) => record.shiftId === shiftId && record.present && sameIsoDay(record.date, day)))
    if (!eligibleDays.length) return push('There are no present attendance records for this shift in the selected week.', 'error')
    setGenerating(true)
    let generated = 0
    let failed = 0
    for (const day of eligibleDays) {
      try {
        const request = { shiftId, date: day, depotId, direction, strategy } as OptimizationPreviewRequest
        const response = await runOptimization(request)
        saveStoredPlan(response)
        await transportPlansApi.create({ request, result: response, status: 'DRAFT' })
        generated += 1
      } catch { failed += 1 }
    }
    setHistoryVersion((version) => version + 1); setGenerating(false)
    if (failed) push(`${generated} day plan(s) generated; ${failed} failed. Open individual days to review.`, 'info')
    else push(`${generated} day plan(s) generated using ${STRATEGY_COPY[strategy].title}.`)
  }

  const moveWeek = (offset: number) => setAnchorDay(addDays(startOfWeek(anchorDay), offset * 7))

  return <>
    <Panel className="weekly-planning-config"><div className="weekly-controls v6-week-controls">
      <div className="week-nav"><button className="icon-btn" onClick={() => moveWeek(-1)}><ChevronLeft size={17}/></button><button className="week-label" onClick={() => setAnchorDay(isoDayLocal())}>{weekRangeLabel(anchorDay)}</button><button className="icon-btn" onClick={() => moveWeek(1)}><ChevronRight size={17}/></button></div>
      <label>Shift<select value={shiftId} onChange={(event) => setShiftId(Number(event.target.value))}><option value="">Choose shift</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} · {shift.startTime}–{shift.endTime}</option>)}</select></label>
      <label>Depot<select value={depotId} onChange={(event) => setDepotId(Number(event.target.value))}><option value="">Choose depot</option>{depots.map((depot) => <option key={depot.id} value={depot.id}>{depot.name}</option>)}</select></label>
      <label>Strategy<select value={strategy} onChange={(event) => setStrategy(event.target.value as OptimizationStrategy)}>{(Object.keys(STRATEGY_COPY) as OptimizationStrategy[]).map((item) => <option key={item} value={item}>{STRATEGY_COPY[item].title}</option>)}</select></label>
      <div className="direction-control"><span>Direction</span><div><button className={direction === 'INBOUND' ? 'active' : ''} onClick={() => setDirection('INBOUND')}>To workplace</button><button className={direction === 'OUTBOUND' ? 'active' : ''} onClick={() => setDirection('OUTBOUND')}>From workplace</button></div></div>
      <button className="btn primary" onClick={generateWeek} disabled={generating || !shiftId || !depotId}><CalendarDays size={16}/>{generating ? 'Generating week…' : 'Generate week'}</button>
    </div></Panel>

    <div className="metrics-strip five weekly-metrics">
      <Metric icon={<Users size={18}/>} value={presentTotal} label="Present records" note="Across selected shift/week" tone="green"/>
      <Metric icon={<Route size={18}/>} value={totals.trips} label="Generated trips" note={`${weekPlans.length} planned day(s)`}/>
      <Metric icon={<MapPin size={18}/>} value={`${formatNumber(totals.distance)} km`} label="Total distance" note="Saved weekly plans"/>
      <Metric icon={<Fuel size={18}/>} value={`${formatNumber(totals.fuel, 2)} L`} label="Estimated fuel" note="Saved weekly plans" tone="purple"/>
      <Metric icon={<BusFront size={18}/>} value={formatMoney(totals.cost)} label="Variable cost" note={`${activeFleet.length} active vehicles`}/>
    </div>

    <div className="weekly-day-grid">{days.map((day) => {
      const records = attendance.filter((record) => record.shiftId === shiftId && sameIsoDay(record.date, day))
      const present = records.filter((record) => record.present).length
      const plan = latestPlan(day)
      const planTotals = plan?.response.optimizationInput.totals
      return <article className={`weekly-day-card ${day === isoDayLocal() ? 'today' : ''}`} key={day}>
        <div className="weekly-day-head"><div><span>{shortDay(day)}</span><small>{day}</small></div>{plan ? <Badge tone="green">Planned</Badge> : records.length ? <Badge tone="amber">Needs plan</Badge> : <Badge tone="neutral">No records</Badge>}</div>
        <div className="weekly-attendance"><Users size={16}/><div><b>{present}</b><span>present</span><small>{records.length - present} absent · {records.length} records</small></div></div>
        {planTotals ? <div className="weekly-plan-kpis"><span><b>{planTotals.totalTrips}</b> trips</span><span><b>{formatNumber(planTotals.totalDistanceKm)}</b> km</span><span><b>{planTotals.costDataComplete === false ? '≥ ' : ''}{formatMoney(planTotals.totalOperatingCost)}</b> cost</span></div> : <div className="weekly-plan-empty">{records.length ? 'Attendance exists. Generate this week or open the day to refine it.' : 'No attendance records for this shift/day yet.'}</div>}
        <button className="btn ghost full" onClick={() => openDay(day)}>{plan ? 'Open day plan' : records.length ? 'Plan this day' : 'Open day'}</button>
      </article>
    })}</div>
    <div className="weekly-note"><CircleAlert size={15}/><span><b>Weekly planning orchestrates the daily optimizer.</b> The selected strategy is applied to each eligible day independently. Each generated day is persisted as a draft plan. Cross-day fairness and a dedicated weekly-plan entity remain future work.</span></div>
  </>
}

function Ready({ ok, title, detail }: { ok: boolean; title: string; detail: string }) { return <div className="readiness-item">{ok ? <CheckCircle2 className="ok" size={20}/> : <CircleAlert className="warn" size={20}/>}<div><strong>{title}</strong><span>{detail}</span></div></div> }

function PlanWorkspace({ result, selectedTrip, selectedTripId, setSelectedTripId, tab, setTab, exportJson, exportCsv }: {
  result: OptimizationPreviewResponse; selectedTrip: OptimizationTrip | null; selectedTripId: number | null; setSelectedTripId: (id: number) => void; tab: 'stops'|'passengers'|'metrics'; setTab: (tab: 'stops'|'passengers'|'metrics') => void; exportJson: () => void; exportCsv: () => void
}) {
  const totals = result.optimizationInput.totals
  const unassigned = result.optimizationInput.unassignedEmployeeIds.length
  const rides = result.optimizationInput.routes.flatMap((r) => r.employeeRideTimes)
  const avgRide = rides.length ? rides.reduce((s, r) => s + r.rideTimeMinutes, 0) / rides.length : 0
  const maxRide = rides.length ? Math.max(...rides.map((r) => r.rideTimeMinutes)) : 0

  return <div className="plan-result">
    <div className={`plan-status ${unassigned ? 'warning' : 'success'}`}><div>{unassigned ? <CircleAlert size={20}/> : <CheckCircle2 size={20}/>}<span><b>{unassigned ? 'Plan generated with exceptions' : 'Plan ready'}</b><small>{result.employeeCount - unassigned} assigned · {unassigned} unassigned · {result.direction === 'INBOUND' ? 'to workplace' : 'from workplace'}</small></span></div><div className="export-buttons"><button className="btn ghost" onClick={exportCsv}><Download size={15}/> Passenger CSV</button><button className="btn primary" onClick={exportJson}><Download size={15}/> Export plan</button></div></div>
    <div className="metrics-strip six compact">
      <Metric icon={<Users size={18}/>} value={result.employeeCount - unassigned} label="Assigned employees" note={`${result.employeeCount} present`} tone="green"/>
      <Metric icon={<Route size={18}/>} value={totals.totalTrips} label="Total trips" note="Generated"/>
      <Metric icon={<MapPin size={18}/>} value={`${formatNumber(totals.totalDistanceKm)} km`} label="Total distance" note="Planned"/>
      <Metric icon={<Fuel size={18}/>} value={`${formatNumber(totals.totalEstimatedFuelLiters, 2)} L`} label="Estimated fuel" note={formatMoney(totals.totalEstimatedFuelCost)} tone="purple"/>
      <Metric icon={<WalletCards size={18}/>} value={`${totals.costDataComplete === false ? '≥ ' : ''}${formatMoney(totals.totalOperatingCost)}`} label="Variable cost" note={totals.costDataComplete === false ? "Lower-bound estimate" : "Fuel + maintenance"}/>
      <Metric icon={<CircleAlert size={18}/>} value={unassigned} label="Unassigned" note={unassigned ? 'Requires review' : 'Everyone assigned'} tone={unassigned ? 'amber' : 'green'}/>
    </div>

    <div className="plan-workspace">
      <aside className="trip-master"><div className="trip-master-head"><h2>Trips <Badge tone="blue">{result.optimizationInput.routes.length}</Badge></h2><span>Vehicle journeys</span></div>
        <div className="trip-list">{result.optimizationInput.routes.map((trip) => { const util = Math.round(trip.employeeCount / trip.assignedVehicle.capacity * 100); return <button key={trip.tripId} className={`trip-card ${selectedTripId === trip.tripId ? 'active' : ''}`} onClick={() => setSelectedTripId(trip.tripId)}><div className="trip-title"><BusFront size={18}/><span><b>{trip.assignedVehicle.name}</b><small>{trip.employeeCount} / {trip.assignedVehicle.capacity} passengers</small></span><Badge tone={util >= 95 ? 'green' : util >= 75 ? 'blue' : 'amber'}>{util}%</Badge></div><div className="trip-card-meta"><span><Clock3 size={13}/>{trip.schedule.departureTime} → {trip.schedule.arrivalTime}</span><span><Route size={13}/>{formatNumber(trip.totalDistanceKm)} km</span></div></button> })}</div>
      </aside>

      <section className="trip-detail-panel">{selectedTrip ? <>
        <div className="trip-detail-head"><div className="vehicle-title"><div className="vehicle-icon"><BusFront size={22}/></div><span><h2>{selectedTrip.assignedVehicle.name}</h2><small>{selectedTrip.employeeCount} / {selectedTrip.assignedVehicle.capacity} seats assigned</small></span></div><div className="trip-head-metrics"><span><b>{formatNumber(selectedTrip.totalDistanceKm)} km</b><small>Distance</small></span><span><b>{Math.round(selectedTrip.totalDurationMinutes)} min</b><small>Driving</small></span><span><b>{formatNumber(selectedTrip.routeCost.estimatedFuelLiters ?? 0, 2)} L</b><small>Est. fuel</small></span><span><b>{selectedTrip.routeCost.costDataComplete === false ? '≥ ' : ''}{formatMoney(selectedTrip.routeCost.operatingCost)}</b><small>Variable trip cost</small></span></div></div>
        <div className="detail-tabs"><button className={tab === 'stops' ? 'active' : ''} onClick={() => setTab('stops')}>Stops</button><button className={tab === 'passengers' ? 'active' : ''} onClick={() => setTab('passengers')}>Passengers</button><button className={tab === 'metrics' ? 'active' : ''} onClick={() => setTab('metrics')}>Metrics</button></div>
        {tab === 'stops' && <StopsTab result={result} trip={selectedTrip}/>} 
        {tab === 'passengers' && <PassengersTab result={result} trip={selectedTrip}/>} 
        {tab === 'metrics' && <MetricsTab trip={selectedTrip} avgRide={avgRide} maxRide={maxRide}/>} 
      </> : <EmptyState title="No vehicle trips" description="The optimizer did not generate any trip for this selection."/>}</section>
    </div>
  </div>
}

function StopsTab({ result, trip }: { result: OptimizationPreviewResponse; trip: OptimizationTrip }) {
  const lookupStop = (id: number) => result.optimizationInput.pickupPoints.find((p) => p.id === id)
  const stopRows = trip.schedule.stops.map((stop, index) => <div className="stop-row" key={`${stop.pickupPointId}-${index}`}><div className="stop-node">{index + 1}</div><div><b>{stop.arrivalTime}</b><span>{lookupStop(stop.pickupPointId)?.name ?? `Stop ${stop.pickupPointId}`}</span><small>Depart {stop.departureTime} · {stop.dwellMinutes} min dwell</small></div></div>)
  const depotRow = <div className="stop-row depot"><div className="stop-node">D</div><div><b>{trip.direction === 'INBOUND' ? trip.schedule.arrivalTime : trip.schedule.departureTime}</b><span>{result.depot.name}</span><small>{trip.direction === 'INBOUND' ? 'Company arrival' : 'Company departure'}</small></div></div>
  return <div className="stops-tab"><div className="stop-sequence"><div className="subheading">Stop sequence</div>{trip.direction === 'OUTBOUND' && depotRow}{stopRows}{trip.direction === 'INBOUND' && depotRow}</div><div className="route-preview"><div className="subheading">Stop sequence preview</div><div className="trip-map"><TripMap orderedPointIds={trip.orderedPointIds} pickupPoints={result.optimizationInput.pickupPoints} depot={result.depot} direction={trip.direction}/></div><div className="map-disclaimer">Dashed line shows stop order. The backend returns road distance/time matrices, not road geometry.</div></div></div>
}

function PassengersTab({ result, trip }: { result: OptimizationPreviewResponse; trip: OptimizationTrip }) {
  return <div className="passenger-tab"><div className="table-head passenger-cols"><span>Employee</span><span>Boarding / drop-off</span><span>Origin</span><span>Destination</span><span>Ride time</span></div>{trip.employeeRideTimes.map((ride) => <div className="table-row passenger-cols" key={ride.employeeId}><b>{ride.firstName} {ride.lastName}</b><span>{result.optimizationInput.pickupPoints.find((p) => p.id === ride.pickupPointId)?.name ?? ride.pickupPointId}</span><span>{ride.originTime}</span><span>{ride.destinationTime}</span><strong>{ride.rideTimeMinutes} min</strong></div>)}</div>
}

function MetricsTab({ trip, avgRide, maxRide }: { trip: OptimizationTrip; avgRide: number; maxRide: number }) {
  const util = trip.employeeCount / Math.max(1, trip.assignedVehicle.capacity) * 100
  return <div className="metrics-detail-grid"><div><span>Vehicle utilization</span><b>{Math.round(util)}%</b><small>{trip.employeeCount} of {trip.assignedVehicle.capacity} seats</small></div><div><span>Route distance</span><b>{formatNumber(trip.totalDistanceKm, 2)} km</b><small>{formatNumber(trip.stopDistanceKm, 2)} km between stops</small></div><div><span>Driving time</span><b>{Math.round(trip.totalDurationMinutes)} min</b><small>{trip.schedule.totalDwellMinutes} min total dwell</small></div><div><span>Estimated fuel</span><b>{formatNumber(trip.routeCost.estimatedFuelLiters ?? 0, 2)} L</b><small>{formatMoney(trip.routeCost.estimatedFuelCost)} at current fuel assumption</small></div><div><span>Variable trip cost</span><b>{trip.routeCost.costDataComplete === false ? '≥ ' : ''}{formatMoney(trip.routeCost.operatingCost)}</b><small>Fuel + maintenance/wear estimate</small></div><div><span>Employee ride time</span><b>{formatNumber(avgRide, 0)} min avg</b><small>{maxRide} min longest across this plan</small></div></div>
}

function csvCell(value: string) { const clean = value.replaceAll('"', '""'); return `"${clean}"` }
