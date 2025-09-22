import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchProfileStats, refreshStats } from '../store/slices/profileSlice';
import { cloudFogIntegration, fogSystemCompatibility } from '../services/cloudSystem/integration';
import { BackupManager } from './BackupManager';
import { OfflineManager } from './OfflineManager';
import CloudSettingsPanel from './CloudSettingsPanel';

const { width } = Dimensions.get('window');

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, color = '#007AFF' }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
  </View>
);

interface ProgressBarProps {
  progress: number;
  color?: string;
  height?: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  color = '#007AFF', 
  height = 8 
}) => (
  <View style={[styles.progressBarContainer, { height }]}>
    <View 
      style={[
        styles.progressBar, 
        { 
          width: `${Math.min(progress, 100)}%`, 
          backgroundColor: color,
          height 
        }
      ]} 
    />
  </View>
);

interface AchievementItemProps {
  achievement: {
    id?: number;
    type: string;
    name: string;
    description?: string;
    progress: number;
    unlocked_at?: string;
  };
}

const AchievementItem: React.FC<AchievementItemProps> = ({ achievement }) => {
  const isUnlocked = !!achievement.unlocked_at;
  
  return (
    <View style={[styles.achievementItem, isUnlocked && styles.achievementUnlocked]}>
      <View style={styles.achievementIcon}>
        <Text style={styles.achievementEmoji}>
          {isUnlocked ? '🏆' : '🔒'}
        </Text>
      </View>
      <View style={styles.achievementContent}>
        <Text style={[styles.achievementName, isUnlocked && styles.achievementNameUnlocked]}>
          {achievement.name}
        </Text>
        {achievement.description && (
          <Text style={styles.achievementDescription}>
            {achievement.description}
          </Text>
        )}
        <ProgressBar 
          progress={achievement.progress} 
          color={isUnlocked ? '#34C759' : '#8E8E93'} 
          height={4}
        />
        <Text style={styles.achievementProgress}>
          {Math.round(achievement.progress)}% Complete
        </Text>
      </View>
    </View>
  );
};

const ProfileScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { stats, progress, achievements, isLoading, error, lastUpdated } = useAppSelector(
    (state) => state.profile
  );
  const [showBackupManager, setShowBackupManager] = useState(false);
  const [showOfflineManager, setShowOfflineManager] = useState(false);
  const [showCloudSettings, setShowCloudSettings] = useState(false);
  const [cloudSystemStatus, setCloudSystemStatus] = useState({
    isActive: false,
    currentSystem: 'traditional' as 'cloud' | 'traditional' | 'both',
    hasError: false,
    errorMessage: '',
    performanceScore: 0
  });

  useEffect(() => {
    // Fetch profile data on component mount
    dispatch(fetchProfileStats());
  }, [dispatch]);

  // Monitor cloud system status
  useEffect(() => {
    const updateCloudStatus = () => {
      const integrationStatus = cloudFogIntegration.getStatus();
      const compatibilityStatus = fogSystemCompatibility.getStatus();
      
      setCloudSystemStatus({
        isActive: integrationStatus.isActive,
        currentSystem: compatibilityStatus.currentSystem,
        hasError: integrationStatus.hasError,
        errorMessage: integrationStatus.errorMessage || '',
        performanceScore: compatibilityStatus.performanceScore
      });
    };

    updateCloudStatus();
    const interval = setInterval(updateCloudStatus, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    dispatch(refreshStats());
  };

  const formatDistance = (distance: number): string => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading profile: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Explorer Profile</Text>
          <Text style={styles.headerSubtitle}>
            Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never'}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowCloudSettings(true)}
          >
            <Text style={styles.headerButtonText}>Cloud</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowOfflineManager(true)}
          >
            <Text style={styles.headerButtonText}>Offline</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowBackupManager(true)}
          >
            <Text style={styles.headerButtonText}>Backup</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Stats */}
      {progress && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exploration Progress</Text>
          <View style={styles.progressSection}>
            <Text style={styles.progressPercentage}>
              {progress.percentage.toFixed(1)}%
            </Text>
            <Text style={styles.progressLabel}>Areas Explored</Text>
            <ProgressBar progress={progress.percentage} height={12} />
          </View>
        </View>
      )}

      {/* Cloud System Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cloud System</Text>
        <View style={styles.cloudStatusContainer}>
          <View style={styles.cloudStatusRow}>
            <Text style={styles.cloudStatusLabel}>Status</Text>
            <View style={styles.cloudStatusIndicator}>
              <View style={[
                styles.cloudStatusDot,
                { backgroundColor: cloudSystemStatus.isActive ? '#34C759' : '#FF3B30' }
              ]} />
              <Text style={styles.cloudStatusText}>
                {cloudSystemStatus.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
          
          <View style={styles.cloudStatusRow}>
            <Text style={styles.cloudStatusLabel}>Current System</Text>
            <Text style={styles.cloudStatusValue}>
              {cloudSystemStatus.currentSystem.charAt(0).toUpperCase() + cloudSystemStatus.currentSystem.slice(1)}
            </Text>
          </View>
          
          <View style={styles.cloudStatusRow}>
            <Text style={styles.cloudStatusLabel}>Performance</Text>
            <Text style={styles.cloudStatusValue}>
              {cloudSystemStatus.performanceScore.toFixed(0)} FPS
            </Text>
          </View>
          
          {cloudSystemStatus.hasError && (
            <View style={styles.cloudErrorContainer}>
              <Text style={styles.cloudErrorText}>
                ⚠️ {cloudSystemStatus.errorMessage}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Quick Stats Grid */}
      {stats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Areas"
              value={stats.total_areas_explored}
              color="#007AFF"
            />
            <StatCard
              title="Distance Traveled"
              value={formatDistance(stats.total_distance)}
              color="#34C759"
            />
            <StatCard
              title="Current Streak"
              value={stats.current_streak}
              subtitle="days"
              color="#FF9500"
            />
            <StatCard
              title="Longest Streak"
              value={stats.longest_streak}
              subtitle="days"
              color="#FF3B30"
            />
            <StatCard
              title="Today"
              value={stats.areasExploredToday}
              subtitle="areas"
              color="#5856D6"
            />
            <StatCard
              title="This Week"
              value={stats.areasExploredThisWeek}
              subtitle="areas"
              color="#AF52DE"
            />
          </View>
        </View>
      )}

      {/* Detailed Stats */}
      {stats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>First Exploration</Text>
              <Text style={styles.detailValue}>
                {formatDate(stats.firstExplorationDate)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last Exploration</Text>
              <Text style={styles.detailValue}>
                {formatDate(stats.lastExplorationDate)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Active Days</Text>
              <Text style={styles.detailValue}>{stats.explorationDays}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Average Accuracy</Text>
              <Text style={styles.detailValue}>
                {stats.averageAccuracy.toFixed(1)}m
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Achievements */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        {achievements.length > 0 ? (
          <View style={styles.achievementsContainer}>
            {achievements.map((achievement, index) => (
              <AchievementItem key={achievement.id || index} achievement={achievement} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No achievements yet. Start exploring to unlock them!
            </Text>
          </View>
        )}
      </View>

      {/* Backup Manager Modal */}
      <BackupManager 
        visible={showBackupManager}
        onClose={() => setShowBackupManager(false)}
      />

      {/* Cloud Settings Panel */}
      <CloudSettingsPanel 
        visible={showCloudSettings}
        onClose={() => setShowCloudSettings(false)}
      />

      {/* Offline Manager Modal */}
      <OfflineManager 
        visible={showOfflineManager}
        onClose={() => setShowOfflineManager(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  progressSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  progressPercentage: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  progressLabel: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: (width - 60) / 2,
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  statTitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
  },
  detailsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  detailLabel: {
    fontSize: 16,
    color: '#000000',
  },
  detailValue: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  progressBarContainer: {
    width: '100%',
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    borderRadius: 4,
  },
  achievementsContainer: {
    gap: 12,
  },
  achievementItem: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  achievementUnlocked: {
    backgroundColor: '#E8F5E8',
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  achievementEmoji: {
    fontSize: 20,
  },
  achievementContent: {
    flex: 1,
  },
  achievementName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 4,
  },
  achievementNameUnlocked: {
    color: '#000000',
  },
  achievementDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  achievementProgress: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  headerButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cloudStatusContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  cloudStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  cloudStatusLabel: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  cloudStatusValue: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
  cloudStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cloudStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cloudStatusText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
  cloudErrorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  cloudErrorText: {
    fontSize: 14,
    color: '#FF3B30',
  },
});

export default ProfileScreen;