import { AlertTriangle, BarChart3, BusFront, CalendarDays, CheckCircle2, Fuel, Gauge, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Sparkles, Trash2, Wrench } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { vehicleAvailabilityApi, vehiclesApi } from '../api/resources'
import { apiErrorMessage } from '../api/client'
import { Badge, Drawer, EmptyState, Modal, PageHeader, Panel } from '../components/UI'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import type { PersistedTransportPlan, Vehicle, VehiclePlanningPriority } from '../types'
import { formatMoney, formatNumber, isoDayLocal, sameIsoDay, shortDay, weekDays } from '../utils/format'

const emptyForm = {
  name: '', registration: '', capacity: '20', fuelConsumption: '', maintenanceCostPerKm: '', active: true,
  optimizerEligible: true, planningPriority: 'NORMAL' as VehiclePlanningPriority,
}
const FUEL_PRICE = 14

function maintenanceCost(vehicle: Vehicle) { return vehicle.maintenanceCostPerKm ?? vehicle.costPerKm ?? null }
function fuelCostPerKm(vehicle: Vehicle) { return vehicle.fuelConsumption == null ? null : (vehicle.fuelConsumption / 100) * FUEL_PRICE }
function variableCostPerKm(vehicle: Vehicle) {
  const fuel = fuelCostPerKm(vehicle); const maintenance = maintenanceCost(vehicle)
  if (fuel == null && maintenance == null) return null
  return (fuel ?? 0) + (maintenance ?? 0)
}
function economicsComplete(vehicle: Vehicle) { return vehicle.fuelConsumption != null && maintenanceCost(vehicle) != null }
function priority(vehicle: Vehicle): VehiclePlanningPriority { return vehicle.planningPriority ?? 'NORMAL' }

export default function FleetPage() {
  const { vehicles, vehicleAvailability, plans, refreshAll } = useData()
  const { push } = useToast()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selected, setSelected] = useState<Vehicle | null>(null)
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [drawerTab, setDrawerTab] = useState<'overview'|'availability'|'usage'|'economics'>('overview')
  const [availabilityVehicle, setAvailabilityVehicle] = useState<Vehicle | null>(null)
  const [availabilityForm, setAvailabilityForm] = useState({ date: isoDayLocal(), available: false, reason: 'Maintenance' })

  useEffect(() => { const focus = Number(params.get('focus')); if (focus) setSelected(vehicles.find((v) => v.id === focus) ?? null) }, [params, vehicles])
  useEffect(() => { if (selected) setDrawerTab('overview') }, [selected?.id])

  const isOperationalToday = (vehicle: Vehicle) => vehicle.active && !vehicleAvailability.some((item) => item.vehicleId === vehicle.id && sameIsoDay(item.date, isoDayLocal()) && item.available === false)
  const active = vehicles.filter(isOperationalToday)
  const seats = active.reduce((sum, v) => sum + v.capacity, 0)
  const incomplete = vehicles.filter((v) => v.active && !economicsComplete(v)).length
  const autoEligible = active.filter((v) => v.optimizerEligible !== false).length
  const week = weekDays(isoDayLocal())
  const effectiveWeekPlans = effectivePlansForDays(plans, week)
  const weekTrips = effectiveWeekPlans.reduce((sum, plan) => sum + plan.result.optimizationInput.totals.totalTrips, 0)

  const filtered = useMemo(() => vehicles.filter((v) => {
    const matchQuery = !query || `${v.name} ${v.registration}`.toLowerCase().includes(query.toLowerCase())
    const matchStatus = status === 'all' || (status === 'operational' ? isOperationalToday(v) : !isOperationalToday(v))
    const matchPriority = priorityFilter === 'all' || priority(v) === priorityFilter
    return matchQuery && matchStatus && matchPriority
  }), [vehicles, vehicleAvailability, query, status, priorityFilter])

  const openForm = (vehicle: Vehicle | 'new') => {
    setEditing(vehicle)
    setForm(vehicle === 'new' ? emptyForm : {
      name: vehicle.name,
      registration: vehicle.registration,
      capacity: String(vehicle.capacity),
      fuelConsumption: vehicle.fuelConsumption == null ? '' : String(vehicle.fuelConsumption),
      maintenanceCostPerKm: maintenanceCost(vehicle) == null ? '' : String(maintenanceCost(vehicle)),
      active: vehicle.active,
      optimizerEligible: vehicle.optimizerEligible !== false,
      planningPriority: priority(vehicle),
    })
  }

  const save = async () => {
    if (!form.name.trim() || !form.registration.trim() || !Number.isInteger(Number(form.capacity)) || Number(form.capacity) <= 0) return push('Name, registration and a positive integer capacity are required.', 'error')
    setSaving(true)
    const payload = {
      name: form.name.trim(), registration: form.registration.trim(), capacity: Number(form.capacity),
      fuelConsumption: form.fuelConsumption === '' ? null : Number(form.fuelConsumption),
      maintenanceCostPerKm: form.maintenanceCostPerKm === '' ? null : Number(form.maintenanceCostPerKm),
      active: form.active, optimizerEligible: form.optimizerEligible, planningPriority: form.planningPriority,
    }
    try {
      if (editing === 'new') await vehiclesApi.create(payload); else if (editing) await vehiclesApi.update(editing.id, payload)
      await refreshAll(); setEditing(null); push(editing === 'new' ? 'Vehicle created.' : 'Vehicle updated.')
    } catch (err) { push(apiErrorMessage(err), 'error') } finally { setSaving(false) }
  }

  const remove = async (vehicle: Vehicle) => {
    if (!window.confirm(`Delete ${vehicle.name}?`)) return
    try { await vehiclesApi.remove(vehicle.id); await refreshAll(); setSelected(null); push('Vehicle deleted.') } catch (err) { push(apiErrorMessage(err), 'error') }
  }

  const setAvailability = async () => {
    if (!availabilityVehicle) return
    setSaving(true)
    try {
      await vehicleAvailabilityApi.set({ vehicleId: availabilityVehicle.id, date: availabilityForm.date, available: availabilityForm.available, reason: availabilityForm.reason.trim() || null })
      await refreshAll(); push(`${availabilityVehicle.name} availability updated.`); setAvailabilityVehicle(null)
    } catch (err) { push(apiErrorMessage(err), 'error') } finally { setSaving(false) }
  }

  return <>
    <PageHeader eyebrow="RESOURCES" title="Fleet" subtitle="Manage capacity, availability, economics and how each vehicle participates in automatic planning." actions={<button className="btn primary" onClick={() => openForm('new')}><Plus size={16}/> Add vehicle</button>}/>

    <div className="resource-summary fleet v9-fleet-summary">
      <div><BusFront size={18}/><span><b>{active.length}</b>Operational today</span></div>
      <div><Gauge size={18}/><span><b>{seats}</b>Available seats</span></div>
      <div><Sparkles size={18}/><span><b>{autoEligible}</b>Auto-planning eligible</span></div>
      <div className={incomplete ? 'resource-warning' : ''}>{incomplete ? <AlertTriangle size={18}/> : <CheckCircle2 size={18}/>}<span><b>{incomplete}</b>Economics incomplete</span></div>
    </div>

    <div className="fleet-readiness-row">
      <Panel title="Fleet readiness" subtitle="What the optimizer can safely use today">
        <div className="fleet-readiness-list">
          <Readiness ok={active.length > 0} text={`${active.length} operational vehicle${active.length === 1 ? '' : 's'}`}/>
          <Readiness ok={autoEligible > 0} text={`${autoEligible} vehicle${autoEligible === 1 ? '' : 's'} eligible for automatic planning`}/>
          <Readiness ok={incomplete === 0} text={incomplete ? `${incomplete} vehicle${incomplete === 1 ? '' : 's'} missing economics data` : 'Economics complete for active fleet'}/>
          <Readiness ok={true} text={`${weekTrips} persisted trip${weekTrips === 1 ? '' : 's'} this week`}/>
        </div>
      </Panel>
      <Panel title="Planning priorities" subtitle="Control automatic fleet behavior without editing optimizer weights">
        <div className="priority-legend"><span><Badge tone="green">Preferred</Badge><small>Use first when choices are similar.</small></span><span><Badge tone="blue">Normal</Badge><small>Standard automatic planning.</small></span><span><Badge tone="amber">Reserve</Badge><small>Use only when needed for capacity.</small></span></div>
      </Panel>
    </div>

    <Panel className="resource-panel">
      <div className="resource-toolbar">
        <div className="inline-search"><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search vehicle or registration..."/></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All vehicles</option><option value="operational">Operational today</option><option value="unavailable">Unavailable today</option></select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}><option value="all">All priorities</option><option value="PREFERRED">Preferred</option><option value="NORMAL">Normal</option><option value="RESERVE">Reserve</option></select>
        <span className="result-count">{filtered.length} vehicles</span>
      </div>
      {filtered.length ? <div className="fleet-grid v9-fleet-grid">{filtered.map((v) => {
        const unavailable = vehicleAvailability.find((item) => item.vehicleId === v.id && sameIsoDay(item.date, isoDayLocal()) && item.available === false)
        const usage = usageForVehicle(v.id, plans, week)
        const variable = variableCostPerKm(v)
        return <article className="vehicle-card v9-vehicle-card" key={v.id}>
          <div className="vehicle-card-head"><div className="vehicle-icon"><BusFront size={20}/></div><div><h3>{v.name}</h3><span>{v.registration}</span></div><Badge tone={isOperationalToday(v) ? 'green' : 'amber'}>{isOperationalToday(v) ? 'Operational' : 'Unavailable'}</Badge></div>
          <div className="vehicle-priority-row"><Badge tone={priorityTone(priority(v))}>{priorityLabel(priority(v))}</Badge><span className={v.optimizerEligible !== false ? 'optimizer-enabled' : 'optimizer-disabled'}>{v.optimizerEligible !== false ? <><Sparkles size={13}/> Auto planning</> : <><ShieldCheck size={13}/> Manual only</>}</span></div>
          <div className="vehicle-kpis v9-vehicle-kpis">
            <div><span>Capacity</span><b>{v.capacity} seats</b></div>
            <div><span>Fuel</span><b>{v.fuelConsumption == null ? 'Not set' : `${v.fuelConsumption} L/100km`}</b></div>
            <div><span>Variable cost</span><b>{variable == null ? 'Not enough data' : `${economicsComplete(v) ? '' : '≥ '}${formatMoney(variable).replace(' MAD','')} MAD/km`}</b></div>
            <div><span>This week</span><b>{usage.trips} trips · {usage.avgUtilization}% avg</b></div>
          </div>
          {!economicsComplete(v) && <div className="vehicle-data-warning"><AlertTriangle size={14}/>Economics incomplete — cost scenarios are lower-bound estimates.</div>}
          <div className="vehicle-card-foot"><button className="text-link" onClick={() => { setAvailabilityVehicle(v); setAvailabilityForm({ date: isoDayLocal(), available: false, reason: unavailable?.reason ?? 'Maintenance' }) }}>Set availability</button><button className="icon-btn" onClick={() => setSelected(v)} aria-label={`Open ${v.name}`}><MoreHorizontal size={18}/></button></div>
        </article>
      })}</div> : <EmptyState title="No vehicles found" description="Adjust the filters or add a vehicle."/>}
    </Panel>

    {selected && <Drawer title={selected.name} subtitle={selected.registration} onClose={() => setSelected(null)}>
      <div className="drawer-profile"><div className="vehicle-icon large"><BusFront size={24}/></div><div className="drawer-badge-stack"><Badge tone={isOperationalToday(selected) ? 'green' : 'amber'}>{isOperationalToday(selected) ? 'Operational today' : 'Unavailable today'}</Badge><Badge tone={priorityTone(priority(selected))}>{priorityLabel(priority(selected))}</Badge></div></div>
      <div className="profile-tabs four"><button className={drawerTab === 'overview' ? 'active' : ''} onClick={() => setDrawerTab('overview')}>Overview</button><button className={drawerTab === 'availability' ? 'active' : ''} onClick={() => setDrawerTab('availability')}>Availability</button><button className={drawerTab === 'usage' ? 'active' : ''} onClick={() => setDrawerTab('usage')}>Usage</button><button className={drawerTab === 'economics' ? 'active' : ''} onClick={() => setDrawerTab('economics')}>Economics</button></div>
      {drawerTab === 'overview' && <VehicleOverview vehicle={selected}/>} 
      {drawerTab === 'availability' && <AvailabilityCalendar vehicle={selected} availability={vehicleAvailability} onSet={() => setAvailabilityVehicle(selected)}/>} 
      {drawerTab === 'usage' && <VehicleUsage vehicle={selected} plans={plans}/>} 
      {drawerTab === 'economics' && <VehicleEconomics vehicle={selected}/>} 
      <div className="drawer-actions"><button className="btn ghost danger" onClick={() => void remove(selected)}><Trash2 size={15}/> Delete</button><button className="btn primary" onClick={() => openForm(selected)}><Pencil size={15}/> Edit vehicle</button></div>
    </Drawer>}

    {editing && <Modal title={editing === 'new' ? 'Add vehicle' : 'Edit vehicle'} subtitle="Enter facts the company can know. RoutePilot calculates fuel and variable trip cost automatically." onClose={() => setEditing(null)}>
      <div className="form-grid vehicle-form-v9">
        <label>Vehicle name<input value={form.name} onChange={(e) => setForm({...form,name:e.target.value})}/></label>
        <label>Registration<input value={form.registration} onChange={(e) => setForm({...form,registration:e.target.value})}/></label>
        <label>Capacity<input type="number" min="1" value={form.capacity} onChange={(e) => setForm({...form,capacity:e.target.value})}/></label>
        <label>Fuel consumption (L/100km)<input type="number" min="0" step="0.1" value={form.fuelConsumption} onChange={(e) => setForm({...form,fuelConsumption:e.target.value})}/><small>Used with the planning fuel-price assumption.</small></label>
        <label>Maintenance / wear (MAD/km)<input type="number" min="0" step="0.01" value={form.maintenanceCostPerKm} onChange={(e) => setForm({...form,maintenanceCostPerKm:e.target.value})}/><small>Optional non-fuel variable cost from company records.</small></label>
        <label>Planning priority<select value={form.planningPriority} onChange={(e) => setForm({...form,planningPriority:e.target.value as VehiclePlanningPriority})}><option value="PREFERRED">Preferred</option><option value="NORMAL">Normal</option><option value="RESERVE">Reserve only</option></select><small>Reserve vehicles are avoided when another feasible fleet exists.</small></label>
        <label className="toggle-row"><input type="checkbox" checked={form.optimizerEligible} onChange={(e) => setForm({...form,optimizerEligible:e.target.checked})}/><span><b>Eligible for automatic optimization</b><small>Turn off for a manual-only or special-purpose vehicle.</small></span></label>
        <label className="toggle-row"><input type="checkbox" checked={form.active} onChange={(e) => setForm({...form,active:e.target.checked})}/><span><b>Vehicle active in fleet</b><small>Inactive vehicles are never available for planning.</small></span></label>
        <div className="economics-preview span-2"><Fuel size={17}/><div><span>Calculated at {FUEL_PRICE} MAD/L</span><b>{form.fuelConsumption ? `${formatNumber((Number(form.fuelConsumption)/100)*FUEL_PRICE,2)} MAD/km fuel` : 'Fuel cost waiting for consumption data'}{form.maintenanceCostPerKm ? ` + ${formatNumber(Number(form.maintenanceCostPerKm),2)} MAD/km maintenance` : ''}</b></div></div>
        <div className="form-actions span-2"><button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save vehicle'}</button></div>
      </div>
    </Modal>}

    {availabilityVehicle && <Modal title={`Availability · ${availabilityVehicle.name}`} subtitle="Date-specific exceptions automatically remove this vehicle from that day's optimization." onClose={() => setAvailabilityVehicle(null)}><div className="form-grid"><label>Date<input type="date" value={availabilityForm.date} onChange={(e) => setAvailabilityForm({...availabilityForm,date:e.target.value})}/></label><label>Status<select value={availabilityForm.available ? 'available' : 'unavailable'} onChange={(e) => setAvailabilityForm({...availabilityForm,available:e.target.value === 'available'})}><option value="available">Available</option><option value="unavailable">Unavailable</option></select></label><label className="span-2">Reason<input value={availabilityForm.reason} onChange={(e) => setAvailabilityForm({...availabilityForm,reason:e.target.value})} placeholder="Maintenance, breakdown, reserved..."/></label><div className="form-actions span-2"><button className="btn ghost" onClick={() => setAvailabilityVehicle(null)}>Cancel</button><button className="btn primary" disabled={saving} onClick={setAvailability}>{saving ? 'Saving…' : 'Save availability'}</button></div></div></Modal>}
  </>
}

function Readiness({ ok, text }: { ok: boolean; text: string }) { return <div className={ok ? 'fleet-ready-item ok' : 'fleet-ready-item warn'}>{ok ? <CheckCircle2 size={17}/> : <AlertTriangle size={17}/>}<span>{text}</span></div> }
function Detail({ label, value }: { label: string; value: string }) { return <div className="simple-detail"><span>{label}</span><b>{value}</b></div> }
function priorityTone(value: VehiclePlanningPriority): 'green'|'blue'|'amber' { return value === 'PREFERRED' ? 'green' : value === 'RESERVE' ? 'amber' : 'blue' }
function priorityLabel(value: VehiclePlanningPriority) { return value === 'RESERVE' ? 'Reserve' : value[0] + value.slice(1).toLowerCase() }

function VehicleOverview({ vehicle }: { vehicle: Vehicle }) {
  return <div className="detail-section"><h3>Fleet profile</h3><Detail label="Capacity" value={`${vehicle.capacity} seats`}/><Detail label="Fuel consumption" value={vehicle.fuelConsumption == null ? 'Not configured' : `${vehicle.fuelConsumption} L / 100 km`}/><Detail label="Automatic optimizer" value={vehicle.optimizerEligible !== false ? 'Eligible' : 'Manual selection only'}/><Detail label="Planning priority" value={priorityLabel(priority(vehicle))}/><Detail label="Economics" value={economicsComplete(vehicle) ? 'Complete' : 'Incomplete'}/></div>
}

function AvailabilityCalendar({ vehicle, availability, onSet }: { vehicle: Vehicle; availability: any[]; onSet: () => void }) {
  const days = weekDays(isoDayLocal())
  return <div className="detail-section"><div className="section-title-row"><h3>This week</h3><button className="text-link" onClick={onSet}>Set exception</button></div><div className="availability-week">{days.map((day) => { const record = availability.find((item) => item.vehicleId === vehicle.id && sameIsoDay(item.date, day)); const ok = vehicle.active && record?.available !== false; return <div key={day} className={ok ? 'available' : 'unavailable'}><span>{shortDay(day)}</span>{ok ? <CheckCircle2 size={18}/> : <Wrench size={18}/>}<b>{ok ? 'Available' : 'Unavailable'}</b><small>{record?.reason ?? (vehicle.active ? 'No exception' : 'Inactive')}</small></div> })}</div></div>
}

function effectivePlansForDays(plans: PersistedTransportPlan[], days: string[]) {
  const scoped = plans.filter((plan) => days.some((day) => sameIsoDay(plan.date, day)))
  const groups = new Map<string, PersistedTransportPlan[]>()
  for (const plan of scoped) {
    const key = `${String(plan.date).slice(0,10)}-${plan.shiftId}-${plan.direction}`
    groups.set(key, [...(groups.get(key) ?? []), plan])
  }
  const rank = (status: string) => status === 'PUBLISHED' ? 3 : status === 'APPROVED' ? 2 : status === 'DRAFT' ? 1 : 0
  return [...groups.values()].map((items) => [...items].sort((a,b) => rank(b.status)-rank(a.status) || b.version-a.version)[0])
}

function usageForVehicle(vehicleId: number, plans: PersistedTransportPlan[], days: string[]) {
  const journeys = effectivePlansForDays(plans, days).flatMap((plan) => plan.result.optimizationInput.routes.filter((trip) => trip.assignedVehicle.id === vehicleId).map((trip) => ({ plan, trip })))
  const passengers = journeys.reduce((s, x) => s + x.trip.employeeCount, 0)
  const distance = journeys.reduce((s, x) => s + x.trip.totalDistanceKm, 0)
  const fuel = journeys.reduce((s, x) => s + (x.trip.routeCost.estimatedFuelLiters ?? 0), 0)
  const avgUtilization = journeys.length ? Math.round(journeys.reduce((s, x) => s + (x.trip.employeeCount / Math.max(1, x.trip.assignedVehicle.capacity))*100, 0) / journeys.length) : 0
  return { journeys, trips: journeys.length, passengers, distance, fuel, avgUtilization }
}

function VehicleUsage({ vehicle, plans }: { vehicle: Vehicle; plans: PersistedTransportPlan[] }) {
  const usage = usageForVehicle(vehicle.id, plans, weekDays(isoDayLocal()))
  return <div className="vehicle-usage-tab"><div className="vehicle-usage-metrics"><div><BarChart3 size={16}/><span><b>{usage.trips}</b>Trips</span></div><div><span><b>{usage.passengers}</b>Passengers</span></div><div><span><b>{formatNumber(usage.distance)} km</b>Distance</span></div><div><span><b>{usage.avgUtilization}%</b>Avg utilization</span></div><div><span><b>{formatNumber(usage.fuel,2)} L</b>Fuel</span></div></div><div className="detail-section"><h3>Recent assignments</h3>{usage.journeys.length ? usage.journeys.slice(0,10).map(({plan,trip}) => <div className="journey-row vehicle" key={`${plan.id}-${trip.tripId}`}><div><b>{String(plan.date).slice(0,10)} · {plan.shift?.name ?? plan.result.shift.name}</b><small>{plan.result.direction} · {trip.employeeCount}/{trip.assignedVehicle.capacity} passengers · {formatNumber(trip.totalDistanceKm)} km</small></div><Badge tone="blue">{Math.round(trip.employeeCount/trip.assignedVehicle.capacity*100)}%</Badge></div>) : <div className="empty-mini">No persisted plan uses this vehicle this week.</div>}</div></div>
}

function VehicleEconomics({ vehicle }: { vehicle: Vehicle }) {
  const fuel = fuelCostPerKm(vehicle); const maintenance = maintenanceCost(vehicle); const variable = variableCostPerKm(vehicle); const complete = economicsComplete(vehicle)
  return <div className="vehicle-economics"><div className={complete ? 'economics-status complete' : 'economics-status warning'}>{complete ? <CheckCircle2 size={19}/> : <AlertTriangle size={19}/>}<div><b>{complete ? 'Economics complete' : 'Economics incomplete'}</b><small>{complete ? 'Cost-based optimization can compare this vehicle normally.' : 'RoutePilot will show lower-bound cost estimates and avoid treating missing cost as zero.'}</small></div></div><div className="economics-breakdown"><Detail label="Fuel price assumption" value={`${FUEL_PRICE} MAD / L`}/><Detail label="Fuel cost" value={fuel == null ? 'Not available' : `${formatNumber(fuel,2)} MAD / km`}/><Detail label="Maintenance / wear" value={maintenance == null ? 'Not configured' : `${formatNumber(maintenance,2)} MAD / km`}/><Detail label="Estimated variable cost" value={variable == null ? 'Not available' : `${complete ? '' : '≥ '}${formatNumber(variable,2)} MAD / km`}/><Detail label="Estimated 100 km" value={variable == null ? 'Not available' : `${complete ? '' : '≥ '}${formatMoney(variable*100)}`}/></div></div>
}
