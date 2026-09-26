import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../atoms';
import { EmptyState } from '../../molecules';

interface Props {
  children: ReactNode;
  /** Short name of what failed, for the message ("the graph", "this chart"). */
  label?: string;
  /** Changing this value resets the boundary (e.g. the route path). */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

/** Contains render failures (e.g. WebGL unavailable) so the rest of the app keeps working. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <EmptyState
        icon={AlertTriangle}
        title={`Something went wrong rendering ${this.props.label ?? 'this view'}`}
        description={this.state.error.message}
        action={<Button onClick={() => this.setState({ error: null })}>Try again</Button>}
      />
    );
  }
}
