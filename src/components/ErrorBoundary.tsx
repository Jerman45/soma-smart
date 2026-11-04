import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SOMA SMART application error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <main className="center-state"><h1>Something went wrong.</h1><p>Please reload the page and try again.</p><a className="button button-primary" href="/">Return to SOMA SMART</a></main>
    }
    return this.props.children
  }
}
