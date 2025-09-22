import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Switch,
  TextInput
} from 'react-native';
import { getOfflineService, NetworkState } from '../services/offlineService';
import { getMapboxOfflineService, OfflineRegion } from '../services/mapboxOfflineService';

interface OfflineManagerProps {
  visible: boolean;
  onClose: () => void;
}

export const OfflineManager: React.FC<OfflineManagerProps> = ({ visible, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [networkState, setNetworkState] = useState<NetworkState | null>(null);
  const [offlineRegions, setOfflineRegions] = useState<OfflineRegion[]>([]);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [storageUsage, setStorageUsage] = useState<any>(null);
  const [showCreateRegion, setShowCreateRegion] = useState(false);
  const [newRegionName, setNewRegionName] = useState('');
  const [cacheEnabled, setCacheEnabled] = useState(true);

  const offlineService = getOfflineService();
  const mapboxOfflineService = getMapboxOfflineService();

  useEffect(() => {
    if (visible) {
      loadOfflineData();
      setupNetworkListener();
    }
  }, [visible]);

  const setupNetworkListener = () => {
    const unsubscribe = offlineService.addNetworkListener((state) => {
      setNetworkState(state);
    });

    // Get initial network state
    setNetworkState(offlineService.getNetworkState());

    return unsubscribe;
  };

  const loadOfflineData = async () => {
    try {
      setLoading(true);
      
      // Load offline regions
      const regions = mapboxOfflineService.getOfflineRegions();
      setOfflineRegions(regions);
      
      // Load offline queue status
      const queueStatus = offlineService.getOfflineQueueStatus();
      setOfflineQueueCount(queueStatus.count);
      
      // Load cache stats
      const stats = await offlineService.getCacheStats();
      setCacheStats(stats);
      
      // Load storage usage
      const usage = await mapboxOfflineService.getStorageUsage();
      setStorageUsage(usage);
      
      // Load cache config
      const config = offlineService.getConfig();
      setCacheEnabled(config.enableDataCache);
    } catch (error) {
      console.error('Failed to load offline data:', error);
      Alert.alert('Error', 'Failed to load offline data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRegionForExploredAreas = async () => {
    try {
      setLoading(true);
      
      const regionId = await mapboxOfflineService.createOfflineRegionForExploredAreas(
        'My Explored Areas'
      );
      
      if (regionId) {
        Alert.alert(
          'Success',
          'Started downloading offline maps for your explored areas!',
          [{ text: 'OK', onPress: loadOfflineData }]
        );
      } else {
        Alert.alert(
          'No Data',
          'You need to explore some areas first before creating an offline region.'
        );
      }
    } catch (error) {
      console.error('Failed to create offline region:', error);
      Alert.alert('Error', `Failed to create offline region: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomRegion = async () => {
    if (!newRegionName.trim()) {
      Alert.alert('Error', 'Please enter a region name');
      return;
    }

    try {
      setLoading(true);
      
      // For demo purposes, create a region around San Francisco
      // In a real app, you'd let users select the area on the map
      const bounds: [number, number, number, number] = [-122.5, 37.7, -122.3, 37.8];
      
      await mapboxOfflineService.createOfflineRegion(
        newRegionName.trim(),
        bounds,
        0,
        16
      );
      
      setShowCreateRegion(false);
      setNewRegionName('');
      
      Alert.alert(
        'Success',
        'Started downloading offline region!',
        [{ text: 'OK', onPress: loadOfflineData }]
      );
    } catch (error) {
      console.error('Failed to create custom region:', error);
      Alert.alert('Error', `Failed to create region: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRegion = async (region: OfflineRegion) => {
    Alert.alert(
      'Delete Offline Region',
      `Are you sure you want to delete "${region.name}"? This will remove all downloaded map data for this region.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await mapboxOfflineService.deleteOfflineRegion(region.id);
              loadOfflineData();
            } catch (error) {
              console.error('Failed to delete region:', error);
              Alert.alert('Error', 'Failed to delete offline region');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handlePauseResumeDownload = async (region: OfflineRegion) => {
    try {
      if (region.downloadState === 'active') {
        await mapboxOfflineService.pauseDownload(region.id);
      } else if (region.downloadState === 'inactive') {
        await mapboxOfflineService.resumeDownload(region.id);
      }
      loadOfflineData();
    } catch (error) {
      console.error('Failed to pause/resume download:', error);
      Alert.alert('Error', 'Failed to pause/resume download');
    }
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await offlineService.clearCache();
              loadOfflineData();
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              console.error('Failed to clear cache:', error);
              Alert.alert('Error', 'Failed to clear cache');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleClearOfflineQueue = async () => {
    Alert.alert(
      'Clear Offline Queue',
      'This will clear all pending offline operations. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await offlineService.clearOfflineQueue();
              loadOfflineData();
              Alert.alert('Success', 'Offline queue cleared');
            } catch (error) {
              console.error('Failed to clear offline queue:', error);
              Alert.alert('Error', 'Failed to clear offline queue');
            }
          }
        }
      ]
    );
  };

  const handleToggleCache = async (enabled: boolean) => {
    setCacheEnabled(enabled);
    offlineService.updateConfig({ enableDataCache: enabled });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getNetworkStatusColor = (): string => {
    if (!networkState) return '#8E8E93';
    return networkState.isConnected ? '#34C759' : '#FF3B30';
  };

  const getNetworkStatusText = (): string => {
    if (!networkState) return 'Unknown';
    if (networkState.isConnected) {
      return `Online (${networkState.type})`;
    }
    return 'Offline';
  };

  const getDownloadStateText = (state: string): string => {
    switch (state) {
      case 'inactive': return 'Paused';
      case 'active': return 'Downloading';
      case 'complete': return 'Complete';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  const getDownloadStateColor = (state: string): string => {
    switch (state) {
      case 'inactive': return '#FF9500';
      case 'active': return '#007AFF';
      case 'complete': return '#34C759';
      case 'error': return '#FF3B30';
      default: return '#8E8E93';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Offline Manager</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        <ScrollView style={styles.content}>
          {/* Network Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Network Status</Text>
            <View style={styles.statusCard}>
              <View style={[styles.statusIndicator, { backgroundColor: getNetworkStatusColor() }]} />
              <Text style={styles.statusText}>{getNetworkStatusText()}</Text>
            </View>
          </View>

          {/* Cache Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cache Settings</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Enable Data Cache</Text>
              <Switch
                value={cacheEnabled}
                onValueChange={handleToggleCache}
                trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
              />
            </View>
            
            {cacheStats && (
              <View style={styles.statsCard}>
                <Text style={styles.statsTitle}>Cache Statistics</Text>
                <View style={styles.statsRow}>
                  <Text style={styles.statsLabel}>Items:</Text>
                  <Text style={styles.statsValue}>{cacheStats.itemCount}</Text>
                </View>
                <View style={styles.statsRow}>
                  <Text style={styles.statsLabel}>Size:</Text>
                  <Text style={styles.statsValue}>{formatFileSize(cacheStats.totalSize)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={handleClearCache}
                  disabled={loading}
                >
                  <Text style={styles.clearButtonText}>Clear Cache</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Offline Queue */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Offline Queue</Text>
            <View style={styles.queueCard}>
              <Text style={styles.queueText}>
                {offlineQueueCount} items pending sync
              </Text>
              {offlineQueueCount > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={handleClearOfflineQueue}
                  disabled={loading}
                >
                  <Text style={styles.clearButtonText}>Clear Queue</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Offline Regions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Offline Maps</Text>
              <TouchableOpacity
                onPress={() => setShowCreateRegion(true)}
                style={styles.addButton}
                disabled={loading}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateRegionForExploredAreas}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>Download My Explored Areas</Text>
            </TouchableOpacity>

            {storageUsage && (
              <View style={styles.storageCard}>
                <Text style={styles.storageTitle}>Storage Usage</Text>
                <View style={styles.statsRow}>
                  <Text style={styles.statsLabel}>Total Size:</Text>
                  <Text style={styles.statsValue}>{formatFileSize(storageUsage.totalSize)}</Text>
                </View>
                <View style={styles.statsRow}>
                  <Text style={styles.statsLabel}>Regions:</Text>
                  <Text style={styles.statsValue}>
                    {storageUsage.completedRegions}/{storageUsage.regionCount}
                  </Text>
                </View>
              </View>
            )}

            {offlineRegions.length === 0 ? (
              <Text style={styles.emptyText}>No offline regions</Text>
            ) : (
              offlineRegions.map((region, index) => (
                <View key={index} style={styles.regionCard}>
                  <View style={styles.regionHeader}>
                    <Text style={styles.regionName}>{region.name}</Text>
                    <View style={[
                      styles.regionStatus,
                      { backgroundColor: getDownloadStateColor(region.downloadState) }
                    ]}>
                      <Text style={styles.regionStatusText}>
                        {getDownloadStateText(region.downloadState)}
                      </Text>
                    </View>
                  </View>
                  
                  {region.downloadState === 'active' && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${region.downloadProgress}%` }
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {Math.round(region.downloadProgress)}%
                      </Text>
                    </View>
                  )}
                  
                  <View style={styles.regionActions}>
                    {(region.downloadState === 'active' || region.downloadState === 'inactive') && (
                      <TouchableOpacity
                        onPress={() => handlePauseResumeDownload(region)}
                        style={styles.actionButton}
                      >
                        <Text style={styles.actionButtonText}>
                          {region.downloadState === 'active' ? 'Pause' : 'Resume'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity
                      onPress={() => handleDeleteRegion(region)}
                      style={[styles.actionButton, styles.deleteButton]}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* Create Region Modal */}
        <Modal
          visible={showCreateRegion}
          animationType="fade"
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create Offline Region</Text>
              
              <TextInput
                style={styles.textInput}
                placeholder="Region name"
                value={newRegionName}
                onChangeText={setNewRegionName}
                autoFocus
              />
              
              <Text style={styles.modalNote}>
                This will create an offline region for San Francisco (demo area).
                In a full implementation, you would select the area on the map.
              </Text>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowCreateRegion(false);
                    setNewRegionName('');
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.modalCreateButton}
                  onPress={handleCreateCustomRegion}
                  disabled={loading}
                >
                  <Text style={styles.modalCreateButtonText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
  },
  settingRow: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  statsCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statsLabel: {
    fontSize: 14,
    color: '#666',
  },
  statsValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  clearButton: {
    backgroundColor: '#FF6B6B',
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 8,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  queueCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
  },
  queueText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  storageCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  storageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    padding: 20,
  },
  regionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  regionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  regionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  regionStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  regionStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    minWidth: 35,
    textAlign: 'right',
  },
  regionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  modalNote: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  modalCancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  modalCreateButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: '#007AFF',
  },
  modalCreateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});