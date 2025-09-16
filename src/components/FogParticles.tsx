import React, { useEffect, useState } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { FogClearingAnimation, ParticleAnimation } from '../services/fogAnimationService';

interface FogParticlesProps {
  animations: FogClearingAnimation[];
  visible: boolean;
}

interface ParticleProps {
  particle: ParticleAnimation;
  mapRef?: React.RefObject<Mapbox.MapView>;
}

const ParticleComponent: React.FC<ParticleProps> = ({ particle }) => {
  return (
    <Animated.View
      style={[
        styles.particle,
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
      ]}
    >
      <View style={styles.particleInner} />
    </Animated.View>
  );
};

const FogParticles: React.FC<FogParticlesProps> = ({ animations, visible }) => {
  const [renderableParticles, setRenderableParticles] = useState<ParticleAnimation[]>([]);

  useEffect(() => {
    if (!visible) {
      setRenderableParticles([]);
      return;
    }

    // Collect all particles from active animations
    const allParticles: ParticleAnimation[] = [];
    animations.forEach(animation => {
      allParticles.push(...animation.particleAnimations);
    });

    setRenderableParticles(allParticles);
  }, [animations, visible]);

  if (!visible || renderableParticles.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {renderableParticles.map(particle => (
        <ParticleComponent
          key={particle.id}
          particle={particle}
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
});

export default FogParticles;