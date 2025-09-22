import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useBackgroundLocation, useBackgroundLocationQueue } from '../hooks/useBackgroundLocation';
import { runAllBackgroundLocationTests } from '../utils/testBackgroundLocation';

interface BackgroundLocationMonitorProps {
  visible?: boolean;
}

export const BackgroundLocationMonitor: React.FC<BackgroundLocationMonitorProps> = ({
  visible = false,
}) => {
  const {
    isActive,
    stats,
    isProcessing,
    error,
    start,
    stop,
    forceProcess,
    refresh,
  } = useBackgroundLocation();

  const {
    queueStatus,
    isLoading: queueLoading,
    error: queueError,
    refresh: refreshQueue,
  } = useBackgroundLocationQueue();

  const [testResults, setTestResults] = useState<any>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      refresh();
      refreshQueue();
    }, 30000);

    return () => clearInterval(interval);
  }, [visible, refresh, refreshQueue]);

  const handleStart = async () => {
    const success = await start();
    if (!success) {
      Alert.alert('Error', 'Failed to start background location service');
    }
  };

  const handleStop = async () => {
    await stop();
  };

  const handleForceProcess = async () => {
    const success = await forceProcess();
    if (!success) {
      Alert.alert('Error', 'Failed to process background locations');
    }
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const results = await runAllBackgroundLocationTests();
      setTestResults(results);
      
      if (results.success) {
        Alert.alert('Tests Passed', 'All background location tests completed successfully');
      } else {
        Alert.alert('Tests Failed', 'Some background location tests failed. Check the results below.');
      }
    } catch (error) {
      Alert.alert('Test Error', `Failed to run tests: ${error}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Background Location Monitor</Text>

      {/* Service Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Status</Text>
        <Text style={styles.statusText}>
          Active: {isActive ? '✅' : '❌'}
        </Text>
        <Text style={styles.statusText}>
          Processing: {isProcessing ? '🔄' : '⏸️'}
        </Text>
        {error && (
          <Text style={styles.errorText}>Error: {error}</Text>
        )}
      </View>

      {/* Statistics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        <Text style={styles.statText}>
          Total Processed: {stats.totalProcessed}
        </Text>
        <Text style={styles.statText}>
          Total Failed: {stats.totalFailed}
        </Text>
        <Text style={styles.statText}>
          Queue Size: {stats.queueSize}
        </Text>
        <Text style={styles.statText}>
          Last Processed: {
            stats.lastProcessedAt > 0 
              ? new Date(stats.lastProcessedAt).toLocaleTimeString()
              : 'Never'
          }
        </Text>
      </View>

      {/* Queue Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Queue Status</Text>
        {queueLoading ? (
          <Text style={styles.statusText}>Loading...</Text>
        ) : (
          <>
            <Text style={styles.statText}>
              Queue Size: {queueStatus.queueSize}
            </Text>
            <Text style={styles.statText}>
              Pending: {queueStatus.pendingCount}
            </Text>
            <Text style={styles.statText}>
              Processed: {queueStatus.processedCount}
            </Text>
            <Text style={styles.statText}>
              Failed: {queueStatus.failedCount}
            </Text>
          </>
        )}
        {queueError && (
          <Text style={styles.errorText}>Queue Error: {queueError}</Text>
        )}
      </View>

      {/* Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Controls</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, isActive ? styles.stopButton : styles.startButton]}
            onPress={isActive ? handleStop : handleStart}
          >
            <Text style={styles.buttonText}>
              {isActive ? 'Stop' : 'Start'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.processButton]}
            onPress={handleForceProcess}
            disabled={isProcessing}
          >
            <Text style={styles.buttonText}>
              {isProcessing ? 'Processing...' : 'Force Process'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.refreshButton]}
            onPress={() => {
              refresh();
              refreshQueue();
            }}
          >
            <Text style={styles.buttonText}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={handleRunTests}
            disabled={isRunningTests}
          >
            <Text style={styles.buttonText}>
              {isRunningTests ? 'Running Tests...' : 'Run Tests'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Test Results */}
      {testResults && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Results</Text>
          <Text style={[
            styles.statusText,
            testResults.success ? styles.successText : styles.errorText
          ]}>
            {testResults.message}
          </Text>
          
          {testResults.results && testResults.results.map((result: any, index: number) => (
            <View key={index} style={styles.testResult}>
              <Text style={styles.testName}>
                {result.test}: {result.success ? '✅' : '❌'}
              </Text>
              {!result.success && (
                <Text style={styles.testError}>{result.message}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  statusText: {
    fontSize: 16,
    marginBottom: 4,
    color: '#666',
  },
  statText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
    marginBottom: 4,
  },
  successText: {
    color: '#2e7d32',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#4caf50',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  processButton: {
    backgroundColor: '#2196f3',
  },
  refreshButton: {
    backgroundColor: '#ff9800',
  },
  testButton: {
    backgroundColor: '#9c27b0',
  },
  testResult: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  testName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  testError: {
    fontSize: 12,
    color: '#d32f2f',
    marginTop: 4,
  },
});