import { Component, type ReactNode } from "react";
import styles from "./ErrorBoundary.module.css";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.errorBoundary}>
          <h2>Algo salió mal</h2>
          <p className={styles.errorBoundary__message}>{this.state.error?.message}</p>
          <button
            className={styles.errorBoundary__retry}
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
