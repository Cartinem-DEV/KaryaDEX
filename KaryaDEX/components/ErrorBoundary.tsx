// components/ErrorBoundary.tsx
// React Error Boundary with Sentry integration for KaryaDEX

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Sentry from '@sentry/react-native';
import { captureException, isSentryInitialized, flush } from '@/services/monitoring/sentryService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError } = this.props;

    // Update state with error info
    this.setState({ errorInfo });

    // Log to Sentry
    if (isSentryInitialized()) {
      Sentry.captureException(error, {
        extra: {
          componentStack: errorInfo.componentStack,
        },
      });
    } else {
      // Fallback to console in development
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleReset = async (): Promise<void> => {
    const { onReset } = this.props;

    // Flush any pending Sentry events before reset
    await flush();

    this.setState({ hasError: false, error: null, errorInfo: null });

    if (onReset) {
      onReset();
    }
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, showDetails = __DEV__ } = this.props;

    if (hasError) {
      // If custom fallback provided, use it
      if (fallback) {
        return typeof fallback === 'function'
          ? (fallback as any)({ error, reset: this.handleReset })
          : fallback;
      }

      // Default fallback UI
      return (
        <View style={styles.container} accessibilityLiveRegion="assertive">
          <View style={styles.errorBox}>
            <Text style={styles.title}>Something went wrong</Text>

            {showDetails && error && (
              <View style={styles.details}>
                <Text style={styles.errorText} selectable>
                  {error.message}
                </Text>
                {this.state.errorInfo?.componentStack && (
                  <Text style={styles.stackText} selectable>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.buttonRow}>
              <Button
                title="Try Again"
                onPress={this.handleReset}
                color="#6366f1"
                accessibilityLabel="Reset the app and try again"
              />
              {Platform.OS !== 'web' && (
                <Button
                  title="Report Issue"
                  onPress={() => {
                    // Could open a feedback form or email
                    if (isSentryInitialized()) {
                      Sentry.showFeedbackForm();
                    }
                  }}
                  color="#10b981"
                  accessibilityLabel="Report this issue to the development team"
                />
              )}
            </View>

            <Text style={styles.hint}>
              The error has been automatically reported.{' '}
              {showDetails ? 'Details shown above.' : 'Restart the app to continue.'}
            </Text>
          </View>
        </View>
      );
    }

    return children;
  }
}

// Export Sentry's ErrorBoundary wrapper as well for convenience
export const SentryErrorBoundary = Sentry.ErrorBoundary;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#05070B',
  },
  errorBox: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    backgroundColor: '#0B0C11',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  details: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#1a1b23',
    borderRadius: 8,
    maxHeight: 200,
  },
  errorText: {
    fontSize: 14,
    color: '#fca5a5',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  stackText: {
    fontSize: 11,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 16,
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
});

// Higher-order component for wrapping screens
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
): React.FC<P> {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}