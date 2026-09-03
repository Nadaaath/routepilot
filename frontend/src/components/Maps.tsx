import { divIcon } from 'leaflet'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import type { Depot, PickupPoint, TripDirection } from '../types'

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) map.setView(points[0], 13)
    else map.fitBounds(points, { padding: [35, 35] })
  }, [map, points])
  return null
}

const markerIcon = (label: string, depot = false) => divIcon({
  className: '',
  html: `<div class="map-pin ${depot ? 'depot' : ''}">${label}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

const mapTiles = (
  <TileLayer
    attribution='&copy; OpenStreetMap contributors'
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  />
)

export function NetworkMap({ pickupPoints, depots, selectedId, selectedType }: { pickupPoints: PickupPoint[]; depots: Depot[]; selectedId?: number | null; selectedType?: 'stop'|'depot'|null }) {
  const all: [number, number][] = [...pickupPoints.map((p) => [p.latitude, p.longitude] as [number, number]), ...depots.map((d) => [d.latitude, d.longitude] as [number, number])]
  const center: [number, number] = all[0] ?? [33.99, -6.84]
  return <MapContainer center={center} zoom={11} className="leaflet-map" zoomControl>
    {mapTiles}
    <Fit points={all}/>
    {pickupPoints.map((p) => <Marker key={`p-${p.id}`} position={[p.latitude, p.longitude]} icon={markerIcon(selectedType === 'stop' && selectedId === p.id ? '●' : 'S')}><Tooltip>{p.name}</Tooltip></Marker>)}
    {depots.map((d) => <Marker key={`d-${d.id}`} position={[d.latitude, d.longitude]} icon={markerIcon('D', true)}><Tooltip>{d.name}</Tooltip></Marker>)}
  </MapContainer>
}

export function TripMap({ orderedPointIds, pickupPoints, depot, direction }: { orderedPointIds: number[]; pickupPoints: PickupPoint[]; depot: Depot; direction: TripDirection }) {
  const stopPositions = orderedPointIds.map((id) => pickupPoints.find((p) => p.id === id)).filter(Boolean) as PickupPoint[]
  const stopCoords = stopPositions.map((p) => [p.latitude, p.longitude] as [number, number])
  const depotCoord: [number, number] = [depot.latitude, depot.longitude]
  const positions: [number, number][] = direction === 'INBOUND' ? [...stopCoords, depotCoord] : [depotCoord, ...stopCoords]
  const center: [number, number] = positions[0] ?? [depot.latitude, depot.longitude]
  return <MapContainer center={center} zoom={12} className="leaflet-map" zoomControl>
    {mapTiles}
    <Fit points={positions}/>
    {stopPositions.map((p, index) => <Marker key={p.id} position={[p.latitude, p.longitude]} icon={markerIcon(String(index + 1))}><Tooltip>{index + 1}. {p.name}</Tooltip></Marker>)}
    <Marker position={[depot.latitude, depot.longitude]} icon={markerIcon('D', true)}><Tooltip>{depot.name}</Tooltip></Marker>
    {positions.length > 1 && <Polyline positions={positions} pathOptions={{ color: '#8b6cff', weight: 4, dashArray: '10 8' }}/>} 
  </MapContainer>
}
