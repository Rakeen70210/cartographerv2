import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapScreen from './MapScreen';
import ProgressScreen from './ProgressScreen';
import ProfileScreen from './ProfileScreen';
import { cartographerTheme } from './cartographerTheme';
import { appExperienceService } from '../services/appExperienceService';

type TabType = 'explore' | 'progress' | 'me';

interface TabButtonProps {
  title: string;
  isActive: boolean;
  onPress: () => void;
  icon: React.ReactNode;
}

const ExploreIcon = ({ active }: { active: boolean }) => (
  <View style={styles.iconFrame}>
    <View style={[styles.exploreIconDiamond, active && styles.iconActiveFill]} />
  </View>
);

const ProgressIcon = ({ active }: { active: boolean }) => (
  <View style={styles.iconFrame}>
    <View style={styles.progressIconRow}>
      <View style={[styles.progressBar, { height: 8 }, active && styles.iconActiveFill]} />
      <View style={[styles.progressBar, { height: 12 }, active && styles.iconActiveFill]} />
      <View style={[styles.progressBar, { height: 16 }, active && styles.iconActiveFill]} />
    </View>
  </View>
);

const MeIcon = ({ active }: { active: boolean }) => (
  <View style={styles.iconFrame}>
    <View style={[styles.meIconHead, active && styles.iconActiveFill]} />
    <View style={[styles.meIconBody, active && styles.iconActiveFill]} />
  </View>
);

const TabButton: React.FC<TabButtonProps> = ({ title, isActive, onPress, icon }) => (
  <TouchableOpacity
    style={[styles.tabButton, isActive && styles.tabButtonActive]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: isActive }}
  >
    <View style={styles.iconSlot}>{icon}</View>
    <Text style={[styles.tabTitle, isActive && styles.tabTitleActive]}>
      {title}
    </Text>
  </TouchableOpacity>
);

const TabNavigation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('explore');

  useEffect(() => {
    appExperienceService.saveBootstrapSnapshot({
      activeTab,
      updatedAt: Date.now(),
    }).catch(() => {});
  }, [activeTab]);

  const renderScreen = () => {
    switch (activeTab) {
      case 'explore':
        return <MapScreen />;
      case 'progress':
        return <ProgressScreen />;
      case 'me':
        return <ProfileScreen />;
      default:
        return <MapScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>

      <View style={styles.tabBar}>
        <TabButton
          title="Explore"
          icon={<ExploreIcon active={activeTab === 'explore'} />}
          isActive={activeTab === 'explore'}
          onPress={() => setActiveTab('explore')}
        />
        <TabButton
          title="Progress"
          icon={<ProgressIcon active={activeTab === 'progress'} />}
          isActive={activeTab === 'progress'}
          onPress={() => setActiveTab('progress')}
        />
        <TabButton
          title="Me"
          icon={<MeIcon active={activeTab === 'me'} />}
          isActive={activeTab === 'me'}
          onPress={() => setActiveTab('me')}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cartographerTheme.colors.background,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: cartographerTheme.colors.backgroundElevated,
    borderTopWidth: 1,
    borderTopColor: cartographerTheme.colors.border,
    paddingHorizontal: cartographerTheme.spacing.sm,
    paddingTop: cartographerTheme.spacing.sm,
    paddingBottom: cartographerTheme.spacing.sm,
    gap: cartographerTheme.spacing.sm,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: cartographerTheme.spacing.sm,
    borderRadius: cartographerTheme.radius.md,
    backgroundColor: 'transparent',
  },
  tabButtonActive: {
    backgroundColor: cartographerTheme.colors.surface,
  },
  iconSlot: {
    marginBottom: cartographerTheme.spacing.xs,
  },
  tabTitle: {
    color: cartographerTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTitleActive: {
    color: cartographerTheme.colors.textPrimary,
  },
  iconFrame: {
    width: 24,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActiveFill: {
    backgroundColor: cartographerTheme.colors.accent,
  },
  exploreIconDiamond: {
    width: 12,
    height: 12,
    borderWidth: 2,
    borderColor: cartographerTheme.colors.accent,
    transform: [{ rotate: '45deg' }],
  },
  progressIconRow: {
    width: 20,
    height: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  progressBar: {
    width: 4,
    borderRadius: cartographerTheme.radius.pill,
    backgroundColor: cartographerTheme.colors.accentMuted,
  },
  meIconHead: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: cartographerTheme.colors.accentMuted,
    marginBottom: 2,
  },
  meIconBody: {
    width: 14,
    height: 7,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    backgroundColor: cartographerTheme.colors.accentMuted,
  },
});

export default TabNavigation;
