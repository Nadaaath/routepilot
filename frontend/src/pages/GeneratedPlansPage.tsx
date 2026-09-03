import { ArrowRight, BusFront, CheckCircle2, Download, FileText, GitCompareArrows, Route, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { transportPlansApi } from '../api/resources'
import { apiErrorMessage } from '../api/client'
import { Badge, Drawer, EmptyState, PageHeader, Panel } from '../components/UI'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import type { PersistedTransportPlan, TransportPlanStatus } from '../types'
import { downloadText, formatMoney, formatNumber } from '../utils/format'

export default function GeneratedPlansPage() {
  const { plans, refreshAll } = useData()
  const { push } = useToast()
  const [status, setStatus] = useState<'ALL'|TransportPlanStatus>('ALL')
  const [compareIds, setCompareIds] = useState<number[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const filtered = status === 'ALL' ? plans : plans.filter((plan) => plan.status === status)

  const groups = useMemo(() => {
    const map = new Map<string, PersistedTransportPlan[]>()
    for (const plan of filtered) {
      const key = `${String(plan.date).slice(0,10)}-${plan.shiftId}-${plan.direction}`
      map.set(key, [...(map.get(key) ?? []), plan])
    }
    return [...map.values()].map((items) => [...items].sort((a,b) => b.version-a.version)).sort((a,b) => new Date(b[0].date).getTime()-new Date(a[0].date).getTime())
  }, [filtered])

  const selectedPlans = compareIds.map((id) => plans.find((plan) => plan.id === id)).filter(Boolean) as PersistedTransportPlan[]
  const toggleCompare = (plan: PersistedTransportPlan) => {
    setCompareIds((current) => current.includes(plan.id) ? current.filter((id) => id !== plan.id) : current.length >= 2 ? [current[1], plan.id] : [...current, plan.id])
  }
  const changeStatus = async (plan: PersistedTransportPlan, next: TransportPlanStatus) => {
    try { await transportPlansApi.update(plan.id, { status: next }); await refreshAll(); push(`Plan v${plan.version} marked ${next.toLowerCase()}.`) } catch (err) { push(apiErrorMessage(err), 'error') }
  }
  const remove = async (plan: PersistedTransportPlan) => {
    if (!window.confirm(`Delete plan v${plan.version} for ${String(plan.date).slice(0,10)}?`)) return
    try { await transportPlansApi.remove(plan.id); await refreshAll(); setCompareIds((ids) => ids.filter((id) => id !== plan.id)); push('Plan deleted.') } catch (err) { push(apiErrorMessage(err), 'error') }
  }

  return <>
    <PageHeader eyebrow="OUTPUTS" title="Transport Plans" subtitle="Review persisted versions, approve the working plan, and compare how optimization decisions changed." actions={<div className="plan-page-actions"><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="ALL">All statuses</option><option value="DRAFT">Draft</option><option value="APPROVED">Approved</option><option value="PUBLISHED">Published</option><option value="SUPERSEDED">Superseded</option></select><button className="btn primary" disabled={selectedPlans.length !== 2} onClick={() => setCompareOpen(true)}><GitCompareArrows size={15}/> Compare {selectedPlans.length}/2</button></div>}/>
    <div className="info-banner"><FileText size={18}/><span><b>Version-aware planning</b> — select any two versions to compare trips, distance, cost, ride time, warnings, vehicles and passenger assignments.</span></div>

    {groups.length ? <div className="plan-version-groups">{groups.map((group) => {
      const latest = group[0]; const r = latest.result
      return <Panel key={`${String(latest.date).slice(0,10)}-${latest.shiftId}-${latest.direction}`} className="plan-version-group">
        <div className="version-group-head"><div><span className="eyebrow-mini">{String(latest.date).slice(0,10)}</span><h2>{r.shift.name} · {r.direction === 'INBOUND' ? 'To workplace' : 'From workplace'}</h2><small>{r.depot.name} · {group.length} saved version{group.length === 1 ? '' : 's'}</small></div><Badge tone="blue">Latest v{latest.version}</Badge></div>
        <div className="version-table"><div className="version-row head"><span></span><span>Version</span><span>Strategy</span><span>Status</span><span>Trips</span><span>Distance</span><span>Cost</span><span>Issues</span><span>Created</span><span></span></div>{group.map((plan) => {
          const result = plan.result; const totals = result.optimizationInput.totals; const checked = compareIds.includes(plan.id)
          return <div className={`version-row ${checked ? 'selected' : ''}`} key={plan.id}>
            <label className="compare-check"><input type="checkbox" checked={checked} onChange={() => toggleCompare(plan)}/></label>
            <span><b>v{plan.version}</b><small>#{plan.id}</small></span>
            <span>{(plan.request as any)?.manualEdit ? <><b>Manual adjustment</b><small>Based on plan #{String((plan.request as any)?.basedOnPlanId ?? '—')}</small></> : (plan.strategy ?? result.strategy ?? 'BALANCED')}</span>
            <span><Badge tone={statusTone(plan.status)}>{plan.status}</Badge></span>
            <span>{totals.totalTrips}</span>
            <span>{formatNumber(totals.totalDistanceKm)} km</span>
            <span>{totals.costDataComplete === false ? '≥ ' : ''}{formatMoney(totals.totalOperatingCost)}</span>
            <span>{result.optimizationInput.diagnostics?.warningCount ?? 0}</span>
            <span className="version-date">{new Date(plan.createdAt).toLocaleString()}</span>
            <span className="version-actions">{plan.status === 'DRAFT' && <button className="text-link" onClick={() => void changeStatus(plan,'APPROVED')}>Approve</button>}{plan.status === 'APPROVED' && <button className="text-link" onClick={() => void changeStatus(plan,'PUBLISHED')}>Publish</button>}<button className="icon-btn" onClick={() => downloadText(`routepilot-plan-${plan.id}-v${plan.version}.json`, JSON.stringify(result,null,2))}><Download size={14}/></button><button className="icon-btn danger" onClick={() => void remove(plan)}><Trash2 size={14}/></button></span>
          </div>
        })}</div>
      </Panel>
    })}</div> : <Panel><EmptyState title="No persisted plans" description="Run an optimization from Planning. Each generated scenario is stored as a draft version."/></Panel>}

    {compareOpen && selectedPlans.length === 2 && <PlanCompareDrawer first={selectedPlans[0]} second={selectedPlans[1]} onClose={() => setCompareOpen(false)}/>} 
  </>
}

function PlanCompareDrawer({ first, second, onClose }: { first: PersistedTransportPlan; second: PersistedTransportPlan; onClose: () => void }) {
  const a = planMetrics(first); const b = planMetrics(second)
  const sameScope = String(first.date).slice(0,10) === String(second.date).slice(0,10) && first.shiftId === second.shiftId && first.direction === second.direction
  const vehiclesA = new Set(first.result.optimizationInput.routes.map((trip) => trip.assignedVehicle.name))
  const vehiclesB = new Set(second.result.optimizationInput.routes.map((trip) => trip.assignedVehicle.name))
  const addedVehicles = [...vehiclesB].filter((name) => !vehiclesA.has(name))
  const removedVehicles = [...vehiclesA].filter((name) => !vehiclesB.has(name))
  const assignmentsA = employeeTripMap(first); const assignmentsB = employeeTripMap(second)
  const reassigned = [...new Set([...assignmentsA.keys(), ...assignmentsB.keys()])].filter((id) => assignmentsA.get(id) !== assignmentsB.get(id)).length

  return <Drawer title={`Compare v${first.version} → v${second.version}`} subtitle="See exactly what changed between two persisted planning decisions." onClose={onClose}>
    {!sameScope && <div className="compare-scope-warning"><FileText size={17}/><span><b>Different plan scopes</b><small>These versions do not share the same date, shift and direction. Metrics are still comparable, but this is not a strict version-to-version operational diff.</small></span></div>}
    <div className="compare-head"><PlanMini plan={first}/><ArrowRight size={22}/><PlanMini plan={second}/></div>
    <div className="compare-metrics">
      <CompareMetric label="Trips" a={String(a.trips)} b={String(b.trips)}/>
      <CompareMetric label="Distance" a={`${formatNumber(a.distance)} km`} b={`${formatNumber(b.distance)} km`} delta={b.distance-a.distance} unit=" km"/>
      <CompareMetric label="Variable cost" a={`${a.costComplete?'':'≥ '}${formatMoney(a.cost)}`} b={`${b.costComplete?'':'≥ '}${formatMoney(b.cost)}`} delta={b.cost-a.cost} money/>
      <CompareMetric label="Average ride" a={`${formatNumber(a.avgRide,0)} min`} b={`${formatNumber(b.avgRide,0)} min`} delta={b.avgRide-a.avgRide} unit=" min" lowerBetter/>
      <CompareMetric label="Maximum ride" a={`${formatNumber(a.maxRide,0)} min`} b={`${formatNumber(b.maxRide,0)} min`} delta={b.maxRide-a.maxRide} unit=" min" lowerBetter/>
      <CompareMetric label="Issues" a={String(a.issues)} b={String(b.issues)} delta={b.issues-a.issues} lowerBetter/>
    </div>
    <div className="compare-change-grid"><div className="issue-section"><h3>Fleet changes</h3>{addedVehicles.length || removedVehicles.length ? <>{addedVehicles.map((name) => <div className="change-row add" key={`a-${name}`}><span>Added</span><b>{name}</b></div>)}{removedVehicles.map((name) => <div className="change-row remove" key={`r-${name}`}><span>Removed</span><b>{name}</b></div>)}</> : <div className="empty-mini">Same vehicle set.</div>}</div><div className="issue-section"><h3>Passenger assignment</h3><div className="big-compare-stat"><Users size={18}/><span><b>{reassigned}</b><small>employees changed trip/vehicle assignment</small></span></div></div></div>
  </Drawer>
}

function PlanMini({ plan }: { plan: PersistedTransportPlan }) { const manual=(plan.request as any)?.manualEdit; return <div className="plan-mini"><Badge tone={statusTone(plan.status)}>{plan.status}</Badge><b>v{plan.version} · {manual ? 'Manual adjustment' : plan.strategy}</b><span>{String(plan.date).slice(0,10)} · {plan.result.shift.name}</span></div> }
function planMetrics(plan: PersistedTransportPlan) { const t=plan.result.optimizationInput.totals; const rides=plan.result.optimizationInput.routes.flatMap((r)=>r.employeeRideTimes.map((x)=>x.rideTimeMinutes)); return { trips:t.totalTrips, distance:t.totalDistanceKm, cost:t.totalOperatingCost, costComplete:t.costDataComplete !== false, avgRide:rides.length?rides.reduce((s,v)=>s+v,0)/rides.length:0, maxRide:rides.length?Math.max(...rides):0, issues:plan.result.optimizationInput.diagnostics?.warningCount ?? 0 } }
function employeeTripMap(plan: PersistedTransportPlan) { const map=new Map<number,string>(); for (const trip of plan.result.optimizationInput.routes) for (const id of trip.employeeIds) map.set(id,`${trip.assignedVehicle.id}:${trip.tripId}`); return map }
function CompareMetric({label,a,b,delta,unit='',money=false,lowerBetter=false}:{label:string;a:string;b:string;delta?:number;unit?:string;money?:boolean;lowerBetter?:boolean}) { const positive=delta!=null&&delta>0; const negative=delta!=null&&delta<0; const good=lowerBetter ? negative : false; const bad=lowerBetter ? positive : false; const deltaText=delta==null||Math.abs(delta)<0.0001?'No change':`${delta>0?'+':''}${money?formatMoney(delta):`${formatNumber(delta,1)}${unit}`}`; return <div className="compare-metric"><span>{label}</span><div><b>{a}</b><ArrowRight size={14}/><b>{b}</b></div><small className={good?'good':bad?'bad':''}>{deltaText}</small></div> }
function statusTone(status: TransportPlanStatus): 'neutral'|'blue'|'green'|'amber'|'purple' { if(status==='PUBLISHED') return 'green'; if(status==='APPROVED') return 'blue'; if(status==='SUPERSEDED') return 'neutral'; return 'purple' }
