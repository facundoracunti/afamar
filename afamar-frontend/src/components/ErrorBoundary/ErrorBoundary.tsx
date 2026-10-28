import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Keep technical details out of the UI. Diagnostics remain in devtools.
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main role="alert" style={{ padding: 24, textAlign: 'center' }}>
        <h1>No se pudo cargar AFAMAR</h1>
        <p>Ocurrió un problema inesperado al abrir la aplicación.</p>
        <button type="button" onClick={this.handleReload}>
          Recargar aplicación
        </button>
      </main>
    );
  }
}
