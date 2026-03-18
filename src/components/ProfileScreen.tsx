import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchProfileStats, refreshStats } from '../store/slices/profileSlice';
import { setMapStyle } from '../store/slices/mapSlice';
import { saveMapStyle } from '../store/persistence';
import { MAP_STYLE_OPTIONS } from '../config/mapbox';
import { MapStyleOption } from '../types/map';
import { cloudFogIntegration, fogSystemCompatibility } from '../services/cloudSystem/integration';
import { BackupManager } from './BackupManager';
import { OfflineManager } from './OfflineManager';
import { CloudSettingsPanel } from './CloudSettingsPanel';
import { cartographerTheme } from './cartographerTheme';
import { useCloudSettings } from '../hooks/useCloudSettings';
import { CloudSettings } from '../types/cloud';

const EXPERIENCE_PRESETS: Array<{
  id: 'battery_saver' | 'balanced' | 'immersive';
  label: string;
  description: string;
  settings: Partial<CloudSettings>;
}> = [
  {
    id: 'battery_saver',
    label: 'Battery Saver',
    description: 'Lighter fog motion and leaner rendering.',
    settings: {
      density: 0.35,
      animationSpeed: 0.35,
      quality: 'low',
      opacity: 0.55,
      contrast: 0.85,
    },
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Recommended everyday feel.',
    settings: {
      density: 0.65,
      animationSpeed: 0.85,
      quality: 'medium',
      opacity: 0.8,
      contrast: 1.0,
    },
  },
  {
    id: 'immersive',
    label: 'Immersive',
    description: 'Denser atmosphere and fuller motion.',
    settings: {
      density: 0.9,
      animationSpeed: 1.15,
      quality: 'high',
      opacity: 0.92,
      contrast: 1.08,
    },
  },
];

const MAP_THEME_PREVIEWS: Record<string, string[]> = {
  streets: ['#6BC0FF', '#163852'],
  outdoors: ['#8CD17D', '#22452A'],
  satellite: ['#E8C07D', '#2A2E35'],
  light: ['#F1F5F8', '#B6C1CC'],
  dark: ['#1D2B39', '#4D6B84'],
};

const inferPreset = (settings: CloudSettings): string => {
  const preset = EXPERIENCE_PRESETS.find((candidate) => (
    candidate.settings.quality === settings.quality &&
    candidate.settings.density === settings.density &&
    candidate.settings.animationSpeed === settings.animationSpeed
  ));

  return preset?.id ?? 'custom';
};

const ProfileScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { stats, progress, achievements, isLoading, error, lastUpdated } = useAppSelector(
    (state) => state.profile
  );
  const { mapStyleId } = useAppSelector((state) => state.map);
  const { settings, updateSettings } = useCloudSettings();

  const [showBackupManager, setShowBackupManager] = useState(false);
  const [showOfflineManager, setShowOfflineManager] = useState(false);
  const [showCloudSettings, setShowCloudSettings] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cloudSystemStatus, setCloudSystemStatus] = useState({
    isActive: false,
    currentSystem: 'traditional' as 'cloud' | 'traditional' | 'both',
    hasError: false,
    errorMessage: '',
    performanceScore: 0,
  });

  useEffect(() => {
    dispatch(fetchProfileStats());
  }, [dispatch]);

  useEffect(() => {
    const updateCloudStatus = () => {
      const integrationStatus = cloudFogIntegration.getStatus();
      const compatibilityStatus = fogSystemCompatibility.getStatus();

      setCloudSystemStatus({
        isActive: integrationStatus.isActive,
        currentSystem: compatibilityStatus.currentSystem,
        hasError: integrationStatus.hasError,
        errorMessage: integrationStatus.errorMessage || '',
        performanceScore: compatibilityStatus.performanceScore,
      });
    };

    updateCloudStatus();
    const interval = setInterval(updateCloudStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    dispatch(refreshStats());
  };

  const handleMapStyleChange = (styleOption: MapStyleOption) => {
    dispatch(setMapStyle({ id: styleOption.id, styleURL: styleOption.styleURL }));
    saveMapStyle({ id: styleOption.id, styleURL: styleOption.styleURL }).catch((saveError) => {
      console.error('Failed to persist map style:', saveError);
    });
  };

  const handlePresetChange = async (presetId: 'battery_saver' | 'balanced' | 'immersive') => {
    const preset = EXPERIENCE_PRESETS.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    try {
      await updateSettings(preset.settings);
    } catch (presetError) {
      console.error('Failed to apply experience preset:', presetError);
    }
  };

  const unlockedAchievements = achievements.filter((achievement) => Boolean(achievement.unlocked_at));
  const recentWins = useMemo(() => {
    const wins: string[] = [];

    if (stats?.current_streak) {
      wins.push(`${stats.current_streak}-day streak active`);
    }
    if (stats?.areasExploredToday) {
      wins.push(`${stats.areasExploredToday} areas revealed today`);
    }
    if (unlockedAchievements.length) {
      wins.push(`${unlockedAchievements.length} achievements unlocked`);
    }

    if (wins.length === 0) {
      wins.push('Your first walk will start the story.');
    }

    return wins.slice(0, 3);
  }, [stats, unlockedAchievements.length]);

  const activePreset = inferPreset(settings);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={cartographerTheme.colors.accent} />
      }
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Me</Text>
        <Text style={styles.heroTitle}>Keep your map alive.</Text>
        <Text style={styles.heroSubtitle}>
          {error
            ? `Profile refresh needs attention: ${error}`
            : `Last synced locally ${lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'just now'}.`}
        </Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{progress?.percentage?.toFixed(1) ?? '0.0'}%</Text>
            <Text style={styles.heroLabel}>Explored</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{stats?.current_streak ?? 0}</Text>
            <Text style={styles.heroLabel}>Current streak</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent wins</Text>
        {recentWins.map((win) => (
          <View key={win} style={styles.winRow}>
            <View style={styles.winBullet} />
            <Text style={styles.winText}>{win}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Experience</Text>
        <View style={styles.presetGrid}>
          {EXPERIENCE_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.id}
              style={[
                styles.presetCard,
                activePreset === preset.id && styles.presetCardActive,
              ]}
              onPress={() => handlePresetChange(preset.id)}
            >
              <Text style={styles.presetTitle}>{preset.label}</Text>
              <Text style={styles.presetDescription}>{preset.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Map themes</Text>
        <View style={styles.themeGrid}>
          {MAP_STYLE_OPTIONS.map((styleOption) => {
            const preview = MAP_THEME_PREVIEWS[styleOption.id] || ['#9BB3C6', '#2A3D4D'];

            return (
              <TouchableOpacity
                key={styleOption.id}
                style={[
                  styles.themeCard,
                  mapStyleId === styleOption.id && styles.themeCardActive,
                ]}
                onPress={() => handleMapStyleChange(styleOption)}
                accessibilityLabel={`Set map style to ${styleOption.label}`}
              >
                <View style={styles.themePreview}>
                  <View style={[styles.themePreviewTop, { backgroundColor: preview[0] }]} />
                  <View style={[styles.themePreviewBottom, { backgroundColor: preview[1] }]} />
                </View>
                <Text style={styles.themeLabel}>{styleOption.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Utilities</Text>
        <TouchableOpacity style={styles.utilityCard} onPress={() => setShowOfflineManager(true)}>
          <Text style={styles.utilityTitle}>Offline maps</Text>
          <Text style={styles.utilityDescription}>Download explored territory and manage local coverage.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.utilityCard} onPress={() => setShowBackupManager(true)}>
          <Text style={styles.utilityTitle}>Data safety</Text>
          <Text style={styles.utilityDescription}>Export, import, and recover your local map history.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.utilityCard} onPress={() => setShowAdvanced((current) => !current)}>
          <Text style={styles.utilityTitle}>Advanced</Text>
          <Text style={styles.utilityDescription}>
            {showAdvanced ? 'Hide diagnostics and manual controls.' : 'Open performance, cloud, and diagnostics controls.'}
          </Text>
        </TouchableOpacity>
      </View>

      {showAdvanced && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced controls</Text>
          <View style={styles.advancedCard}>
            <Text style={styles.advancedTitle}>Cloud system</Text>
            <Text style={styles.advancedText}>
              {cloudSystemStatus.isActive ? 'Active' : 'Inactive'} · {cloudSystemStatus.currentSystem} · {cloudSystemStatus.performanceScore.toFixed(0)} FPS
            </Text>
            {cloudSystemStatus.hasError ? (
              <Text style={styles.advancedWarning}>{cloudSystemStatus.errorMessage}</Text>
            ) : null}
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowCloudSettings(true)}>
              <Text style={styles.secondaryButtonText}>Open detailed controls</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <CloudSettingsPanel
        visible={showCloudSettings}
        onClose={() => setShowCloudSettings(false)}
      />
      <OfflineManager
        visible={showOfflineManager}
        onClose={() => setShowOfflineManager(false)}
      />
      <BackupManager
        visible={showBackupManager}
        onClose={() => setShowBackupManager(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cartographerTheme.colors.background,
  },
  content: {
    padding: cartographerTheme.spacing.lg,
    paddingBottom: cartographerTheme.spacing.xxl,
    gap: cartographerTheme.spacing.lg,
  },
  heroCard: {
    backgroundColor: cartographerTheme.colors.surface,
    borderWidth: 1,
    borderColor: cartographerTheme.colors.border,
    borderRadius: cartographerTheme.radius.lg,
    padding: cartographerTheme.spacing.xl,
  },
  eyebrow: {
    color: cartographerTheme.colors.accentWarm,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: cartographerTheme.spacing.sm,
  },
  heroTitle: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 30,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: cartographerTheme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: cartographerTheme.spacing.sm,
  },
  heroStats: {
    flexDirection: 'row',
    gap: cartographerTheme.spacing.md,
    marginTop: cartographerTheme.spacing.xl,
  },
  heroStat: {
    flex: 1,
    backgroundColor: cartographerTheme.colors.pill,
    borderRadius: cartographerTheme.radius.md,
    padding: cartographerTheme.spacing.md,
  },
  heroValue: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  heroLabel: {
    color: cartographerTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: cartographerTheme.spacing.xs,
  },
  section: {
    gap: cartographerTheme.spacing.sm,
  },
  sectionTitle: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  winRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cartographerTheme.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: cartographerTheme.colors.border,
    borderRadius: cartographerTheme.radius.md,
    padding: cartographerTheme.spacing.md,
  },
  winBullet: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: cartographerTheme.colors.accentSuccess,
    marginRight: cartographerTheme.spacing.md,
  },
  winText: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 15,
    flex: 1,
  },
  presetGrid: {
    gap: cartographerTheme.spacing.sm,
  },
  presetCard: {
    backgroundColor: cartographerTheme.colors.surface,
    borderWidth: 1,
    borderColor: cartographerTheme.colors.border,
    borderRadius: cartographerTheme.radius.md,
    padding: cartographerTheme.spacing.md,
  },
  presetCardActive: {
    borderColor: cartographerTheme.colors.accent,
  },
  presetTitle: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  presetDescription: {
    color: cartographerTheme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: cartographerTheme.spacing.xs,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: cartographerTheme.spacing.sm,
  },
  themeCard: {
    width: '48%',
    backgroundColor: cartographerTheme.colors.surface,
    borderWidth: 1,
    borderColor: cartographerTheme.colors.border,
    borderRadius: cartographerTheme.radius.md,
    padding: cartographerTheme.spacing.md,
  },
  themeCardActive: {
    borderColor: cartographerTheme.colors.accent,
  },
  themePreview: {
    height: 72,
    borderRadius: cartographerTheme.radius.sm,
    overflow: 'hidden',
    marginBottom: cartographerTheme.spacing.sm,
  },
  themePreviewTop: {
    flex: 1,
  },
  themePreviewBottom: {
    flex: 1,
  },
  themeLabel: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  utilityCard: {
    backgroundColor: cartographerTheme.colors.surface,
    borderWidth: 1,
    borderColor: cartographerTheme.colors.border,
    borderRadius: cartographerTheme.radius.md,
    padding: cartographerTheme.spacing.md,
  },
  utilityTitle: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  utilityDescription: {
    color: cartographerTheme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: cartographerTheme.spacing.xs,
  },
  advancedCard: {
    backgroundColor: cartographerTheme.colors.surface,
    borderWidth: 1,
    borderColor: cartographerTheme.colors.border,
    borderRadius: cartographerTheme.radius.md,
    padding: cartographerTheme.spacing.md,
  },
  advancedTitle: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  advancedText: {
    color: cartographerTheme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: cartographerTheme.spacing.xs,
  },
  advancedWarning: {
    color: cartographerTheme.colors.accentDanger,
    fontSize: 13,
    lineHeight: 18,
    marginTop: cartographerTheme.spacing.sm,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: cartographerTheme.colors.pill,
    borderRadius: cartographerTheme.radius.pill,
    paddingHorizontal: cartographerTheme.spacing.md,
    paddingVertical: cartographerTheme.spacing.sm,
    marginTop: cartographerTheme.spacing.md,
  },
  secondaryButtonText: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});

export default ProfileScreen;
