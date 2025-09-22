import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Animated, View, StyleSheet, Dimensions, Platform } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { FogClearingAnimation, ParticleAnimation } from '../services/fogAnimationService';

interface FogParticlesProps {
  animations: FogClearingAnimation[];
  visible: boolean;
  performanceMode?: boolean;
  maxParticles?: number;
  mapRef?: React.RefObject<Mapbox.MapView>;
}

interface ParticleProps {
  particle: ParticleAnimation;
  performanceMode: boolean;
  onParticleComplete?: (particleId: string) => void;
}

interface ParticleLifecycle {
  id: string;
  startTime: number;
  duration: number;
  isActive: boolean;
  cleanupTimer?: NodeJS.Timeout;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ParticleComponent: React.FC<ParticleProps> = ({ 
  particle, 
  performanceMode,
  onParticleComplete 
}) => {
  const mountedRef = useRef(true);
  const animationCompleteRef = useRef(false);

  useEffect(() => {
    // Listen for animation completion
    const checkCompletion = () => {
      if (!mountedRef.current || animationCompleteRef.current) return;

      // Check if all animations have completed
      const positionListener = particle.position.addListener(({ x, y }) => {
        // Position animation completed when it stops changing significantly
      });

      const opacityListener = particle.opacity.addListener(({ value }) => {
        if (value <= 0.01 && !animationCompleteRef.current) {
          animationCompleteRef.current = true;
          onParticleComplete?.(particle.id);
        }
      });

      return () => {
        particle.position.removeListener(positionListener);
        particle.opacity.removeListener(opacityListener);
      };
    };

    const cleanup = checkCompletion();

    return () => {
      mountedRef.current = false;
      cleanup?.();
    };
  }, [particle, onParticleComplete]);

  // Optimize particle rendering based on performance mode
  const particleStyle = useMemo(() => {
    const baseStyle = [
      styles.particle,
      performanceMode && styles.particlePerformance,
      {
        transform: [
          {
            translateX: particle.position.x,
          },
          {
            translateY: particle.position.y,
          },
          {
            scale: particle.scale,
          },
          {
            rotate: particle.rotation.interpolate({
              inputRange: [0, 360],
              outputRange: ['0deg', '360deg'],
            }),
          },
        ],
        opacity: particle.opacity,
      },
    ];

    return baseStyle;
  }, [particle, performanceMode]);

  const particleInnerStyle = useMemo(() => [
    styles.particleInner,
    performanceMode && styles.particleInnerPerformance,
  ], [performanceMode]);

  return (
    <Animated.View style={particleStyle}>
      <View style={particleInnerStyle} />
      {!performanceMode && (
        <Animated.View 
          style={[
            styles.particleGlow,
            {
              opacity: particle.opacity.interpolate({
                inputRange: [0, 0.8],
                outputRange: [0, 0.3],
                extrapolate: 'clamp',
              }),
            }
          ]} 
        />
      )}
    </Animated.View>
  );
};

const FogParticles: React.FC<FogParticlesProps> = ({ 
  animations, 
  visible, 
  performanceMode = false,
  maxParticles = 100,
  mapRef 
}) => {
  const [renderableParticles, setRenderableParticles] = useState<ParticleAnimation[]>([]);
  const [particleLifecycles, setParticleLifecycles] = useState<Map<string, ParticleLifecycle>>(new Map());
  const cleanupTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const frameCountRef = useRef(0);
  const lastOptimizationRef = useRef(Date.now());

  // Particle lifecycle management
  const handleParticleComplete = useCallback((particleId: string) => {
    setParticleLifecycles(prev => {
      const existing = prev.get(particleId);
      if (existing && existing.isActive) {
        const updated = new Map(prev);
        existing.isActive = false;
        // Schedule cleanup after a short delay to allow animation to finish
        existing.cleanupTimer = setTimeout(() => {
          setParticleLifecycles(current => {
            const newMap = new Map(current);
            newMap.delete(particleId);
            return newMap;
          });
        }, 500);
        updated.set(particleId, existing);
        return updated;
      }
      return prev;
    });
  }, []); // Remove particleLifecycles dependency

  // Optimize particle count based on performance
  const optimizeParticleCount = useCallback((particles: ParticleAnimation[]) => {
    const now = Date.now();
    frameCountRef.current++;

    // Perform optimization check every 60 frames or 2 seconds
    if (frameCountRef.current % 60 === 0 || now - lastOptimizationRef.current > 2000) {
      lastOptimizationRef.current = now;
      
      let optimizedParticles = [...particles];
      
      if (performanceMode) {
        // Aggressive optimization: keep only 30% of particles
        const keepCount = Math.max(1, Math.floor(particles.length * 0.3));
        optimizedParticles = particles.slice(0, keepCount);
      } else if (particles.length > maxParticles) {
        // Standard optimization: respect maxParticles limit
        optimizedParticles = particles.slice(0, maxParticles);
      }

      // Skip edge filtering for now to avoid accessing private animated value properties
      // This optimization can be added later with proper animated value tracking

      return optimizedParticles;
    }

    return particles;
  }, [performanceMode, maxParticles, mapRef]);

  // Update renderable particles when animations change
  useEffect(() => {
    if (!visible) {
      setRenderableParticles([]);
      setParticleLifecycles(new Map());
      // Clear all cleanup timers
      cleanupTimersRef.current.forEach(timer => clearTimeout(timer));
      cleanupTimersRef.current.clear();
      return;
    }

    // Collect all particles from active animations
    const allParticles: ParticleAnimation[] = [];
    const newLifecycles = new Map<string, ParticleLifecycle>();

    animations.forEach(animation => {
      animation.particleAnimations.forEach(particle => {
        allParticles.push(particle);
        
        // Track particle lifecycle - only add new ones
        newLifecycles.set(particle.id, {
          id: particle.id,
          startTime: Date.now(),
          duration: 1500, // Default particle lifetime
          isActive: true,
        });
      });
    });

    // Update lifecycles only for new particles
    setParticleLifecycles(prev => {
      const updated = new Map(prev);
      let hasNewParticles = false;
      
      newLifecycles.forEach((lifecycle, id) => {
        if (!updated.has(id)) {
          updated.set(id, lifecycle);
          hasNewParticles = true;
        }
      });
      
      // Only return new map if there are actually new particles
      return hasNewParticles ? updated : prev;
    });

    // Optimize and set renderable particles
    const optimizedParticles = optimizeParticleCount(allParticles);
    setRenderableParticles(optimizedParticles);
  }, [animations, visible, optimizeParticleCount]); // Removed particleLifecycles dependency

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Clear all cleanup timers on unmount
      cleanupTimersRef.current.forEach(timer => clearTimeout(timer));
      cleanupTimersRef.current.clear();
    };
  }, []); // Empty dependency array for cleanup on unmount only

  // Performance monitoring
  useEffect(() => {
    if (!visible || renderableParticles.length === 0) return;

    const monitoringInterval = setInterval(() => {
      // Get current lifecycles without causing re-render
      setParticleLifecycles(prev => {
        const activeParticleCount = Array.from(prev.values())
          .filter(lifecycle => lifecycle.isActive).length;
        
        // Log performance metrics in development
        if (__DEV__) {
          console.log(`FogParticles: ${activeParticleCount} active particles, ${renderableParticles.length} rendered`);
        }
        
        // Auto-cleanup stale particles
        const now = Date.now();
        const staleThreshold = 5000; // 5 seconds
        
        const updated = new Map(prev);
        let hasChanges = false;
        
        prev.forEach((lifecycle, id) => {
          if (!lifecycle.isActive && now - lifecycle.startTime > staleThreshold) {
            if (lifecycle.cleanupTimer) {
              clearTimeout(lifecycle.cleanupTimer);
            }
            updated.delete(id);
            hasChanges = true;
          }
        });
        
        return hasChanges ? updated : prev;
      });
    }, 2000);

    return () => clearInterval(monitoringInterval);
  }, [visible, renderableParticles.length]); // Removed particleLifecycles dependency

  if (!visible || renderableParticles.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {renderableParticles.map(particle => (
        <ParticleComponent
          key={particle.id}
          particle={particle}
          performanceMode={performanceMode}
          onParticleComplete={handleParticleComplete}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000, // Ensure particles render above map
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
  },
  particlePerformance: {
    width: 6,
    height: 6,
  },
  particleInner: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E6F3FF',
    borderRadius: 4,
    shadowColor: '#87CEEB',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  particleInnerPerformance: {
    borderRadius: 3,
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  particleGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    backgroundColor: '#B0E0E6',
    borderRadius: 6,
    zIndex: -1,
  },
});

export default FogParticles;