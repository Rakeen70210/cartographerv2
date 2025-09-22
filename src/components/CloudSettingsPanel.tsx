/**
 * CloudSettingsPanel - Cloud system settings interface
 * Provides user controls for cloud rendering configuration
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
// Using TouchableOpacity for slider-like controls instead of external slider
import { useCloudSettings } from '../hooks/useCloudSettings';
import { cloudFogIntegration, fogSystemCompatibility } from '../services/cloudSystem/integration';
import { CloudSettings } from '../types/cloud';
import CloudSystemDiagnostics from './CloudSystemDiagnostics';

const { width } = Dimensions.get('window');

interface CloudSettingsPanelProps {
  visible: boolean;
  onClose: () => void;
}

interface SettingRowProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({ title, subtitle, children }) => (
  <View style={styles.settingRow}>
    <View style={styles.settingInfo}>
      <Text style={styles.settingTitle}>{title}</Text>
      {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
    </View>
    <View style={styles.settingControl}>
      {children}
    </View>
  </View>
);

interface SliderSettingProps {
  title: string;
  subtitle?: string;
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange: (value: number) => void;
  formatValue?: (value: number) => string;
}

const SliderSetting: React.FC<SliderSettingProps> = ({
  title,
  subtitle,
  value,
  minimumValue,
  maximumValue,
  step = 0.1,
  onValueChange,
  formatValue = (v) => v.toFixed(1)
}) => {
  const handleDecrease = () => {
    const newValue = Math.max(minimumValue, value - step);
    onValueChange(newValue);
  };

  const handleIncrease = () => {
    const newValue = Math.min(maximumValue, value + step);
    onValueChange(newValue);
  };

  return (
    <SettingRow title={title} subtitle={subtitle}>
      <View style={styles.sliderContainer}>
        <Text style={styles.sliderValue}>{formatValue(value)}</Text>
        <View style={styles.sliderControls}>
          <TouchableOpacity 
            style={styles.sliderButton} 
            onPress={handleDecrease}
            disabled={value <= minimumValue}
          >
            <Text style={[
              styles.sliderButtonText,
              value <= minimumValue && styles.sliderButtonDisabled
            ]}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.sliderButton} 
            onPress={handleIncrease}
            disabled={value >= maximumValue}
          >
            <Text style={[
              styles.sliderButtonText,
              value >= maximumValue && styles.sliderButtonDisabled
            ]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SettingRow>
  );
};

interface PickerSettingProps {
  title: string;
  subtitle?: string;
  value: string;
  options: { label: string; value: string }[];
  onValueChange: (value: string) => void;
}

const PickerSetting: React.FC<PickerSettingProps> = ({
  title,
  subtitle,
  value,
  options,
  onValueChange
}) => (
  <SettingRow title={title} subtitle={subtitle}>
    <View style={styles.pickerContainer}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.pickerOption,
            value === option.value && styles.pickerOptionSelected
          ]}
          onPress={() => onValueChange(option.value)}
        >
          <Text style={[
            styles.pickerOptionText,
            value === option.value && styles.pickerOptionTextSelected
          ]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </SettingRow>
);

export const CloudSettingsPanel: React.FC<CloudSettingsPanelProps> = ({
  visible,
  onClose
}) => {
  const { settings, loading, error, updateSetting, resetToDefaults } = useCloudSettings();
  const [cloudSystemEnabled, setCloudSystemEnabled] = useState(false);
  const [systemStatus, setSystemStatus] = useState<string>('Unknown');
  const [currentSystem, setCurrentSystem] = useState<'cloud' | 'traditional' | 'both'>('traditional');
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Monitor cloud system status
  useEffect(() => {
    if (visible) {
      const updateStatus = () => {
        const integrationStatus = cloudFogIntegration.getStatus();
        const compatibilityStatus = fogSystemCompatibility.getStatus();
        
        setCloudSystemEnabled(integrationStatus.isActive);
        setCurrentSystem(compatibilityStatus.currentSystem);
        
        if (integrationStatus.hasError) {
          setSystemStatus(`Error: ${integrationStatus.errorMessage}`);
        } else if (integrationStatus.isActive) {
          setSystemStatus('Active');
        } else {
          setSystemStatus('Inactive');
        }
      };

      updateStatus();
      const interval = setInterval(updateStatus, 2000);
      
      return () => clearInterval(interval);
    }
  }, [visible]);

  const handleCloudSystemToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        const success = await cloudFogIntegration.startCloudSystem();
        if (!success) {
          Alert.alert(
            'Cloud System Error',
            'Failed to start cloud system. Using traditional fog instead.',
            [{ text: 'OK' }]
          );
          return;
        }
      } else {
        await cloudFogIntegration.stopCloudSystem();
      }
      
      setCloudSystemEnabled(enabled);
    } catch (error) {
      Alert.alert(
        'Error',
        `Failed to ${enabled ? 'start' : 'stop'} cloud system: ${error}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleSystemSwitch = async (system: 'cloud' | 'traditional') => {
    try {
      const success = await fogSystemCompatibility.switchToSystem(system);
      if (success) {
        setCurrentSystem(system);
      } else {
        Alert.alert(
          'Switch Failed',
          `Failed to switch to ${system} system`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        `Error switching systems: ${error}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all cloud settings to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetToDefaults();
              Alert.alert('Success', 'Settings reset to defaults');
            } catch (error) {
              Alert.alert('Error', `Failed to reset settings: ${error}`);
            }
          }
        }
      ]
    );
  };

  const qualityOptions = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' }
  ];

  const colorSchemeOptions = [
    { label: 'Day', value: 'day' },
    { label: 'Night', value: 'night' },
    { label: 'Custom', value: 'custom' }
  ];

  if (loading) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading cloud settings...</Text>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cloud Settings</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setShowDiagnostics(true)} style={styles.diagnosticsButton}>
              <Text style={styles.diagnosticsButtonText}>Diagnostics</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleResetSettings} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* System Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>System Status</Text>
            
            <SettingRow 
              title="Cloud System" 
              subtitle={`Status: ${systemStatus}`}
            >
              <Switch
                value={cloudSystemEnabled}
                onValueChange={handleCloudSystemToggle}
                trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                thumbColor={cloudSystemEnabled ? '#FFFFFF' : '#FFFFFF'}
              />
            </SettingRow>

            <SettingRow 
              title="Current System" 
              subtitle={`Using ${currentSystem} fog rendering`}
            >
              <View style={styles.systemButtons}>
                <TouchableOpacity
                  style={[
                    styles.systemButton,
                    currentSystem === 'cloud' && styles.systemButtonActive
                  ]}
                  onPress={() => handleSystemSwitch('cloud')}
                  disabled={!fogSystemCompatibility.isCloudSystemAvailable()}
                >
                  <Text style={[
                    styles.systemButtonText,
                    currentSystem === 'cloud' && styles.systemButtonTextActive
                  ]}>
                    Cloud
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.systemButton,
                    currentSystem === 'traditional' && styles.systemButtonActive
                  ]}
                  onPress={() => handleSystemSwitch('traditional')}
                >
                  <Text style={[
                    styles.systemButtonText,
                    currentSystem === 'traditional' && styles.systemButtonTextActive
                  ]}>
                    Traditional
                  </Text>
                </TouchableOpacity>
              </View>
            </SettingRow>
          </View>

          {/* Visual Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Visual Settings</Text>
            
            <SliderSetting
              title="Cloud Density"
              subtitle="How thick the clouds appear"
              value={settings.density}
              minimumValue={0.1}
              maximumValue={1.0}
              onValueChange={(value) => updateSetting('density', value)}
              formatValue={(v) => `${Math.round(v * 100)}%`}
            />

            <SliderSetting
              title="Opacity"
              subtitle="Cloud transparency level"
              value={settings.opacity}
              minimumValue={0.1}
              maximumValue={1.0}
              onValueChange={(value) => updateSetting('opacity', value)}
              formatValue={(v) => `${Math.round(v * 100)}%`}
            />

            <SliderSetting
              title="Contrast"
              subtitle="Visual contrast adjustment"
              value={settings.contrast}
              minimumValue={0.5}
              maximumValue={2.0}
              onValueChange={(value) => updateSetting('contrast', value)}
              formatValue={(v) => `${v.toFixed(1)}x`}
            />

            <PickerSetting
              title="Color Scheme"
              subtitle="Cloud color theme"
              value={settings.colorScheme}
              options={colorSchemeOptions}
              onValueChange={(value) => updateSetting('colorScheme', value as CloudSettings['colorScheme'])}
            />
          </View>

          {/* Performance Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance Settings</Text>
            
            <PickerSetting
              title="Quality"
              subtitle="Rendering quality level"
              value={settings.quality}
              options={qualityOptions}
              onValueChange={(value) => updateSetting('quality', value as CloudSettings['quality'])}
            />

            <SliderSetting
              title="Animation Speed"
              subtitle="Cloud movement speed"
              value={settings.animationSpeed}
              minimumValue={0.1}
              maximumValue={2.0}
              onValueChange={(value) => updateSetting('animationSpeed', value)}
              formatValue={(v) => `${v.toFixed(1)}x`}
            />
          </View>

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Error: {error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Diagnostics Modal */}
        <CloudSystemDiagnostics
          visible={showDiagnostics}
          onClose={() => setShowDiagnostics(false)}
        />
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
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  diagnosticsButton: {
    paddingVertical: 8,
  },
  diagnosticsButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  resetButton: {
    paddingVertical: 8,
  },
  resetButtonText: {
    fontSize: 16,
    color: '#FF3B30',
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  settingControl: {
    alignItems: 'flex-end',
  },
  sliderContainer: {
    alignItems: 'center',
    minWidth: 120,
  },
  sliderValue: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 8,
  },
  sliderControls: {
    flexDirection: 'row',
    gap: 8,
  },
  sliderButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sliderButtonDisabled: {
    color: '#8E8E93',
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  pickerOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  pickerOptionTextSelected: {
    color: '#FFFFFF',
  },
  systemButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  systemButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  systemButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  systemButtonText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
  },
  systemButtonTextSelected: {
    color: '#FFFFFF',
  },
  systemButtonTextActive: {
    color: '#FFFFFF',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    margin: 20,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});

export default CloudSettingsPanel;