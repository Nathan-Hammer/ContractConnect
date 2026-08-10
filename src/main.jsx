import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import SecurityBoundary from './SecurityBoundary.jsx'
import { installRuntimeProtection } from './lib/runtimeSecurity'
import './styles.css'

installRuntimeProtection()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><SecurityBoundary><App /></SecurityBoundary></React.StrictMode>,
)
