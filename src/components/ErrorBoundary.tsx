import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { getErrorRecoveryService } from '../services/errorRecoveryService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  private errorRecoveryService = getErrorRecoveryService();
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error for debugging
    this.logError(error, errorInfo);
  }

  private logError = (error: Error, errorInfo: ErrorInfo) => {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount,
    };

    console.error('React Error Boundary:', errorDetails);

    // In production, you might want to send this to a logging service
    if (__DEV__) {
      console.group('Error Boundary Details');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }
  };

  private handleRetry = async () => {
    const { error, retryCount } = this.state;
    
    if (!error || retryCount >= this.maxRetries) {
      Alert.alert(
        'Maximum Retries Reached',
        'The application has encountered repeated errors. Please restart the app.',
        [
          { text: 'OK', style: 'default' }
        ]
      );
      return;
    }

    try {
      // Attempt error recovery
      const recovered = await this.attemptRecovery(error);
      
      if (recovered) {
        // Reset error state and retry
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: retryCount + 1,
        });
      } else {
        // Recovery failed, increment retry count
        this.setState({
          retryCount: retryCount + 1,
        });
        
        Alert.alert(
          'Recovery Failed',
          'Unable to recover from the error. You can try again or restart the app.',
          [
            { text: 'Try Again', onPress: this.handleRetry },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    } catch (recoveryError) {
      console.error('Error recovery failed:', recoveryError);
      this.setState({
        retryCount: retryCount + 1,
      });
    }
  };

  private attemptRecovery = async (error: Error): Promise<boolean> => {
    try {
      // Determine error type and attempt appropriate recovery
      if (this.isLocationError(error)) {
        return await this.errorRecoveryService.handleLocationError(
          error,
          'componentError',
          { componentStack: this.state.errorInfo?.componentStack }
        );
      } else if (this.isDatabaseError(error)) {
        return await this.errorRecoveryService.handleDatabaseError(
          error,
          'componentError',
          { componentStack: this.state.errorInfo?.componentStack }
        );
      } else if (this.isNetworkError(error)) {
        return await this.errorRecoveryService.handleNetworkError(
          error,
          'componentError',
          { componentStack: this.state.errorInfo?.componentStack }
        );
      } else {
        // Generic error recovery
        console.log('Attempting generic error recovery...');
        
        // Wait a moment before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // For React errors, we typically just retry rendering
        return true;
      }
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError);
      return false;
    }
  };

  private isLocationError = (error: Error): boolean => {
    const locationErrorIndicators = [
      'location',
      'permission',
      'gps',
      'coordinates',
      'tracking',
    ];
    
    return locationErrorIndicators.some(indicator =>
      error.message.toLowerCase().includes(indicator)
    );
  };

  private isDatabaseError = (error: Error): boolean => {
    const databaseErrorIndicators = [
      'database',
      'sqlite',
      'sql',
      'query',
      'transaction',
      'table',
    ];
    
    return databaseErrorIndicators.some(indicator =>
      error.message.toLowerCase().includes(indicator)
    );
  };

  private isNetworkError = (error: Error): boolean => {
    const networkErrorIndicators = [
      'network',
      'fetch',
      'request',
      'connection',
      'timeout',
      'offline',
    ];
    
    return networkErrorIndicators.some(indicator =>
      error.message.toLowerCase().includes(indicator)
    );
  };

  private handleRestart = () => {
    Alert.alert(
      'Restart Application',
      'This will restart the application. Any unsaved progress may be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Restart', 
          style: 'destructive',
          onPress: () => {
            // In React Native, we can't actually restart the app
            // But we can reset the error boundary and hope for the best
            this.setState({
              hasError: false,
              error: null,
              errorInfo: null,
              retryCount: 0,
            });
          }
        }
      ]
    );
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
            <Text style={styles.errorMessage}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
            
            {__DEV__ && this.state.error?.stack && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug Information:</Text>
                <Text style={styles.debugText} numberOfLines={10}>
                  {this.state.error.stack}
                </Text>
              </View>
            )}
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.retryButton]} 
                onPress={this.handleRetry}
                disabled={this.state.retryCount >= this.maxRetries}
              >
                <Text style={styles.buttonText}>
                  {this.state.retryCount >= this.maxRetries ? 'Max Retries Reached' : 'Try Again'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.restartButton]} 
                onPress={this.handleRestart}
              >
                <Text style={styles.buttonText}>Reset App</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.retryCount}>
              Retry attempts: {this.state.retryCount}/{this.maxRetries}
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  debugContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  retryButton: {
    backgroundColor: '#4A90E2',
  },
  restartButton: {
    backgroundColor: '#f57c00',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

export default ErrorBoundary;