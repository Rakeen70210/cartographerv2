import React, { useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchProfileStats, refreshStats } from '../store/slices/profileSlice';
import { cartographerTheme } from './cartographerTheme';

const ProgressScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { stats, progress, achievements, isLoading, lastUpdated } = useAppSelector(
    (state) => state.profile
  );

  useEffect(() => {
    if (!lastUpdated) {
      dispatch(fetchProfileStats());
    }
  }, [dispatch, lastUpdated]);

  const handleRefresh = () => {
    dispatch(refreshStats());
  };

  const recentWins = [
    stats?.current_streak
      ? `${stats.current_streak}-day streak still alive`
      : 'Start a streak with a walk today',
    stats?.areasExploredToday
      ? `${stats.areasExploredToday} areas uncovered today`
      : 'Your next discovery is still waiting',
    stats?.countriesVisited?.length
      ? `${stats.countriesVisited.length} regions of the world touched`
      : 'Your world map is still fresh',
  ];

  const highlightedAchievements = achievements.slice(0, 4);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={cartographerTheme.colors.accent} />
      }
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Progress</Text>
        <Text style={styles.heroTitle}>Your map is becoming recognizable.</Text>
        <Text style={styles.heroSubtitle}>
          Return often to keep the streak alive and push the frontier out another block.
        </Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{progress?.percentage?.toFixed(1) ?? '0.0'}%</Text>
            <Text style={styles.heroLabel}>Explored</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{stats?.current_streak ?? 0}</Text>
            <Text style={styles.heroLabel}>Day streak</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{stats?.areasExploredToday ?? 0}</Text>
          <Text style={styles.metricLabel}>Revealed today</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{progress?.totalAreas ?? 0}</Text>
          <Text style={styles.metricLabel}>Areas logged</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{stats?.longest_streak ?? 0}</Text>
          <Text style={styles.metricLabel}>Best streak</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent wins</Text>
        {recentWins.map((win) => (
          <View key={win} style={styles.listCard}>
            <View style={styles.listBullet} />
            <Text style={styles.listText}>{win}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Collection</Text>
        {highlightedAchievements.length > 0 ? (
          highlightedAchievements.map((achievement) => {
            const unlocked = Boolean(achievement.unlocked_at);

            return (
              <View key={achievement.id ?? achievement.name} style={styles.achievementCard}>
                <View style={[styles.badge, unlocked ? styles.badgeUnlocked : styles.badgeLocked]}>
                  <Text style={styles.badgeText}>{unlocked ? 'Unlocked' : `${Math.round(achievement.progress)}%`}</Text>
                </View>
                <Text style={styles.achievementTitle}>{achievement.name}</Text>
                <Text style={styles.achievementDescription}>
                  {achievement.description || 'Keep exploring to reveal this milestone.'}
                </Text>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No trophies yet</Text>
            <Text style={styles.emptyText}>Your first walk will start filling this shelf.</Text>
          </View>
        )}
      </View>
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
    borderRadius: cartographerTheme.radius.lg,
    borderWidth: 1,
    borderColor: cartographerTheme.colors.border,
    padding: cartographerTheme.spacing.xl,
  },
  eyebrow: {
    color: cartographerTheme.colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: cartographerTheme.spacing.sm,
  },
  heroTitle: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
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
    fontSize: 26,
    fontWeight: '700',
  },
  heroLabel: {
    color: cartographerTheme.colors.textSecondary,
    fontSize: 13,
    marginTop: cartographerTheme.spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: cartographerTheme.spacing.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: cartographerTheme.colors.surfaceSoft,
    borderRadius: cartographerTheme.radius.md,
    padding: cartographerTheme.spacing.md,
    borderWidth: 1,
    borderColor: cartographerTheme.colors.border,
  },
  metricValue: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  metricLabel: {
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
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cartographerTheme.colors.surface,
    borderRadius: cartographerTheme.radius.md,
    borderWidth: 1,
    borderColor: cartographerTheme.colors.border,
    padding: cartographerTheme.spacing.md,
  },
  listBullet: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: cartographerTheme.colors.accentWarm,
    marginRight: cartographerTheme.spacing.md,
  },
  listText: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 15,
    flex: 1,
  },
  achievementCard: {
    backgroundColor: cartographerTheme.colors.surface,
    borderRadius: cartographerTheme.radius.md,
    borderWidth: 1,
    borderColor: cartographerTheme.colors.border,
    padding: cartographerTheme.spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: cartographerTheme.radius.pill,
    paddingHorizontal: cartographerTheme.spacing.sm,
    paddingVertical: cartographerTheme.spacing.xs,
    marginBottom: cartographerTheme.spacing.sm,
  },
  badgeUnlocked: {
    backgroundColor: 'rgba(132, 241, 186, 0.18)',
  },
  badgeLocked: {
    backgroundColor: 'rgba(246, 201, 108, 0.18)',
  },
  badgeText: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  achievementTitle: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  achievementDescription: {
    color: cartographerTheme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: cartographerTheme.spacing.xs,
  },
  emptyCard: {
    backgroundColor: cartographerTheme.colors.surface,
    borderRadius: cartographerTheme.radius.md,
    borderWidth: 1,
    borderColor: cartographerTheme.colors.border,
    padding: cartographerTheme.spacing.xl,
  },
  emptyTitle: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    color: cartographerTheme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: cartographerTheme.spacing.xs,
  },
});

export default ProgressScreen;
