import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#f7f8f4] px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-8 shadow-[0_24px_80px_rgba(44,44,44,0.10)]">
            <h1 className="text-xl font-semibold text-brand-text">Something went wrong</h1>
            <p className="mt-3 text-sm leading-6 text-brand-muted">
              An unexpected error occurred. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 rounded-2xl bg-brand-text px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
