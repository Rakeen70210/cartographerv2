/**
 * VisualCustomizationManager
 * Manages cloud visual appearance customization including color schemes, styles, and presets
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CloudSettings } from '../../../types/cloud';

const VISUAL_SETTINGS_KEY = 'cloud_visual_settings';

export interface CloudColorScheme {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;      // Main cloud color
    secondary: string;    // Shadow/depth color
    highlight: string;    // Bright areas
    ambient: string;      // Ambient lighting
  };
  opacity: number;
  contrast: number;
}

export interface CloudStylePreset {
  id: string;
  name: string;
  description: string;
  settings: Partial<CloudSettings>;
  colorScheme: string;
  preview?: string; // Base64 encoded preview image
}

export interface VisualCustomizationSettings {
  selectedColorScheme: string;
  selectedStylePreset: string;
  customColors?: CloudColorScheme;
  opacity: number;
  contrast: number;
  brightness: number;
  saturation: number;
  enableCustomColors: boolean;
}

export class VisualCustomizationManager {
  private currentSettings: VisualCustomizationSettings;
  private colorSchemes: Map<string, CloudColorScheme> = new Map();
  private stylePresets: Map<string, CloudStylePreset> = new Map();
  private listeners: Set<(settings: VisualCustomizationSettings) => void> = new Set();
  private isInitialized = false;

  constructor() {
    this.currentSettings = this.getDefaultSettings();
    this.initializeBuiltInSchemes();
    this.initializeBuiltInPresets();
  }

  /**
   * Initialize the visual customization manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadSettings();
      this.isInitialized = true;
      console.log('VisualCustomizationManager initialized');
    } catch (error) {
      console.error('Failed to initialize VisualCustomizationManager:', error);
      this.currentSettings = this.getDefaultSettings();
      this.isInitialized = true;
    }
  }

  /**
   * Get default visual settings
   */
  getDefaultSettings(): VisualCustomizationSettings {
    return {
      selectedColorScheme: 'day',
      selectedStylePreset: 'realistic',
      opacity: 0.8,
      contrast: 1.0,
      brightness: 1.0,
      saturation: 1.0,
      enableCustomColors: false,
    };
  }

  /**
   * Get current visual settings
   */
  getCurrentSettings(): VisualCustomizationSettings {
    return { ...this.currentSettings };
  }

  /**
   * Get all available color schemes
   */
  getColorSchemes(): CloudColorScheme[] {
    return Array.from(this.colorSchemes.values());
  }

  /**
   * Get color scheme by ID
   */
  getColorScheme(id: string): CloudColorScheme | null {
    return this.colorSchemes.get(id) || null;
  }

  /**
   * Get current color scheme
   */
  getCurrentColorScheme(): CloudColorScheme | null {
    if (this.currentSettings.enableCustomColors && this.currentSettings.customColors) {
      return this.currentSettings.customColors;
    }
    return this.getColorScheme(this.currentSettings.selectedColorScheme);
  }

  /**
   * Set color scheme
   */
  async setColorScheme(schemeId: string): Promise<void> {
    if (!this.colorSchemes.has(schemeId)) {
      throw new Error(`Color scheme '${schemeId}' not found`);
    }

    this.currentSettings.selectedColorScheme = schemeId;
    this.currentSettings.enableCustomColors = false;
    
    await this.saveSettings();
    this.notifyListeners();
  }

  /**
   * Create custom color scheme
   */
  async setCustomColorScheme(colors: CloudColorScheme): Promise<void> {
    this.currentSettings.customColors = { ...colors };
    this.currentSettings.enableCustomColors = true;
    
    await this.saveSettings();
    this.notifyListeners();
  }

  /**
   * Get all available style presets
   */
  getStylePresets(): CloudStylePreset[] {
    return Array.from(this.stylePresets.values());
  }

  /**
   * Get style preset by ID
   */
  getStylePreset(id: string): CloudStylePreset | null {
    return this.stylePresets.get(id) || null;
  }

  /**
   * Get current style preset
   */
  getCurrentStylePreset(): CloudStylePreset | null {
    return this.getStylePreset(this.currentSettings.selectedStylePreset);
  }

  /**
   * Set style preset
   */
  async setStylePreset(presetId: string): Promise<void> {
    const preset = this.stylePresets.get(presetId);
    if (!preset) {
      throw new Error(`Style preset '${presetId}' not found`);
    }

    this.currentSettings.selectedStylePreset = presetId;
    
    // Apply preset's color scheme if specified
    if (preset.colorScheme && this.colorSchemes.has(preset.colorScheme)) {
      this.currentSettings.selectedColorScheme = preset.colorScheme;
      this.currentSettings.enableCustomColors = false;
    }
    
    await this.saveSettings();
    this.notifyListeners();
  }

  /**
   * Update visual property
   */
  async updateVisualProperty<K extends keyof VisualCustomizationSettings>(
    key: K,
    value: VisualCustomizationSettings[K]
  ): Promise<void> {
    if (!this.validateVisualProperty(key, value)) {
      throw new Error(`Invalid value for ${key}: ${value}`);
    }

    this.currentSettings[key] = value;
    await this.saveSettings();
    this.notifyListeners();
  }

  /**
   * Get cloud settings with visual customizations applied
   */
  getAppliedCloudSettings(baseSettings: CloudSettings): CloudSettings {
    const currentScheme = this.getCurrentColorScheme();
    const currentPreset = this.getCurrentStylePreset();
    
    let appliedSettings = { ...baseSettings };
    
    // Apply preset settings
    if (currentPreset) {
      appliedSettings = { ...appliedSettings, ...currentPreset.settings };
    }
    
    // Apply color scheme settings
    if (currentScheme) {
      appliedSettings.opacity = Math.min(1, appliedSettings.opacity * currentScheme.opacity);
      appliedSettings.contrast = Math.min(2, appliedSettings.contrast * currentScheme.contrast);
    }
    
    // Apply visual customizations
    appliedSettings.opacity = Math.min(1, appliedSettings.opacity * this.currentSettings.opacity);
    appliedSettings.contrast = Math.min(2, appliedSettings.contrast * this.currentSettings.contrast);
    
    return appliedSettings;
  }

  /**
   * Get shader uniforms for visual customizations
   */
  getVisualUniforms(): Record<string, any> {
    const currentScheme = this.getCurrentColorScheme();
    const uniforms: Record<string, any> = {};
    
    if (currentScheme) {
      // Convert hex colors to RGB arrays
      uniforms.u_cloudPrimaryColor = this.hexToRgb(currentScheme.colors.primary);
      uniforms.u_cloudSecondaryColor = this.hexToRgb(currentScheme.colors.secondary);
      uniforms.u_cloudHighlightColor = this.hexToRgb(currentScheme.colors.highlight);
      uniforms.u_cloudAmbientColor = this.hexToRgb(currentScheme.colors.ambient);
    }
    
    uniforms.u_brightness = this.currentSettings.brightness;
    uniforms.u_saturation = this.currentSettings.saturation;
    uniforms.u_visualOpacity = this.currentSettings.opacity;
    uniforms.u_visualContrast = this.currentSettings.contrast;
    
    return uniforms;
  }

  /**
   * Create custom style preset
   */
  async createCustomPreset(preset: Omit<CloudStylePreset, 'id'>): Promise<string> {
    const id = `custom_${Date.now()}`;
    const customPreset: CloudStylePreset = {
      id,
      ...preset,
    };
    
    this.stylePresets.set(id, customPreset);
    
    // Save custom presets to storage
    await this.saveCustomPresets();
    
    return id;
  }

  /**
   * Delete custom preset
   */
  async deleteCustomPreset(presetId: string): Promise<void> {
    if (!presetId.startsWith('custom_')) {
      throw new Error('Cannot delete built-in preset');
    }
    
    this.stylePresets.delete(presetId);
    
    // If this was the selected preset, switch to default
    if (this.currentSettings.selectedStylePreset === presetId) {
      this.currentSettings.selectedStylePreset = 'realistic';
      await this.saveSettings();
    }
    
    await this.saveCustomPresets();
    this.notifyListeners();
  }

  /**
   * Export current visual settings
   */
  exportSettings(): string {
    return JSON.stringify({
      settings: this.currentSettings,
      customColors: this.currentSettings.customColors,
      timestamp: Date.now(),
    });
  }

  /**
   * Import visual settings
   */
  async importSettings(settingsJson: string): Promise<void> {
    try {
      const imported = JSON.parse(settingsJson);
      
      if (imported.settings && this.validateSettings(imported.settings)) {
        this.currentSettings = { ...this.getDefaultSettings(), ...imported.settings };
        
        if (imported.customColors) {
          this.currentSettings.customColors = imported.customColors;
        }
        
        await this.saveSettings();
        this.notifyListeners();
      } else {
        throw new Error('Invalid settings format');
      }
    } catch (error) {
      throw new Error(`Failed to import settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reset to default visual settings
   */
  async resetToDefaults(): Promise<void> {
    this.currentSettings = this.getDefaultSettings();
    await this.saveSettings();
    this.notifyListeners();
  }

  /**
   * Add settings listener
   */
  addListener(listener: (settings: VisualCustomizationSettings) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove settings listener
   */
  removeListener(listener: (settings: VisualCustomizationSettings) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Dispose of the manager
   */
  dispose(): void {
    this.listeners.clear();
  }

  /**
   * Initialize built-in color schemes
   */
  private initializeBuiltInSchemes(): void {
    const schemes: CloudColorScheme[] = [
      {
        id: 'day',
        name: 'Day',
        description: 'Bright, natural daytime clouds',
        colors: {
          primary: '#F0F0F0',
          secondary: '#D0D0D0',
          highlight: '#FFFFFF',
          ambient: '#E8E8E8',
        },
        opacity: 0.8,
        contrast: 1.0,
      },
      {
        id: 'night',
        name: 'Night',
        description: 'Dark, mysterious nighttime clouds',
        colors: {
          primary: '#404040',
          secondary: '#202020',
          highlight: '#606060',
          ambient: '#303030',
        },
        opacity: 0.9,
        contrast: 1.2,
      },
      {
        id: 'sunset',
        name: 'Sunset',
        description: 'Warm, golden hour clouds',
        colors: {
          primary: '#FFB366',
          secondary: '#CC8844',
          highlight: '#FFCC88',
          ambient: '#DDAA66',
        },
        opacity: 0.85,
        contrast: 1.1,
      },
      {
        id: 'storm',
        name: 'Storm',
        description: 'Dark, dramatic storm clouds',
        colors: {
          primary: '#606060',
          secondary: '#303030',
          highlight: '#808080',
          ambient: '#404040',
        },
        opacity: 0.95,
        contrast: 1.3,
      },
      {
        id: 'ethereal',
        name: 'Ethereal',
        description: 'Mystical, otherworldly clouds',
        colors: {
          primary: '#E0E0FF',
          secondary: '#C0C0E0',
          highlight: '#F0F0FF',
          ambient: '#D8D8F0',
        },
        opacity: 0.7,
        contrast: 0.9,
      },
    ];

    schemes.forEach(scheme => {
      this.colorSchemes.set(scheme.id, scheme);
    });
  }

  /**
   * Initialize built-in style presets
   */
  private initializeBuiltInPresets(): void {
    const presets: CloudStylePreset[] = [
      {
        id: 'realistic',
        name: 'Realistic',
        description: 'Natural, photorealistic cloud appearance',
        colorScheme: 'day',
        settings: {
          density: 0.8,
          animationSpeed: 0.8,
          opacity: 0.85,
          contrast: 1.0,
        },
      },
      {
        id: 'stylized',
        name: 'Stylized',
        description: 'Artistic, game-like cloud style',
        colorScheme: 'day',
        settings: {
          density: 0.6,
          animationSpeed: 1.2,
          opacity: 0.7,
          contrast: 1.3,
        },
      },
      {
        id: 'minimal',
        name: 'Minimal',
        description: 'Clean, simple cloud appearance',
        colorScheme: 'day',
        settings: {
          density: 0.4,
          animationSpeed: 0.5,
          opacity: 0.6,
          contrast: 0.8,
        },
      },
      {
        id: 'dramatic',
        name: 'Dramatic',
        description: 'High contrast, cinematic clouds',
        colorScheme: 'storm',
        settings: {
          density: 0.9,
          animationSpeed: 1.0,
          opacity: 0.95,
          contrast: 1.4,
        },
      },
      {
        id: 'dreamy',
        name: 'Dreamy',
        description: 'Soft, ethereal cloud appearance',
        colorScheme: 'ethereal',
        settings: {
          density: 0.5,
          animationSpeed: 0.6,
          opacity: 0.65,
          contrast: 0.7,
        },
      },
    ];

    presets.forEach(preset => {
      this.stylePresets.set(preset.id, preset);
    });
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const settingsData = await AsyncStorage.getItem(VISUAL_SETTINGS_KEY);
      
      if (settingsData) {
        const savedSettings = JSON.parse(settingsData);
        if (this.validateSettings(savedSettings)) {
          this.currentSettings = { ...this.getDefaultSettings(), ...savedSettings };
        }
      }
      
      // Load custom presets
      await this.loadCustomPresets();
    } catch (error) {
      console.error('Failed to load visual settings:', error);
    }
  }

  /**
   * Save settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(VISUAL_SETTINGS_KEY, JSON.stringify(this.currentSettings));
    } catch (error) {
      console.error('Failed to save visual settings:', error);
    }
  }

  /**
   * Load custom presets from storage
   */
  private async loadCustomPresets(): Promise<void> {
    try {
      const presetsData = await AsyncStorage.getItem('cloud_custom_presets');
      
      if (presetsData) {
        const customPresets: CloudStylePreset[] = JSON.parse(presetsData);
        customPresets.forEach(preset => {
          this.stylePresets.set(preset.id, preset);
        });
      }
    } catch (error) {
      console.error('Failed to load custom presets:', error);
    }
  }

  /**
   * Save custom presets to storage
   */
  private async saveCustomPresets(): Promise<void> {
    try {
      const customPresets = Array.from(this.stylePresets.values())
        .filter(preset => preset.id.startsWith('custom_'));
      
      await AsyncStorage.setItem('cloud_custom_presets', JSON.stringify(customPresets));
    } catch (error) {
      console.error('Failed to save custom presets:', error);
    }
  }

  /**
   * Validate visual settings
   */
  private validateSettings(settings: Partial<VisualCustomizationSettings>): boolean {
    if (!settings || typeof settings !== 'object') return false;
    
    // Validate numeric properties
    const numericProps = ['opacity', 'contrast', 'brightness', 'saturation'];
    for (const prop of numericProps) {
      if (settings[prop as keyof VisualCustomizationSettings] !== undefined) {
        const value = settings[prop as keyof VisualCustomizationSettings] as number;
        if (typeof value !== 'number' || value < 0 || value > 2) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Validate visual property
   */
  private validateVisualProperty<K extends keyof VisualCustomizationSettings>(
    key: K,
    value: VisualCustomizationSettings[K]
  ): boolean {
    switch (key) {
      case 'opacity':
      case 'contrast':
      case 'brightness':
      case 'saturation':
        return typeof value === 'number' && value >= 0 && value <= 2;
      case 'selectedColorScheme':
        return typeof value === 'string' && this.colorSchemes.has(value);
      case 'selectedStylePreset':
        return typeof value === 'string' && this.stylePresets.has(value);
      case 'enableCustomColors':
        return typeof value === 'boolean';
      default:
        return true;
    }
  }

  /**
   * Convert hex color to RGB array
   */
  private hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [1, 1, 1]; // Default to white
    
    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
    ];
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentSettings);
      } catch (error) {
        console.error('Error in visual customization listener:', error);
      }
    });
  }
}