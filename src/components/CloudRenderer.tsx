import React, { useMemo } from 'react';
import Mapbox from '@rnmapbox/maps';
import { FogGeometry } from '../types/fog';

interface CloudRendererProps {
  cloudGeometries: FogGeometry[];
  cloudOpacities: number[];
  visible: boolean;
  performanceMode?: boolean;
}

const CloudRenderer: React.FC<CloudRendererProps> = ({
  cloudGeometries,
  cloudOpacities,
  visible,
  performanceMode = false
}) => {
  // Optimize cloud rendering based on performance mode
  const optimizedCloudGeometries = useMemo(() => {
    if (!visible || cloudGeometries.length === 0) return [];

    if (performanceMode) {
      // In performance mode, reduce the number of cloud features
      return cloudGeometries.map(geometry => ({
        ...geometry,
        features: geometry.features.slice(0, Math.ceil(geometry.features.length * 0.5))
      }));
    }

    return cloudGeometries;
  }, [cloudGeometries, visible, performanceMode]);

  // Memoize cloud layers to prevent unnecessary re-renders
  const cloudLayers = useMemo(() => {
    return optimizedCloudGeometries.map((cloudGeometry, index) => {
      const opacity = cloudOpacities[index] || 0.3;
      
      return (
        <Mapbox.ShapeSource 
          key={`cloud-source-${index}`} 
          id={`cloud-source-${index}`} 
          shape={cloudGeometry}
        >
          <Mapbox.FillLayer
            id={`cloud-layer-${index}`}
            style={{
              fillColor: [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, '#F0F8FF', // Alice blue at low zoom
                10, '#FFFFFF', // White at high zoom
              ],
              fillOpacity: [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, opacity * 0.8, // More transparent at low zoom
                5, opacity,
                15, opacity * 1.2, // More opaque at high zoom
              ],
            }}
          />
        </Mapbox.ShapeSource>
      );
    });
  }, [optimizedCloudGeometries, cloudOpacities]);

  if (!visible) {
    return null;
  }

  return <>{cloudLayers}</>;
};

export default React.memo(CloudRenderer);