import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

const RELOAD_FLAG = 'canntrace_chunkboundary_reloaded_at'
const RELOAD_COOLDOWN_MS = 10_000

function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported|error loading dynamically imported|Importing a module script failed/i.test(msg)
}

function shouldAutoReload(): boolean {
  try {
    const last = sessionStorage.getItem(RELOAD_FLAG)
    if (!last) return true
    return Date.now() - parseInt(last) > RELOAD_COOLDOWN_MS
  } catch { return true }
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    // Si es ChunkLoadError y no reloadeamos recientemente, recargar automaticamente.
    // Esto es el cinturon de seguridad por si lazyWithRetry no intercepto el error
    // (caso: chunks que no usaron lazyWithRetry, o errores en render de chunk viejo).
    if (isChunkLoadError(error) && shouldAutoReload()) {
      try { sessionStorage.setItem(RELOAD_FLAG, String(Date.now())) } catch { /* ok */ }
      console.warn('[ErrorBoundary] ChunkLoadError detectado, recargando index.html...')
      window.location.reload()
    }
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('App crash:', error, info)
  }

  handleReload = () => {
    try { sessionStorage.removeItem(RELOAD_FLAG) } catch { /* ok */ }
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      const esChunk = isChunkLoadError(this.state.error)
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: 'white', minHeight: '100vh' }}>
          <div style={{ maxWidth: 720, margin: '2rem auto', background: '#1e293b', borderRadius: 12, padding: '1.5rem', border: '1px solid #ef4444' }}>
            <h1 style={{ color: '#ef4444', margin: 0 }}>
              {esChunk ? 'Actualizacion disponible' : 'Error en la app'}
            </h1>
            <p style={{ marginTop: '1rem' }}>
              {esChunk
                ? 'GrowFlow se actualizo mientras estabas en la pagina. Refrescamos para traerte la version nueva.'
                : String(this.state.error.message || this.state.error)}
            </p>
            {!esChunk && (
              <pre style={{ background: '#0f172a', padding: '1rem', borderRadius: 8, fontSize: 11, overflow: 'auto', maxHeight: 300, marginTop: '1rem' }}>
                {this.state.error.stack}
              </pre>
            )}
            <button onClick={this.handleReload}
              style={{ marginTop: '1rem', background: '#a3e635', color: 'white', border: 'none', padding: '.5rem 1rem', borderRadius: 6, cursor: 'pointer' }}>
              {esChunk ? 'Refrescar ahora' : 'Volver al inicio'}
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
