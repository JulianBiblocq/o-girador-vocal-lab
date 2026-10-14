import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary Vocal Lab a capturé une exception :', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-theme-bg text-theme-ink flex items-center justify-center p-4">
          <div className="cordel-card p-6 max-w-lg w-full flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-8 h-8 flex-shrink-0" />
              <div>
                <h2 className="text-base font-bold uppercase m-0 text-theme-ink">
                  Incident d'affichage intercepté
                </h2>
                <p className="text-xs font-mono opacity-70 m-0">
                  L'arbre React a été protégé contre le crash.
                </p>
              </div>
            </div>

            <div className="bg-black/40 border border-theme-border p-3 rounded-none font-mono text-xs overflow-x-auto text-red-300">
              {this.state.error?.message || 'Erreur d\'exécution inconnue'}
            </div>

            <button
              type="button"
              onClick={this.handleReset}
              className="cordel-btn-primary py-2 px-4 flex items-center justify-center gap-2 text-xs uppercase font-bold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Réinitialiser l'interface</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
