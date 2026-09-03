import { Building2, ExternalLink, MapPin, MapPinned, Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { depotsApi, pickupPointsApi } from '../api/resources'
import { NetworkMap } from '../components/Maps'
import { Badge, EmptyState, Modal, PageHeader, Panel } from '../components/UI'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import type { Depot, PickupPoint } from '../types'

const emptyForm = { name: '', address: '', mapUrl: '', latitude: '', longitude: '', mode: 'address' as 'address'|'mapUrl'|'coordinates' }

type Selection = { type: 'stop'; item: PickupPoint } | { type: 'depot'; item: Depot }

export default function LocationsPage() {
  const { pickupPoints, depots, employees, refreshAll } = useData()
  const { push } = useToast()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all'|'stop'|'depot'>('all')
  const [selected, setSelected] = useState<Selection | null>(null)
  const [editing, setEditing] = useState<{ type: 'stop'|'depot'; item?: PickupPoint|Depot } | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { const id = Number(params.get('stop')); if (id) { const item = pickupPoints.find((p) => p.id === id); if (item) setSelected({ type:'stop', item }) } }, [params, pickupPoints])

  const locations = useMemo(() => [
    ...pickupPoints.map((item) => ({ type: 'stop' as const, item })),
    ...depots.map((item) => ({ type: 'depot' as const, item })),
  ].filter((x) => (typeFilter === 'all' || x.type === typeFilter) && (!query || `${x.item.name} ${x.item.address ?? ''}`.toLowerCase().includes(query.toLowerCase()))), [pickupPoints, depots, typeFilter, query])

  const countEmployees = (id: number) => employees.filter((e) => e.pickupPointId === id && e.active).length
  const totalCovered = new Set(employees.filter((e) => e.active && e.pickupPointId).map((e) => e.id)).size

  const openForm = (type: 'stop'|'depot', item?: PickupPoint|Depot) => {
    setEditing({ type, item })
    setForm(item ? { name: item.name, address: item.address ?? '', mapUrl: item.mapUrl ?? '', latitude: String(item.latitude), longitude: String(item.longitude), mode: 'coordinates' } : emptyForm)
  }

  const save = async () => {
    if (!editing || !form.name.trim()) return push('Location name is required.', 'error')
    const payload: Record<string, unknown> = { name: form.name.trim() }
    if (form.mode === 'address') { if (!form.address.trim()) return push('Enter an address.', 'error'); payload.address = form.address.trim() }
    if (form.mode === 'mapUrl') { if (!form.mapUrl.trim()) return push('Paste a map URL.', 'error'); payload.mapUrl = form.mapUrl.trim(); if (form.address.trim()) payload.address = form.address.trim() }
    if (form.mode === 'coordinates') {
      const lat = Number(form.latitude), lng = Number(form.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return push('Enter valid latitude and longitude.', 'error')
      payload.latitude = lat; payload.longitude = lng; if (form.address.trim()) payload.address = form.address.trim(); if (form.mapUrl.trim()) payload.mapUrl = form.mapUrl.trim()
    }
    setSaving(true)
    try {
      if (editing.type === 'stop') {
        const typedPayload = payload as Partial<PickupPoint>
        if (editing.item) await pickupPointsApi.update(editing.item.id, typedPayload)
        else await pickupPointsApi.create(typedPayload)
      } else {
        const typedPayload = payload as Partial<Depot>
        if (editing.item) await depotsApi.update(editing.item.id, typedPayload)
        else await depotsApi.create(typedPayload)
      }
      await refreshAll(); setEditing(null); push(`${editing.type === 'stop' ? 'Stop' : 'Depot'} saved.`)
    } catch (err) { push(apiErrorMessage(err), 'error') } finally { setSaving(false) }
  }

  const remove = async (selection: Selection) => {
    if (!window.confirm(`Delete ${selection.item.name}?`)) return
    try { if (selection.type === 'stop') await pickupPointsApi.remove(selection.item.id); else await depotsApi.remove(selection.item.id); await refreshAll(); setSelected(null); push('Location deleted.') } catch (err) { push(apiErrorMessage(err), 'error') }
  }

  return <>
    <PageHeader eyebrow="RESOURCES" title="Stops & Depots" subtitle="Manage pickup points, depots and the geographic network consumed by planning." actions={<div className="page-actions"><button className="btn ghost" onClick={() => openForm('stop')}><MapPin size={16}/> Add stop</button><button className="btn primary" onClick={() => openForm('depot')}><Building2 size={16}/> Add depot</button></div>}/>
    <div className="locations-toolbar"><div className="inline-search"><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search stops & depots"/></div><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}><option value="all">All types</option><option value="stop">Pickup stops</option><option value="depot">Depots</option></select><span className="result-count">{locations.length} locations</span></div>

    <div className="locations-workspace">
      <Panel className="location-list-panel"><div className="location-list">{locations.map((x) => <button key={`${x.type}-${x.item.id}`} className={`location-row ${selected?.type === x.type && selected.item.id === x.item.id ? 'active' : ''}`} onClick={() => setSelected(x)}>{x.type === 'stop' ? <MapPin size={20}/> : <Building2 size={20}/>}<span><b>{x.item.name}</b><small>{x.type === 'stop' ? `${countEmployees(x.item.id)} employees` : 'Company / vehicle base'}</small><em>{x.item.address ?? `${x.item.latitude.toFixed(4)}, ${x.item.longitude.toFixed(4)}`}</em></span><Badge tone={x.type === 'stop' ? 'blue' : 'purple'}>{x.type === 'stop' ? 'Stop' : 'Depot'}</Badge></button>)}{!locations.length && <EmptyState title="No locations found" description="Adjust filters or add a stop/depot."/>}</div></Panel>

      <Panel className="location-detail-panel">{selected ? <div className="location-detail"><div className="location-title"><div className={selected.type === 'depot' ? 'location-icon depot' : 'location-icon'}>{selected.type === 'stop' ? <MapPin size={22}/> : <Building2 size={22}/>}</div><span><h2>{selected.item.name}</h2><Badge tone={selected.type === 'stop' ? 'blue' : 'purple'}>{selected.type === 'stop' ? 'Pickup stop' : 'Depot'}</Badge></span></div><div className="detail-section"><h3>Details</h3><Detail label="Address" value={selected.item.address ?? 'Not provided'}/><Detail label="Coordinates" value={`${selected.item.latitude.toFixed(6)}, ${selected.item.longitude.toFixed(6)}`}/>{selected.type === 'stop' && <Detail label="Assigned employees" value={String(countEmployees(selected.item.id))}/>}<Detail label="Map URL" value={selected.item.mapUrl ? 'Stored' : 'Not provided'}/>{selected.item.mapUrl && <a className="inline-link" href={selected.item.mapUrl} target="_blank" rel="noreferrer">Open map link <ExternalLink size={13}/></a>}</div><div className="drawer-actions"><button className="btn ghost danger" onClick={() => void remove(selected)}><Trash2 size={15}/> Delete</button><button className="btn primary" onClick={() => openForm(selected.type, selected.item)}><Pencil size={15}/> Edit details</button></div></div> : <EmptyState title="Select a location" description="Choose a stop or depot to inspect its backend data."/>}</Panel>

      <Panel className="network-map-panel"><div className="network-map"><NetworkMap pickupPoints={pickupPoints} depots={depots} selectedId={selected?.item.id} selectedType={selected?.type ?? null}/></div><div className="map-legend"><span><i className="legend-dot stop"/> Pickup stop</span><span><i className="legend-dot depot"/> Depot</span></div></Panel>

      <div className="location-side"><Panel title="Coverage summary"><div className="summary-list"><div><MapPin size={17}/><span><b>{pickupPoints.length}</b>Stops</span></div><div><Building2 size={17}/><span><b>{depots.length}</b>Depots</span></div><div><Users size={17}/><span><b>{totalCovered}</b>Employees covered</span></div><div><MapPinned size={17}/><span><b>{employees.filter((e) => e.active && !e.pickupPointId).length}</b>Missing assignments</span></div></div></Panel><Panel title="Location input methods" subtitle="Supported by the current backend location resolver."><div className="method-list"><button onClick={() => { openForm('stop'); setForm((f) => ({...f, mode:'address'})) }}><MapPin size={17}/><span><b>Address</b><small>Backend geocodes it</small></span></button><button onClick={() => { openForm('stop'); setForm((f) => ({...f, mode:'mapUrl'})) }}><ExternalLink size={17}/><span><b>Map URL</b><small>Google Maps links supported</small></span></button><button onClick={() => { openForm('stop'); setForm((f) => ({...f, mode:'coordinates'})) }}><MapPinned size={17}/><span><b>Coordinates</b><small>Direct latitude / longitude</small></span></button></div></Panel></div>
    </div>

    {editing && <Modal wide title={`${editing.item ? 'Edit' : 'Add'} ${editing.type === 'stop' ? 'pickup stop' : 'depot'}`} subtitle="Use one of the location methods your backend already supports." onClose={() => setEditing(null)}><div className="form-grid"><label className="span-2">Name<input value={form.name} onChange={(e) => setForm({...form,name:e.target.value})}/></label><div className="mode-picker span-2"><button className={form.mode === 'address' ? 'active' : ''} onClick={() => setForm({...form,mode:'address'})}>Address</button><button className={form.mode === 'mapUrl' ? 'active' : ''} onClick={() => setForm({...form,mode:'mapUrl'})}>Map URL</button><button className={form.mode === 'coordinates' ? 'active' : ''} onClick={() => setForm({...form,mode:'coordinates'})}>Coordinates</button></div>{form.mode === 'address' && <label className="span-2">Address<input value={form.address} onChange={(e) => setForm({...form,address:e.target.value})} placeholder="Hay Riad, Rabat"/></label>}{form.mode === 'mapUrl' && <><label className="span-2">Google Maps URL<input value={form.mapUrl} onChange={(e) => setForm({...form,mapUrl:e.target.value})} placeholder="https://maps.app.goo.gl/..."/></label><label className="span-2">Address (optional)<input value={form.address} onChange={(e) => setForm({...form,address:e.target.value})}/></label></>}{form.mode === 'coordinates' && <><label>Latitude<input value={form.latitude} onChange={(e) => setForm({...form,latitude:e.target.value})}/></label><label>Longitude<input value={form.longitude} onChange={(e) => setForm({...form,longitude:e.target.value})}/></label><label className="span-2">Address (optional)<input value={form.address} onChange={(e) => setForm({...form,address:e.target.value})}/></label></>}<div className="form-actions span-2"><button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Resolving location…' : 'Save location'}</button></div></div></Modal>}
  </>
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="simple-detail"><span>{label}</span><b>{value}</b></div> }
