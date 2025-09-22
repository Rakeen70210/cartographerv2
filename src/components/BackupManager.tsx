import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal
} from 'react-native';
import { getBackupService, BackupData } from '../services/backupService';

interface BackupFileInfo {
  name: string;
  path: string;
  size: number;
  modifiedAt: Date;
}

interface BackupManagerProps {
  visible: boolean;
  onClose: () => void;
}

export const BackupManager: React.FC<BackupManagerProps> = ({ visible, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [backupFiles, setBackupFiles] = useState<BackupFileInfo[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<BackupFileInfo | null>(null);
  const [backupInfo, setBackupInfo] = useState<BackupData | null>(null);

  const backupService = getBackupService();

  useEffect(() => {
    if (visible) {
      loadBackupFiles();
    }
  }, [visible]);

  const loadBackupFiles = async () => {
    try {
      setLoading(true);
      const files = await backupService.listBackupFiles();
      setBackupFiles(files);
    } catch (error) {
      console.error('Failed to load backup files:', error);
      Alert.alert('Error', 'Failed to load backup files');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      await backupService.exportBackup({
        includeMetadata: true,
        validateIntegrity: true
      });
      
      Alert.alert(
        'Success',
        'Backup created and exported successfully!',
        [{ text: 'OK', onPress: loadBackupFiles }]
      );
    } catch (error) {
      console.error('Failed to create backup:', error);
      Alert.alert('Error', `Failed to create backup: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportBackup = async () => {
    try {
      setLoading(true);
      
      Alert.alert(
        'Import Backup',
        'This will replace all your current data. A backup of your current data will be created first. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            style: 'destructive',
            onPress: async () => {
              try {
                await backupService.importBackup({
                  validateBeforeRestore: true,
                  createBackupBeforeRestore: true,
                  mergeMode: 'replace'
                });
                
                Alert.alert(
                  'Success',
                  'Backup imported successfully!',
                  [{ text: 'OK', onPress: () => { loadBackupFiles(); onClose(); } }]
                );
              } catch (error) {
                console.error('Failed to import backup:', error);
                Alert.alert('Error', `Failed to import backup: ${error}`);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Failed to import backup:', error);
      Alert.alert('Error', `Failed to import backup: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMergeBackup = async () => {
    try {
      setLoading(true);
      
      Alert.alert(
        'Merge Backup',
        'This will merge the backup data with your current data. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Merge',
            onPress: async () => {
              try {
                await backupService.importBackup({
                  validateBeforeRestore: true,
                  createBackupBeforeRestore: true,
                  mergeMode: 'merge'
                });
                
                Alert.alert(
                  'Success',
                  'Backup merged successfully!',
                  [{ text: 'OK', onPress: () => { loadBackupFiles(); onClose(); } }]
                );
              } catch (error) {
                console.error('Failed to merge backup:', error);
                Alert.alert('Error', `Failed to merge backup: ${error}`);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Failed to merge backup:', error);
      Alert.alert('Error', `Failed to merge backup: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (file: BackupFileInfo) => {
    Alert.alert(
      'Delete Backup',
      `Are you sure you want to delete ${file.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await backupService.deleteBackupFile(file.path);
              loadBackupFiles();
            } catch (error) {
              console.error('Failed to delete backup:', error);
              Alert.alert('Error', 'Failed to delete backup file');
            }
          }
        }
      ]
    );
  };

  const handleViewBackupInfo = async (file: BackupFileInfo) => {
    try {
      setLoading(true);
      const info = await backupService.getBackupInfo(file.path);
      setBackupInfo(info);
      setSelectedBackup(file);
    } catch (error) {
      console.error('Failed to load backup info:', error);
      Alert.alert('Error', 'Failed to load backup information');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupOldBackups = async () => {
    Alert.alert(
      'Cleanup Old Backups',
      'This will keep only the 10 most recent backups and delete the rest. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cleanup',
          onPress: async () => {
            try {
              setLoading(true);
              await backupService.cleanupOldBackups(10);
              loadBackupFiles();
              Alert.alert('Success', 'Old backups cleaned up successfully');
            } catch (error) {
              console.error('Failed to cleanup backups:', error);
              Alert.alert('Error', 'Failed to cleanup old backups');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Backup Manager</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Create & Import</Text>
            
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateBackup}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>Create & Export Backup</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleImportBackup}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Import Backup (Replace)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleMergeBackup}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Import Backup (Merge)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Local Backups ({backupFiles.length})</Text>
              {backupFiles.length > 10 && (
                <TouchableOpacity onPress={handleCleanupOldBackups} disabled={loading}>
                  <Text style={styles.cleanupText}>Cleanup Old</Text>
                </TouchableOpacity>
              )}
            </View>

            {backupFiles.length === 0 ? (
              <Text style={styles.emptyText}>No backup files found</Text>
            ) : (
              backupFiles.map((file, index) => (
                <View key={index} style={styles.backupItem}>
                  <View style={styles.backupInfo}>
                    <Text style={styles.backupName}>{file.name}</Text>
                    <Text style={styles.backupDetails}>
                      {formatFileSize(file.size)} • {formatDate(file.modifiedAt)}
                    </Text>
                  </View>
                  <View style={styles.backupActions}>
                    <TouchableOpacity
                      onPress={() => handleViewBackupInfo(file)}
                      style={styles.actionButton}
                    >
                      <Text style={styles.actionButtonText}>Info</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteBackup(file)}
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

        {/* Backup Info Modal */}
        <Modal
          visible={!!selectedBackup && !!backupInfo}
          animationType="fade"
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Backup Information</Text>
              
              {backupInfo && (
                <ScrollView style={styles.modalScroll}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Version:</Text>
                    <Text style={styles.infoValue}>{backupInfo.version}</Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Created:</Text>
                    <Text style={styles.infoValue}>
                      {new Date(backupInfo.timestamp).toLocaleString()}
                    </Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Explored Areas:</Text>
                    <Text style={styles.infoValue}>{backupInfo.exploredAreas.length}</Text>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Achievements:</Text>
                    <Text style={styles.infoValue}>{backupInfo.achievements.length}</Text>
                  </View>
                  
                  {backupInfo.userStats && (
                    <>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Exploration %:</Text>
                        <Text style={styles.infoValue}>
                          {backupInfo.userStats.exploration_percentage.toFixed(2)}%
                        </Text>
                      </View>
                      
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Total Distance:</Text>
                        <Text style={styles.infoValue}>
                          {(backupInfo.userStats.total_distance / 1000).toFixed(2)} km
                        </Text>
                      </View>
                    </>
                  )}
                </ScrollView>
              )}
              
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setSelectedBackup(null);
                  setBackupInfo(null);
                }}
              >
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </TouchableOpacity>
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
  cleanupText: {
    color: '#FF6B6B',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    padding: 20,
  },
  backupItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backupInfo: {
    flex: 1,
  },
  backupName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  backupDetails: {
    fontSize: 14,
    color: '#666',
  },
  backupActions: {
    flexDirection: 'row',
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalScroll: {
    maxHeight: 300,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
  },
  modalCloseButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});