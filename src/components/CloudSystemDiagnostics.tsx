/**
 * CloudSystemDiagnostics - Diagnostic information and troubleshooting for cloud system
 * Provides detailed status information and diagnostic tools
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { cloudFogIntegration, fogSystemCompatibility, explorationStateSynchronizer } from '../services/cloudSystem/integration';
import { useCloudSettings } from '../hooks/useCloudSettings';

interface CloudSystemDiagnosticsProps {
  visible: boolean;
  onClose: () => void;
}

interface DiagnosticItemProps {
  title: string;
  value: string | number | boolean;
  status?: 'good' | 'warning' | 'error';
  subtitle?: string;
}

const DiagnosticItem: React.FC<DiagnosticItemProps> = ({ 
  title, 
  value, 
  status = 'good', 
  subtitle 
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return '#34C759';
      case 'warning': return '#FF9500';
      case 'error': return '#FF3B30';
      default: return '#8E8E93';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'good': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  const formatValue = (val: string | number | boolean) => {
    if (typeof val === 'boolean') {
      return val ? 'Yes' : 'No';
    }
    return val.toString();
  };

  return (
    <View style={styles.diagnosticItem}>
      <View style={styles.diagnosticHeader}>
        <Text style={styles.diagnosticTitle}>{title}</Text>
        <View style={styles.diagnosticStatus}>
          <Text style={styles.diagnosticIcon}>{getStatusIcon()}</Text>
          <Text style={[styles.diagnosticValue, { color: getStatusColor() }]}>
            {formatValue(value)}
          </Text>
        </View>
      </View>
      {subtitle && (
        <Text style={styles.diagnosticSubtitle}>{subtitle}</Text>
      )}
    </View>
  );
};

export const CloudSystemDiagnostics: React.FC<CloudSystemDiagnosticsProps> = ({
  visible,
  onClose
}) => {
  const { settings } = useCloudSettings();
  const [refreshing, setRefreshing] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState({
    cloudSystem: {
      isInitialized: false,
      isActive: false,
      hasError: false,
      errorMessage: '',
      lastSyncTime: 0,
      exploredAreasCount: 0,
      cloudPatchesCount: 0
    },
    compatibility: {
      cloudSystemActive: false,
      traditionalFogActive: false,
      currentSystem: 'traditional' as 'cloud' | 'traditional' | 'both',
      performanceScore: 0,
      lastFallbackTime: 0
    },
    synchronization: {
      isAutoSyncEnabled: false,
      isSyncing: false,
      lastSyncTime: 0
    }
  });

  const updateDiagnosticData = async () => {
    try {
      const cloudStatus = cloudFogIntegration.getStatus();
      const compatibilityStatus = fogSystemCompatibility.getStatus();
      const syncStatus = explorationStateSynchronizer.getStatus();

      setDiagnosticData({
        cloudSystem: cloudStatus,
        compatibility: compatibilityStatus,
        synchronization: syncStatus
      });
    } catch (error) {
      console.error('Error updating diagnostic data:', error);
    }
  };

  useEffect(() => {
    if (visible) {
      updateDiagnosticData();
      const interval = setInterval(updateDiagnosticData, 2000);
      return () => clearInterval(interval);
    }
  }, [visible]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await updateDiagnosticData();
    setRefreshing(false);
  };

  const handleRunDiagnostics = async () => {
    Alert.alert(
      'Run Diagnostics',
      'This will test cloud system functionality and may take a few seconds.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run',
          onPress: async () => {
            try {
              // Test cloud system initialization
              const cloudAvailable = fogSystemCompatibility.isCloudSystemAvailable();
              const traditionalAvailable = fogSystemCompatibility.isTraditionalFogAvailable();
              
              // Test synchronization
              const syncResult = await explorationStateSynchronizer.forcSync();
              
              Alert.alert(
                'Diagnostic Results',
                `Cloud System Available: ${cloudAvailable ? 'Yes' : 'No'}\n` +
                `Traditional Fog Available: ${traditionalAvailable ? 'Yes' : 'No'}\n` +
                `Sync Result: ${syncResult.success ? 'Success' : 'Failed'}\n` +
                `Synced Areas: ${syncResult.syncedCount}\n` +
                `Conflicts Resolved: ${syncResult.conflictsResolved}`,
                [{ text: 'OK' }]
              );
            } catch (error) {
              Alert.alert(
                'Diagnostic Error',
                `Failed to run diagnostics: ${error}`,
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };

  const handleResetCloudSystem = () => {
    Alert.alert(
      'Reset Cloud System',
      'This will restart the cloud system and may temporarily interrupt fog rendering.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await cloudFogIntegration.stopCloudSystem();
              await new Promise(resolve => setTimeout(resolve, 1000));
              const success = await cloudFogIntegration.startCloudSystem();
              
              Alert.alert(
                'Reset Complete',
                success ? 'Cloud system reset successfully' : 'Cloud system failed to restart, using traditional fog',
                [{ text: 'OK' }]
              );
            } catch (error) {
              Alert.alert(
                'Reset Error',
                `Failed to reset cloud system: ${error}`,
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };

  const formatTimestamp = (timestamp: number) => {
    if (timestamp === 0) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const getSystemStatus = (isActive: boolean, hasError: boolean) => {
    if (hasError) return 'error';
    if (isActive) return 'good';
    return 'warning';
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cloud Diagnostics</Text>
          <TouchableOpacity onPress={handleRunDiagnostics} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Test</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Cloud System Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cloud System</Text>
            
            <DiagnosticItem
              title="System Status"
              value={diagnosticData.cloudSystem.isActive ? 'Active' : 'Inactive'}
              status={getSystemStatus(
                diagnosticData.cloudSystem.isActive,
                diagnosticData.cloudSystem.hasError
              )}
              subtitle={diagnosticData.cloudSystem.hasError ? diagnosticData.cloudSystem.errorMessage : undefined}
            />

            <DiagnosticItem
              title="Initialized"
              value={diagnosticData.cloudSystem.isInitialized}
              status={diagnosticData.cloudSystem.isInitialized ? 'good' : 'warning'}
            />

            <DiagnosticItem
              title="Explored Areas"
              value={diagnosticData.cloudSystem.exploredAreasCount}
              status="good"
            />

            <DiagnosticItem
              title="Cloud Patches"
              value={diagnosticData.cloudSystem.cloudPatchesCount}
              status="good"
            />

            <DiagnosticItem
              title="Last Sync"
              value={formatTimestamp(diagnosticData.cloudSystem.lastSyncTime)}
              status={diagnosticData.cloudSystem.lastSyncTime > 0 ? 'good' : 'warning'}
            />
          </View>

          {/* Compatibility Layer */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>System Compatibility</Text>
            
            <DiagnosticItem
              title="Current System"
              value={diagnosticData.compatibility.currentSystem}
              status="good"
            />

            <DiagnosticItem
              title="Cloud System"
              value={diagnosticData.compatibility.cloudSystemActive}
              status={diagnosticData.compatibility.cloudSystemActive ? 'good' : 'warning'}
            />

            <DiagnosticItem
              title="Traditional Fog"
              value={diagnosticData.compatibility.traditionalFogActive}
              status={diagnosticData.compatibility.traditionalFogActive ? 'good' : 'warning'}
            />

            <DiagnosticItem
              title="Performance Score"
              value={`${diagnosticData.compatibility.performanceScore.toFixed(0)} FPS`}
              status={diagnosticData.compatibility.performanceScore > 30 ? 'good' : 
                     diagnosticData.compatibility.performanceScore > 15 ? 'warning' : 'error'}
            />

            <DiagnosticItem
              title="Last Fallback"
              value={formatTimestamp(diagnosticData.compatibility.lastFallbackTime)}
              status={diagnosticData.compatibility.lastFallbackTime === 0 ? 'good' : 'warning'}
            />
          </View>

          {/* Synchronization */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Synchronization</Text>
            
            <DiagnosticItem
              title="Auto Sync"
              value={diagnosticData.synchronization.isAutoSyncEnabled}
              status={diagnosticData.synchronization.isAutoSyncEnabled ? 'good' : 'warning'}
            />

            <DiagnosticItem
              title="Currently Syncing"
              value={diagnosticData.synchronization.isSyncing}
              status={diagnosticData.synchronization.isSyncing ? 'warning' : 'good'}
            />

            <DiagnosticItem
              title="Last Sync"
              value={formatTimestamp(diagnosticData.synchronization.lastSyncTime)}
              status={diagnosticData.synchronization.lastSyncTime > 0 ? 'good' : 'warning'}
            />
          </View>

          {/* Current Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Settings</Text>
            
            <DiagnosticItem
              title="Quality"
              value={settings.quality}
              status="good"
            />

            <DiagnosticItem
              title="Density"
              value={`${Math.round(settings.density * 100)}%`}
              status="good"
            />

            <DiagnosticItem
              title="Animation Speed"
              value={`${settings.animationSpeed.toFixed(1)}x`}
              status="good"
            />

            <DiagnosticItem
              title="Opacity"
              value={`${Math.round(settings.opacity * 100)}%`}
              status="good"
            />

            <DiagnosticItem
              title="Color Scheme"
              value={settings.colorScheme}
              status="good"
            />
          </View>

          {/* Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            
            <TouchableOpacity style={styles.actionRow} onPress={handleResetCloudSystem}>
              <Text style={styles.actionRowText}>Reset Cloud System</Text>
              <Text style={styles.actionRowIcon}>🔄</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionRow} 
              onPress={() => explorationStateSynchronizer.forcSync()}
            >
              <Text style={styles.actionRowText}>Force Sync Data</Text>
              <Text style={styles.actionRowIcon}>🔄</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  closeButton: {
    paddingVertical: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  actionButton: {
    paddingVertical: 8,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  diagnosticItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  diagnosticHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diagnosticTitle: {
    fontSize: 16,
    color: '#000000',
    flex: 1,
  },
  diagnosticStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diagnosticIcon: {
    fontSize: 16,
  },
  diagnosticValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  diagnosticSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  actionRowText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  actionRowIcon: {
    fontSize: 16,
  },
});

export default CloudSystemDiagnostics;