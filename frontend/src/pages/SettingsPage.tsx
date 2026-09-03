import { CheckCircle2, Database, ExternalLink, Route, Server } from 'lucide-react'
import { API_BASE_URL } from '../api/client'
import { PageHeader, Panel } from '../components/UI'
import { useData } from '../context/DataContext'

export default function SettingsPage() {
  const { backendOnline } = useData()
  return <>
    <PageHeader eyebrow="SYSTEM" title="Settings" subtitle="Environment and product boundaries for this MVP frontend."/>
    <div className="settings-grid"><Panel title="Backend connection"><div className="settings-status"><div className={`big-status ${backendOnline ? 'online' : 'offline'}`}>{backendOnline ? <CheckCircle2 size={25}/> : <Server size={25}/>}</div><div><b>{backendOnline ? 'Connected' : 'Not reachable'}</b><span>{API_BASE_URL}</span></div></div><div className="simple-detail"><span>API base URL</span><b>{API_BASE_URL}</b></div><div className="simple-detail"><span>Transport backend</span><b>Express + TypeScript + Prisma</b></div></Panel><Panel title="Current product boundaries"><div className="boundary-list"><div><Database size={17}/><span><b>Plans are persisted in PostgreSQL</b><small>Draft, approved and published optimization plan versions are stored by the backend.</small></span></div><div><Route size={17}/><span><b>Map route line is a sequence preview</b><small>The backend returns road distance/time matrices, but not turn-by-turn route geometry.</small></span></div><div><ExternalLink size={17}/><span><b>Location resolution is backend-powered</b><small>Addresses, map links, and coordinates are submitted to your current pickup-point/depot APIs.</small></span></div></div></Panel></div>
  </>
}
