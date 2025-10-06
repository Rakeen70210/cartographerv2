import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapScreen from './MapScreen';
import ProfileScreen from './ProfileScreen';

type TabType = 'map' | 'profile';

interface TabButtonProps {
  title: string;
  icon: string;
  isActive: boolean;
  onPress: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ title, icon, isActive, onPress }) => (
  <TouchableOpacity
    style={[styles.tabButton, isActive && styles.tabButtonActive]}
    onPress={onPress}
  >
    <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
      {icon}
    </Text>
    <Text style={[styles.tabTitle, isActive && styles.tabTitleActive]}>
      {title}
    </Text>
  </TouchableOpacity>
);

const TabNavigation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('map');

  const renderScreen = () => {
    switch (activeTab) {
      case 'map':
        return <MapScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <MapScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Screen Content */}
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TabButton
          title="Map"
          icon="🗺️"
          isActive={activeTab === 'map'}
          onPress={() => setActiveTab('map')}
        />
        <TabButton
          title="Profile"
          icon="👤"
          isActive={activeTab === 'profile'}
          onPress={() => setActiveTab('profile')}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tabButtonActive: {
    backgroundColor: 'transparent',
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 4,
    opacity: 0.6,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabTitle: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  tabTitleActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default TabNavigation;