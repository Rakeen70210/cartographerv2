import { getDatabaseService, UserStats, Achievement, ExploredArea } from '../database/services';
import { getAchievementsService } from './achievementsService';

export interface CountryStats {
  country: string;
  countryCode: string;
  areasExplored: number;
  percentage: number;
  firstVisit: string;
  lastVisit: string;
}

export interface RegionStats {
  region: string;
  country: string;
  areasExplored: number;
  percentage: number;
  firstVisit: string;
  lastVisit: string;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  streakStartDate: string | null;
  streakEndDate: string | null;
  isActiveStreak: boolean;
}

export interface DetailedStats extends UserStats {
  areasExploredToday: number;
  areasExploredThisWeek: number;
  areasExploredThisMonth: number;
  averageAccuracy: number;
  firstExplorationDate: string | null;
  lastExplorationDate: string | null;
  explorationDays: number;
  countriesVisited: CountryStats[];
  regionsVisited: RegionStats[];
  streakInfo: StreakInfo;
}

export interface ExplorationProgress {
  totalAreas: number;
  percentage: number;
  streakDays: number;
  longestStreak: number;
  totalDistance: number;
}

export class StatisticsService {
  private dbService = getDatabaseService();
  private achievementsService = getAchievementsService();
  
  // Cache for reverse geocoding results to avoid repeated API calls
  private geocodingCache = new Map<string, { country: string; countryCode: string; region: string }>();

  async getDetailedStats(): Promise<DetailedStats> {
    const userStats = await this.dbService.getUserStats();
    const exploredAreas = await this.dbService.getAllExploredAreas();
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate time-based statistics
    const areasExploredToday = exploredAreas.filter(area => 
      new Date(area.explored_at) >= today
    ).length;

    const areasExploredThisWeek = exploredAreas.filter(area => 
      new Date(area.explored_at) >= weekAgo
    ).length;

    const areasExploredThisMonth = exploredAreas.filter(area => 
      new Date(area.explored_at) >= monthAgo
    ).length;

    // Calculate average accuracy
    const areasWithAccuracy = exploredAreas.filter(area => area.accuracy !== null);
    const averageAccuracy = areasWithAccuracy.length > 0 
      ? areasWithAccuracy.reduce((sum, area) => sum + (area.accuracy || 0), 0) / areasWithAccuracy.length
      : 0;

    // Find first and last exploration dates
    const sortedAreas = exploredAreas.sort((a, b) => 
      new Date(a.explored_at).getTime() - new Date(b.explored_at).getTime()
    );
    
    const firstExplorationDate = sortedAreas.length > 0 ? sortedAreas[0].explored_at : null;
    const lastExplorationDate = sortedAreas.length > 0 ? sortedAreas[sortedAreas.length - 1].explored_at : null;

    // Calculate exploration days (unique days with exploration)
    const uniqueDays = new Set(
      exploredAreas.map(area => 
        new Date(area.explored_at).toDateString()
      )
    );
    const explorationDays = uniqueDays.size;

    // Calculate country and region statistics
    const countriesVisited = await this.calculateCountryStats(exploredAreas);
    const regionsVisited = await this.calculateRegionStats(exploredAreas);
    
    // Calculate streak information
    const streakInfo = await this.calculateStreakInfo(exploredAreas);

    return {
      id: userStats?.id || 1,
      total_areas_explored: userStats?.total_areas_explored || exploredAreas.length,
      total_distance: userStats?.total_distance || 0,
      exploration_percentage: userStats?.exploration_percentage || 0,
      current_streak: streakInfo.currentStreak,
      longest_streak: streakInfo.longestStreak,
      updated_at: userStats?.updated_at || new Date().toISOString(),
      areasExploredToday,
      areasExploredThisWeek,
      areasExploredThisMonth,
      averageAccuracy,
      firstExplorationDate,
      lastExplorationDate,
      explorationDays,
      countriesVisited,
      regionsVisited,
      streakInfo,
    };
  }

  async getExplorationProgress(): Promise<ExplorationProgress> {
    const stats = await this.getDetailedStats();
    
    return {
      totalAreas: stats.total_areas_explored,
      percentage: stats.exploration_percentage,
      streakDays: stats.current_streak,
      longestStreak: stats.longest_streak,
      totalDistance: stats.total_distance,
    };
  }

  async getAchievements(): Promise<Achievement[]> {
    return await this.dbService.getAllAchievements();
  }

  async calculateExplorationPercentage(): Promise<number> {
    const exploredAreas = await this.dbService.getAllExploredAreas();
    
    if (exploredAreas.length === 0) return 0;

    // Enhanced calculation based on geographic distribution and coverage
    const totalCoverage = exploredAreas.reduce((sum, area) => {
      // Convert radius to approximate area in km²
      const areaKm2 = Math.PI * Math.pow(area.radius / 1000, 2);
      return sum + areaKm2;
    }, 0);

    // Calculate geographic bounds to determine exploration scope
    const bounds = this.calculateGeographicBounds(exploredAreas);
    const boundingBoxArea = this.calculateBoundingBoxArea(bounds);
    
    // Use adaptive scaling based on exploration scope
    let maxArea: number;
    if (boundingBoxArea < 10) {
      // Local neighborhood exploration (< 10 km²)
      maxArea = 25;
    } else if (boundingBoxArea < 100) {
      // City-level exploration (< 100 km²)
      maxArea = 200;
    } else if (boundingBoxArea < 1000) {
      // Regional exploration (< 1000 km²)
      maxArea = 1500;
    } else {
      // Large-scale exploration
      maxArea = Math.max(boundingBoxArea * 0.3, 2000);
    }

    // Calculate percentage with diminishing returns for overlapping areas
    const coverage = Math.min(totalCoverage, maxArea);
    const percentage = (coverage / maxArea) * 100;
    
    // Apply bonus for geographic diversity (visiting different regions)
    const diversityBonus = await this.calculateDiversityBonus(exploredAreas);
    const finalPercentage = Math.min(percentage + diversityBonus, 100);
    
    return Math.round(finalPercentage * 100) / 100;
  }

  private calculateGeographicBounds(areas: ExploredArea[]): {
    north: number;
    south: number;
    east: number;
    west: number;
  } {
    if (areas.length === 0) {
      return { north: 0, south: 0, east: 0, west: 0 };
    }

    let north = areas[0].latitude;
    let south = areas[0].latitude;
    let east = areas[0].longitude;
    let west = areas[0].longitude;

    areas.forEach(area => {
      north = Math.max(north, area.latitude);
      south = Math.min(south, area.latitude);
      east = Math.max(east, area.longitude);
      west = Math.min(west, area.longitude);
    });

    return { north, south, east, west };
  }

  private calculateBoundingBoxArea(bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }): number {
    // Calculate approximate area of bounding box in km²
    const latDiff = bounds.north - bounds.south;
    const lngDiff = bounds.east - bounds.west;
    
    // Convert degrees to km (rough approximation)
    const latKm = latDiff * 111.32;
    const lngKm = lngDiff * 111.32 * Math.cos((bounds.north + bounds.south) / 2 * Math.PI / 180);
    
    return latKm * lngKm;
  }

  private async calculateDiversityBonus(areas: ExploredArea[]): Promise<number> {
    // Bonus for visiting different countries/regions
    const countries = await this.calculateCountryStats(areas);
    const regions = await this.calculateRegionStats(areas);
    
    let bonus = 0;
    
    // Country diversity bonus (up to 10%)
    if (countries.length > 1) {
      bonus += Math.min(countries.length * 2, 10);
    }
    
    // Region diversity bonus (up to 5%)
    if (regions.length > 3) {
      bonus += Math.min((regions.length - 3) * 1, 5);
    }
    
    return bonus;
  }

  async updateCalculatedStats(): Promise<void> {
    const explorationPercentage = await this.calculateExplorationPercentage();
    const exploredAreas = await this.dbService.getAllExploredAreas();
    
    // Calculate total distance (improved)
    let totalDistance = 0;
    const sortedAreas = exploredAreas.sort((a, b) => 
      new Date(a.explored_at).getTime() - new Date(b.explored_at).getTime()
    );
    
    for (let i = 1; i < sortedAreas.length; i++) {
      const prev = sortedAreas[i - 1];
      const curr = sortedAreas[i];
      totalDistance += this.calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );
    }

    // Calculate streak information
    const streakInfo = await this.calculateStreakInfo(exploredAreas);

    await this.dbService.updateUserStats({
      total_areas_explored: exploredAreas.length,
      exploration_percentage: explorationPercentage,
      total_distance: totalDistance,
      current_streak: streakInfo.currentStreak,
      longest_streak: streakInfo.longestStreak,
    });

    // Initialize achievements if needed and update progress
    await this.achievementsService.initializeAchievements();
    const stats = await this.getDetailedStats();
    await this.achievementsService.updateAchievementProgress(stats);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula to calculate distance between two points
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Reverse geocoding using a simple coordinate-to-country mapping
  // In production, you'd use a proper geocoding service like Google Maps or Mapbox
  private async reverseGeocode(latitude: number, longitude: number): Promise<{
    country: string;
    countryCode: string;
    region: string;
  }> {
    const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    
    if (this.geocodingCache.has(key)) {
      return this.geocodingCache.get(key)!;
    }

    // Simple coordinate-based country detection
    // This is a basic implementation - in production use a proper geocoding service
    const result = this.getCountryFromCoordinates(latitude, longitude);
    
    this.geocodingCache.set(key, result);
    return result;
  }

  private getCountryFromCoordinates(lat: number, lng: number): {
    country: string;
    countryCode: string;
    region: string;
  } {
    // Basic coordinate-to-country mapping
    // This is simplified - in production, use a proper geocoding service
    
    // North America
    if (lat >= 25 && lat <= 72 && lng >= -168 && lng <= -52) {
      if (lat >= 49 && lng >= -141 && lng <= -52) {
        return { country: 'Canada', countryCode: 'CA', region: this.getCanadianRegion(lat, lng) };
      } else if (lat >= 25 && lat <= 49 && lng >= -125 && lng <= -66) {
        return { country: 'United States', countryCode: 'US', region: this.getUSRegion(lat, lng) };
      } else if (lat >= 14 && lat <= 33 && lng >= -118 && lng <= -86) {
        return { country: 'Mexico', countryCode: 'MX', region: this.getMexicanRegion(lat, lng) };
      }
    }
    
    // Europe
    if (lat >= 35 && lat <= 71 && lng >= -10 && lng <= 40) {
      return { country: this.getEuropeanCountry(lat, lng), countryCode: 'EU', region: this.getEuropeanRegion(lat, lng) };
    }
    
    // Asia
    if (lat >= -10 && lat <= 55 && lng >= 60 && lng <= 180) {
      return { country: this.getAsianCountry(lat, lng), countryCode: 'AS', region: this.getAsianRegion(lat, lng) };
    }
    
    // Default fallback
    return { country: 'Unknown', countryCode: 'XX', region: 'Unknown Region' };
  }

  private getUSRegion(lat: number, lng: number): string {
    if (lat >= 47 && lng >= -125 && lng <= -104) return 'Pacific Northwest';
    if (lat >= 32 && lat <= 42 && lng >= -125 && lng <= -114) return 'California';
    if (lat >= 25 && lat <= 36 && lng >= -106 && lng <= -93) return 'Southwest';
    if (lat >= 36 && lat <= 49 && lng >= -104 && lng <= -90) return 'Midwest';
    if (lat >= 24 && lat <= 39 && lng >= -90 && lng <= -75) return 'Southeast';
    if (lat >= 39 && lat <= 47 && lng >= -80 && lng <= -66) return 'Northeast';
    return 'United States';
  }

  private getCanadianRegion(lat: number, lng: number): string {
    if (lng >= -141 && lng <= -120) return 'Western Canada';
    if (lng >= -120 && lng <= -90) return 'Central Canada';
    if (lng >= -90 && lng <= -52) return 'Eastern Canada';
    return 'Canada';
  }

  private getMexicanRegion(lat: number, lng: number): string {
    if (lat >= 25 && lng >= -118 && lng <= -109) return 'Northern Mexico';
    if (lat >= 19 && lat <= 25 && lng >= -109 && lng <= -96) return 'Central Mexico';
    if (lat >= 14 && lat <= 19 && lng >= -100 && lng <= -86) return 'Southern Mexico';
    return 'Mexico';
  }

  private getEuropeanCountry(lat: number, lng: number): string {
    if (lat >= 54 && lat <= 71 && lng >= 4 && lng <= 31) return 'Scandinavia';
    if (lat >= 47 && lat <= 55 && lng >= -1 && lng <= 15) return 'Western Europe';
    if (lat >= 45 && lat <= 50 && lng >= 15 && lng <= 30) return 'Central Europe';
    if (lat >= 35 && lat <= 47 && lng >= -10 && lng <= 20) return 'Southern Europe';
    return 'Europe';
  }

  private getEuropeanRegion(lat: number, lng: number): string {
    return this.getEuropeanCountry(lat, lng);
  }

  private getAsianCountry(lat: number, lng: number): string {
    if (lat >= 20 && lat <= 55 && lng >= 73 && lng <= 135) return 'East Asia';
    if (lat >= 8 && lat <= 28 && lng >= 68 && lng <= 97) return 'South Asia';
    if (lat >= -10 && lat <= 15 && lng >= 95 && lng <= 141) return 'Southeast Asia';
    return 'Asia';
  }

  private getAsianRegion(lat: number, lng: number): string {
    return this.getAsianCountry(lat, lng);
  }

  private async calculateCountryStats(areas: ExploredArea[]): Promise<CountryStats[]> {
    const countryMap = new Map<string, {
      areas: ExploredArea[];
      country: string;
      countryCode: string;
    }>();

    // Group areas by country
    for (const area of areas) {
      const geocode = await this.reverseGeocode(area.latitude, area.longitude);
      const key = geocode.countryCode;
      
      if (!countryMap.has(key)) {
        countryMap.set(key, {
          areas: [],
          country: geocode.country,
          countryCode: geocode.countryCode,
        });
      }
      
      countryMap.get(key)!.areas.push(area);
    }

    // Calculate statistics for each country
    const countryStats: CountryStats[] = [];
    
    for (const [, data] of countryMap) {
      const sortedAreas = data.areas.sort((a, b) => 
        new Date(a.explored_at).getTime() - new Date(b.explored_at).getTime()
      );
      
      // Calculate coverage percentage within this country
      const totalCoverage = data.areas.reduce((sum, area) => {
        const areaKm2 = Math.PI * Math.pow(area.radius / 1000, 2);
        return sum + areaKm2;
      }, 0);
      
      // Rough estimate for country exploration percentage
      const countrySize = this.estimateCountrySize(data.countryCode);
      const percentage = Math.min((totalCoverage / countrySize) * 100, 100);
      
      countryStats.push({
        country: data.country,
        countryCode: data.countryCode,
        areasExplored: data.areas.length,
        percentage: Math.round(percentage * 100) / 100,
        firstVisit: sortedAreas[0].explored_at,
        lastVisit: sortedAreas[sortedAreas.length - 1].explored_at,
      });
    }

    return countryStats.sort((a, b) => b.areasExplored - a.areasExplored);
  }

  private async calculateRegionStats(areas: ExploredArea[]): Promise<RegionStats[]> {
    const regionMap = new Map<string, {
      areas: ExploredArea[];
      region: string;
      country: string;
    }>();

    // Group areas by region
    for (const area of areas) {
      const geocode = await this.reverseGeocode(area.latitude, area.longitude);
      const key = `${geocode.region}-${geocode.countryCode}`;
      
      if (!regionMap.has(key)) {
        regionMap.set(key, {
          areas: [],
          region: geocode.region,
          country: geocode.country,
        });
      }
      
      regionMap.get(key)!.areas.push(area);
    }

    // Calculate statistics for each region
    const regionStats: RegionStats[] = [];
    
    for (const [, data] of regionMap) {
      const sortedAreas = data.areas.sort((a, b) => 
        new Date(a.explored_at).getTime() - new Date(b.explored_at).getTime()
      );
      
      // Calculate coverage percentage within this region
      const totalCoverage = data.areas.reduce((sum, area) => {
        const areaKm2 = Math.PI * Math.pow(area.radius / 1000, 2);
        return sum + areaKm2;
      }, 0);
      
      // Rough estimate for region exploration percentage
      const regionSize = this.estimateRegionSize(data.region);
      const percentage = Math.min((totalCoverage / regionSize) * 100, 100);
      
      regionStats.push({
        region: data.region,
        country: data.country,
        areasExplored: data.areas.length,
        percentage: Math.round(percentage * 100) / 100,
        firstVisit: sortedAreas[0].explored_at,
        lastVisit: sortedAreas[sortedAreas.length - 1].explored_at,
      });
    }

    return regionStats.sort((a, b) => b.areasExplored - a.areasExplored);
  }

  private estimateCountrySize(countryCode: string): number {
    // Rough estimates in km² for exploration calculation
    const countrySizes: { [key: string]: number } = {
      'US': 9834000,
      'CA': 9985000,
      'MX': 1964000,
      'EU': 4233000, // Average European country
      'AS': 3000000, // Average Asian region
      'XX': 1000000, // Default
    };
    
    return countrySizes[countryCode] || 1000000;
  }

  private estimateRegionSize(region: string): number {
    // Rough estimates in km² for regional exploration
    const regionSizes: { [key: string]: number } = {
      'Pacific Northwest': 540000,
      'California': 424000,
      'Southwest': 560000,
      'Midwest': 2080000,
      'Southeast': 1560000,
      'Northeast': 470000,
      'Western Canada': 2900000,
      'Central Canada': 2700000,
      'Eastern Canada': 1600000,
      'Northern Mexico': 800000,
      'Central Mexico': 600000,
      'Southern Mexico': 400000,
    };
    
    return regionSizes[region] || 500000; // Default region size
  }

  private async calculateStreakInfo(areas: ExploredArea[]): Promise<StreakInfo> {
    if (areas.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        streakStartDate: null,
        streakEndDate: null,
        isActiveStreak: false,
      };
    }

    // Sort areas by date
    const sortedAreas = areas.sort((a, b) => 
      new Date(a.explored_at).getTime() - new Date(b.explored_at).getTime()
    );

    // Group areas by day
    const dayGroups = new Map<string, ExploredArea[]>();
    sortedAreas.forEach(area => {
      const day = new Date(area.explored_at).toDateString();
      if (!dayGroups.has(day)) {
        dayGroups.set(day, []);
      }
      dayGroups.get(day)!.push(area);
    });

    const uniqueDays = Array.from(dayGroups.keys()).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );

    if (uniqueDays.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        streakStartDate: null,
        streakEndDate: null,
        isActiveStreak: false,
      };
    }

    // Calculate streaks
    let currentStreak = 0;
    let longestStreak = 0;
    let currentStreakStart: string | null = null;
    let currentStreakEnd: string | null = null;
    let longestStreakStart: string | null = null;
    let longestStreakEnd: string | null = null;
    
    let tempStreakStart = uniqueDays[0];
    let tempStreakLength = 1;

    for (let i = 1; i < uniqueDays.length; i++) {
      const prevDate = new Date(uniqueDays[i - 1]);
      const currDate = new Date(uniqueDays[i]);
      const dayDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (dayDiff === 1) {
        // Consecutive day
        tempStreakLength++;
      } else {
        // Streak broken
        if (tempStreakLength > longestStreak) {
          longestStreak = tempStreakLength;
          longestStreakStart = tempStreakStart;
          longestStreakEnd = uniqueDays[i - 1];
        }
        
        tempStreakStart = uniqueDays[i];
        tempStreakLength = 1;
      }
    }

    // Check final streak
    if (tempStreakLength > longestStreak) {
      longestStreak = tempStreakLength;
      longestStreakStart = tempStreakStart;
      longestStreakEnd = uniqueDays[uniqueDays.length - 1];
    }

    // Calculate current streak (from the end)
    const today = new Date();
    const lastExplorationDate = new Date(uniqueDays[uniqueDays.length - 1]);
    const daysSinceLastExploration = Math.floor((today.getTime() - lastExplorationDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let isActiveStreak = false;
    
    if (daysSinceLastExploration <= 1) {
      // Current streak is active (explored today or yesterday)
      isActiveStreak = true;
      currentStreakEnd = uniqueDays[uniqueDays.length - 1];
      
      // Count backwards to find current streak length
      for (let i = uniqueDays.length - 1; i >= 0; i--) {
        if (i === 0) {
          currentStreak = uniqueDays.length;
          currentStreakStart = uniqueDays[0];
          break;
        }
        
        const prevDate = new Date(uniqueDays[i - 1]);
        const currDate = new Date(uniqueDays[i]);
        const dayDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dayDiff === 1) {
          currentStreak++;
        } else {
          currentStreak++;
          currentStreakStart = uniqueDays[i];
          break;
        }
      }
    }

    return {
      currentStreak,
      longestStreak,
      streakStartDate: currentStreakStart,
      streakEndDate: currentStreakEnd,
      isActiveStreak,
    };
  }

  async getExplorationHistory(days: number = 30): Promise<{ date: string; areas: number }[]> {
    const exploredAreas = await this.dbService.getAllExploredAreas();
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    // Group areas by date
    const areasByDate: { [key: string]: number } = {};
    
    exploredAreas
      .filter(area => new Date(area.explored_at) >= startDate)
      .forEach(area => {
        const date = new Date(area.explored_at).toDateString();
        areasByDate[date] = (areasByDate[date] || 0) + 1;
      });

    // Create array with all dates in range
    const history: { date: string; areas: number }[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateString = date.toDateString();
      history.push({
        date: dateString,
        areas: areasByDate[dateString] || 0,
      });
    }

    return history;
  }

  async getCountryStatistics(): Promise<CountryStats[]> {
    const exploredAreas = await this.dbService.getAllExploredAreas();
    return await this.calculateCountryStats(exploredAreas);
  }

  async getRegionStatistics(): Promise<RegionStats[]> {
    const exploredAreas = await this.dbService.getAllExploredAreas();
    return await this.calculateRegionStats(exploredAreas);
  }

  async getStreakStatistics(): Promise<StreakInfo> {
    const exploredAreas = await this.dbService.getAllExploredAreas();
    return await this.calculateStreakInfo(exploredAreas);
  }

  // Utility method to clear geocoding cache if needed
  clearGeocodingCache(): void {
    this.geocodingCache.clear();
  }

  // Method to get exploration statistics for a specific time period
  async getExplorationStatsForPeriod(startDate: Date, endDate: Date): Promise<{
    areasExplored: number;
    totalDistance: number;
    uniqueDays: number;
    averageAreasPerDay: number;
  }> {
    const exploredAreas = await this.dbService.getAllExploredAreas();
    
    const filteredAreas = exploredAreas.filter(area => {
      const areaDate = new Date(area.explored_at);
      return areaDate >= startDate && areaDate <= endDate;
    });

    if (filteredAreas.length === 0) {
      return {
        areasExplored: 0,
        totalDistance: 0,
        uniqueDays: 0,
        averageAreasPerDay: 0,
      };
    }

    // Calculate total distance for the period
    const sortedAreas = filteredAreas.sort((a, b) => 
      new Date(a.explored_at).getTime() - new Date(b.explored_at).getTime()
    );
    
    let totalDistance = 0;
    for (let i = 1; i < sortedAreas.length; i++) {
      const prev = sortedAreas[i - 1];
      const curr = sortedAreas[i];
      totalDistance += this.calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );
    }

    // Calculate unique days
    const uniqueDays = new Set(
      filteredAreas.map(area => new Date(area.explored_at).toDateString())
    ).size;

    const averageAreasPerDay = uniqueDays > 0 ? filteredAreas.length / uniqueDays : 0;

    return {
      areasExplored: filteredAreas.length,
      totalDistance: Math.round(totalDistance * 100) / 100,
      uniqueDays,
      averageAreasPerDay: Math.round(averageAreasPerDay * 100) / 100,
    };
  }
}

// Singleton instance
let statisticsService: StatisticsService | null = null;

export const getStatisticsService = (): StatisticsService => {
  if (!statisticsService) {
    statisticsService = new StatisticsService();
  }
  return statisticsService;
};