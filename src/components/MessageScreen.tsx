import { Component, type ErrorInfo, type ReactNode } from 'react';
import { goBack, navigate } from '../hooks/useRoute';
import { BackIcon } from './Icons';

interface MessageScreenProps {
  title: string;
  detail?: string;
  children?: ReactNode;
}

/** Écran de chargement ou d'erreur : toujours un moyen de revenir, jamais une page vide. */
export function MessageScreen({ title, detail, children }: MessageScreenProps) {
  return (
    <div className="screen">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={goBack} aria-label="Retour">
          <BackIcon />
        </button>
      </header>
      <div className="empty">
        <p>{title}</p>
        {detail && <p className="error-detail">{detail}</p>}
        <div className="button-row centered">{children}</div>
      </div>
    </div>
  );
}

interface BoundaryState {
  error: Error | null;
}

/** Affiche l'erreur au lieu d'une page noire si un écran plante. */
export class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <MessageScreen title="Un problème est survenu." detail={error.message}>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            this.setState({ error: null });
            navigate('/', { replace: true });
          }}
        >
          Retour à l’accueil
        </button>
        <button type="button" className="btn" onClick={() => location.reload()}>
          Recharger
        </button>
      </MessageScreen>
    );
  }
}
