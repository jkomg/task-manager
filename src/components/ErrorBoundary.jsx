import { Component } from 'react';
import { reportClientError } from '../lib/api.js';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportClientError(
      String(error?.message ?? error ?? 'Unknown client error'),
      [error?.stack, info?.componentStack].filter(Boolean).join('\n\n'),
      'error-boundary'
    );
  }

  render() {
    if (this.state.error) {
      return (
        <main className="auth-shell">
          <section className="auth-card">
            <p className="eyebrow">Focus Flow</p>
            <h1>Something went wrong</h1>
            <p className="lede">{String(this.state.error?.message ?? this.state.error)}</p>
            <button onClick={() => this.setState({ error: null })}>Try again</button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
