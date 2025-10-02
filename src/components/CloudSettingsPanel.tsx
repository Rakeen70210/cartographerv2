/**
 * CloudSettingsPanel
 * Comprehensive settings panel for cloud system with real-time updates
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Alert,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
// Custom slider component
interface CustomSliderProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
}

const CustomSlider: React.FC<CustomSliderProps> = ({
  value,
  minimumValue,
  maximumValue,
  step,
  onValueChange,
  disabled = false,
}) => {
  const handleDecrease = () => {
    const newValue = Math.max(minimumValue, value - step);
    onValueChange(newValue);
  };

  const handleIncrease = () => {
    const newValue = Math.min(maximumValue, value + step);
    onValueChange(newValue);
  };

  const progress = (value - minimumValue) / (maximumValue - minimumValue);

  return (
    <View style={sliderStyles.container}>
      <TouchableOpacity
        style={[sliderStyles.button, disabled && sliderStyles.buttonDisabled]}
        onPress={handleDecrease}
        disabled={disabled || value <= minimumValue}
      >
        <Text style={sliderStyles.buttonText}>-</Text>
      </TouchableOpacity>
      
      <View style={sliderStyles.track}>
        <View style={[sliderStyles.progress, { width: `${progress * 100}%` }]} />
        <View style={[sliderStyles.thumb, { left: `${progress * 100}%` }]} />
      </View>
      
      <TouchableOpacity
        style={[sliderStyles.button, disabled && sliderStyles.buttonDisabled]}
        onPress={handleIncrease}
        disabled={disabled || value >= maximumValue}
      >
        <Text style={sliderStyles.buttonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const sliderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  track: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    marginHorizontal: 12,
    position: 'relative',
  },
  progress: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    marginLeft: -8,
  },
});
import { useCloudSettings } from '../hooks/useCloudSettings';
import { WindConfig, PerformanceMode } from '../types/cloud';

interface CloudSettingsPanelProps {
  visible: boolean;
  onClose: () => void;
  performanceMode?: PerformanceMode;
}

export const CloudSettingsPanel: React.FC<CloudSettingsPanelProps> = ({
  visible,
  onClose,
  performanceMode = 'medium',
}) => {
  const {
    settings,
    loading,
    error,
    updateAnimationSettings,
    updateWindConfig,
    updateSettings,
    resetToDefaults,
  } = useCloudSettings();

  const [localSettings, setLocalSettings] = useState(settings);
  const [isUpdating, setIsUpdating] = useState(false);

  // Update local settings when global settings change
  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Debounced update function for real-time slider changes
  const debouncedUpdate = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (updateFn: () => Promise<void>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
          try {
            setIsUpdating(true);
            await updateFn();
          } catch (err) {
            console.error('Settings update error:', err);
            Alert.alert('Settings Error', err instanceof Error ? err.message : 'Failed to update settings');
          } finally {
            setIsUpdating(false);
          }
        }, 300); // 300ms debounce
      };
    })(),
    []
  );

  // Animation speed change handler
  const handleAnimationSpeedChange = useCallback((value: number) => {
    const newSettings = { ...localSettings, animationSpeed: value };
    setLocalSettings(newSettings);
    
    debouncedUpdate(() => updateAnimationSettings({ animationSpeed: value }));
  }, [localSettings, updateAnimationSettings, debouncedUpdate]);

  // Cloud density change handler
  const handleDensityChange = useCallback((value: number) => {
    const newSettings = { ...localSettings, density: value };
    setLocalSettings(newSettings);
    
    debouncedUpdate(() => updateAnimationSettings({ density: value }));
  }, [localSettings, updateAnimationSettings, debouncedUpdate]);

  // Wind direction change handler
  const handleWindDirectionChange = useCallback((value: number) => {
    const newWind = { ...localSettings.wind, direction: value };
    const newSettings = { ...localSettings, wind: newWind };
    setLocalSettings(newSettings);
    
    debouncedUpdate(() => updateWindConfig({ direction: value }));
  }, [localSettings, updateWindConfig, debouncedUpdate]);

  // Wind speed change handler
  const handleWindSpeedChange = useCallback((value: number) => {
    const newWind = { ...localSettings.wind, speed: value };
    const newSettings = { ...localSettings, wind: newWind };
    setLocalSettings(newSettings);
    
    debouncedUpdate(() => updateWindConfig({ speed: value }));
  }, [localSettings, updateWindConfig, debouncedUpdate]);

  // Wind turbulence change handler
  const handleWindTurbulenceChange = useCallback((value: number) => {
    const newWind = { ...localSettings.wind, turbulence: value };
    const newSettings = { ...localSettings, wind: newWind };
    setLocalSettings(newSettings);
    
    debouncedUpdate(() => updateWindConfig({ turbulence: value }));
  }, [localSettings, updateWindConfig, debouncedUpdate]);

  // Wind enabled toggle handler
  const handleWindEnabledToggle = useCallback(async (enabled: boolean) => {
    try {
      setIsUpdating(true);
      const newWind = { ...localSettings.wind, enabled };
      const newSettings = { ...localSettings, wind: newWind };
      setLocalSettings(newSettings);
      
      await updateWindConfig({ enabled });
    } catch (err) {
      console.error('Wind toggle error:', err);
      Alert.alert('Settings Error', err instanceof Error ? err.message : 'Failed to toggle wind');
    } finally {
      setIsUpdating(false);
    }
  }, [localSettings, updateWindConfig]);

  // Quality change handler
  const handleQualityChange = useCallback(async (quality: 'low' | 'medium' | 'high') => {
    try {
      setIsUpdating(true);
      const newSettings = { ...localSettings, quality };
      setLocalSettings(newSettings);
      
      await updateSettings({ quality });
    } catch (err) {
      console.error('Quality change error:', err);
      Alert.alert('Settings Error', err instanceof Error ? err.message : 'Failed to update quality');
    } finally {
      setIsUpdating(false);
    }
  }, [localSettings, updateSettings]);

  // Reset to defaults handler
  const handleResetToDefaults = useCallback(() => {
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
              setIsUpdating(true);
              await resetToDefaults();
            } catch (err) {
              console.error('Reset error:', err);
              Alert.alert('Reset Error', err instanceof Error ? err.message : 'Failed to reset settings');
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  }, [resetToDefaults]);

  // Get performance bounds for current mode
  const getPerformanceBounds = () => {
    switch (performanceMode) {
      case 'low':
        return {
          animationSpeed: { min: 0.1, max: 1.0 },
          density: { min: 0.1, max: 0.6 },
          windSpeed: { min: 0, max: 1.0 },
          windTurbulence: { min: 0, max: 0.3 },
        };
      case 'high':
        return {
          animationSpeed: { min: 0.1, max: 3.0 },
          density: { min: 0.1, max: 1.0 },
          windSpeed: { min: 0, max: 2.0 },
          windTurbulence: { min: 0, max: 1.0 },
        };
      default: // medium
        return {
          animationSpeed: { min: 0.1, max: 2.0 },
          density: { min: 0.1, max: 0.8 },
          windSpeed: { min: 0, max: 1.5 },
          windTurbulence: { min: 0, max: 0.5 },
        };
    }
  };

  const bounds = getPerformanceBounds();

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.title}>Cloud Settings</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Performance Mode Indicator */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance Mode: {performanceMode.toUpperCase()}</Text>
          </View>

          {/* Animation Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Animation</Text>
            
            <View style={styles.setting}>
              <Text style={styles.settingLabel}>
                Animation Speed: {localSettings.animationSpeed.toFixed(1)}
              </Text>
              <CustomSlider
                minimumValue={bounds.animationSpeed.min}
                maximumValue={bounds.animationSpeed.max}
                value={localSettings.animationSpeed}
                onValueChange={handleAnimationSpeedChange}
                step={0.1}
                disabled={loading || isUpdating}
              />
            </View>

            <View style={styles.setting}>
              <Text style={styles.settingLabel}>
                Cloud Density: {localSettings.density.toFixed(1)}
              </Text>
              <CustomSlider
                minimumValue={bounds.density.min}
                maximumValue={bounds.density.max}
                value={localSettings.density}
                onValueChange={handleDensityChange}
                step={0.1}
                disabled={loading || isUpdating}
              />
            </View>
          </View>

          {/* Wind Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Wind Effects</Text>
            
            <View style={styles.setting}>
              <View style={styles.switchContainer}>
                <Text style={styles.settingLabel}>Wind Enabled</Text>
                <Switch
                  value={localSettings.wind.enabled}
                  onValueChange={handleWindEnabledToggle}
                  disabled={loading || isUpdating}
                />
              </View>
            </View>

            {localSettings.wind.enabled && (
              <>
                <View style={styles.setting}>
                  <Text style={styles.settingLabel}>
                    Wind Direction: {Math.round(localSettings.wind.direction)}°
                  </Text>
                  <CustomSlider
                    minimumValue={0}
                    maximumValue={359}
                    value={localSettings.wind.direction}
                    onValueChange={handleWindDirectionChange}
                    step={5}
                    disabled={loading || isUpdating}
                  />
                </View>

                <View style={styles.setting}>
                  <Text style={styles.settingLabel}>
                    Wind Speed: {localSettings.wind.speed.toFixed(1)}
                  </Text>
                  <CustomSlider
                    minimumValue={bounds.windSpeed.min}
                    maximumValue={bounds.windSpeed.max}
                    value={localSettings.wind.speed}
                    onValueChange={handleWindSpeedChange}
                    step={0.1}
                    disabled={loading || isUpdating}
                  />
                </View>

                <View style={styles.setting}>
                  <Text style={styles.settingLabel}>
                    Wind Turbulence: {localSettings.wind.turbulence.toFixed(1)}
                  </Text>
                  <CustomSlider
                    minimumValue={bounds.windTurbulence.min}
                    maximumValue={bounds.windTurbulence.max}
                    value={localSettings.wind.turbulence}
                    onValueChange={handleWindTurbulenceChange}
                    step={0.1}
                    disabled={loading || isUpdating}
                  />
                </View>
              </>
            )}
          </View>

          {/* Quality Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quality</Text>
            
            <View style={styles.qualityButtons}>
              {(['low', 'medium', 'high'] as const).map((quality) => (
                <TouchableOpacity
                  key={quality}
                  style={[
                    styles.qualityButton,
                    localSettings.quality === quality && styles.qualityButtonActive,
                  ]}
                  onPress={() => handleQualityChange(quality)}
                  disabled={loading || isUpdating}
                >
                  <Text
                    style={[
                      styles.qualityButtonText,
                      localSettings.quality === quality && styles.qualityButtonTextActive,
                    ]}
                  >
                    {quality.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Reset Button */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetToDefaults}
              disabled={loading || isUpdating}
            >
              <Text style={styles.resetButtonText}>Reset to Defaults</Text>
            </TouchableOpacity>
          </View>

          {/* Status Indicator */}
          {isUpdating && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>Updating settings...</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  panel: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  setting: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },

  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qualityButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  qualityButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  qualityButtonActive: {
    backgroundColor: '#007AFF',
  },
  qualityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  qualityButtonTextActive: {
    color: 'white',
  },
  resetButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  errorContainer: {
    margin: 16,
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  errorText: {
    fontSize: 14,
    color: '#C62828',
  },
  statusContainer: {
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
});