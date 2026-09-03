import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './styles/global.css'
import App from './App'
import { DataProvider } from './context/DataContext'
import { ToastProvider } from './context/ToastContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><ToastProvider><DataProvider><App/></DataProvider></ToastProvider></BrowserRouter></React.StrictMode>,
)
