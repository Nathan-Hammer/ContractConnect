import React from 'react'
import { reportSecurityEvent } from './lib/runtimeSecurity'

export default class SecurityBoundary extends React.Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    reportSecurityEvent('react_render_failure', 'high', {
      message: error.message,
      component_stack: info.componentStack,
    })
  }

  render() {
    if (this.state.failed) {
      return <main className="auth-page"><section className="auth-form-side"><div className="auth-card"><h2>ContractConnect paused safely</h2><p>An unexpected runtime error was detected and recorded. Refresh the page or contact your administrator if the problem continues.</p><button className="btn primary" onClick={() => window.location.reload()}>Reload securely</button></div></section></main>
    }
    return this.props.children
  }
}
