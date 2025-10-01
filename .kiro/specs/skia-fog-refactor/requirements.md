# Requirements Document

## Introduction

The Skia Fog of War Refactor transforms the existing fog overlay system from static shape-based rendering to a dynamic, high-performance shader-based implementation using React Native Skia. This refactor replaces the current WebGL cloud system with a more efficient, mobile-optimized approach that provides procedurally generated animated cloud textures with smooth dissipation effects. The new system will deliver superior visual quality while improving performance on mobile devices through Skia's optimized rendering pipeline.

## Requirements

### Requirement 1

**User Story:** As a user, I want the fog overlay to use procedurally generated animated clouds, so that unexplored areas have a dynamic, living appearance instead of static shapes.

#### Acceptance Criteria

1. WHEN the map loads THEN the system SHALL render procedurally generated cloud patterns using GLSL shaders
2. WHEN viewing the fog THEN the system SHALL display animated clouds that drift and evolve naturally over time
3. WHEN clouds animate THEN the system SHALL use multi-octave noise functions to create realistic cloud formations
4. WHEN displaying clouds THEN the system SHALL maintain consistent visual quality across different zoom levels using level-of-detail optimization

### Requirement 2

**User Story:** As a developer, I want to replace the existing fog overlay components with a Skia-based implementation, so that the system is more maintainable and performant.

#### Acceptance Criteria

1. WHEN implementing the new system THEN the system SHALL use React Native Skia Canvas for all fog rendering
2. WHEN refactoring THEN the system SHALL replace FogOverlay.tsx, CloudRenderer.tsx, and FogParticles.tsx with SkiaFogOverlay.tsx
3. WHEN integrating THEN the system SHALL maintain the same props interface (exploredAreas, zoomLevel) for backward compatibility
4. WHEN rendering THEN the system SHALL use a single full-screen Canvas component positioned between the map and UI controls

### Requirement 3

**User Story:** As a user, I want smooth fog dissipation animations when I explore new areas, so that revealing the map feels satisfying and responsive.

#### Acceptance Criteria

1. WHEN I enter an unexplored area THEN the system SHALL trigger a radial dissipation animation from my location
2. WHEN fog dissipates THEN the system SHALL animate the clearing radius from 0 to full size over 2-3 seconds
3. WHEN clearing areas THEN the system SHALL use BlurMask to create soft, feathered edges around revealed regions
4. WHEN animating THEN the system SHALL use easing functions and proper timing for natural-feeling transitions

### Requirement 4

**User Story:** As a user, I want the fog system to perform efficiently on mobile devices, so that the enhanced visuals don't impact app responsiveness or battery life.

#### Acceptance Criteria

1. WHEN rendering fog THEN the system SHALL use GPU-accelerated Skia shaders for optimal performance
2. WHEN animating THEN the system SHALL maintain 60fps performance on target mobile devices
3. WHEN managing resources THEN the system SHALL use efficient uniform updates and minimize CPU overhead
4. WHEN adapting to device capabilities THEN the system SHALL adjust shader complexity based on zoom level and device performance

### Requirement 5

**User Story:** As a user, I want the fog masking to accurately respect explored areas, so that previously visited locations remain visible with proper soft edges.

#### Acceptance Criteria

1. WHEN areas are explored THEN the system SHALL convert exploredAreas polygons to Skia Path objects
2. WHEN masking fog THEN the system SHALL use BlendMode operations to cut out explored areas from the cloud shader
3. WHEN creating masks THEN the system SHALL apply blur effects to create natural, soft-edged boundaries
4. WHEN updating exploration THEN the system SHALL efficiently update the mask path without full regeneration

### Requirement 6

**User Story:** As a developer, I want the new system to integrate seamlessly with existing Redux state, so that exploration data and animations work without changes to the core logic.

#### Acceptance Criteria

1. WHEN integrating THEN the system SHALL use existing fogSlice state for clearingAreas and animationInProgress
2. WHEN handling state updates THEN the system SHALL subscribe to Redux state changes for real-time fog updates
3. WHEN managing animations THEN the system SHALL adapt existing startFogClearingAnimation and completeFogClearingAnimation actions
4. WHEN preserving data THEN the system SHALL maintain compatibility with existing SQLite exploration storage

### Requirement 7

**User Story:** As a user, I want wind effects and cloud movement to be configurable, so that I can customize the visual experience to my preferences.

#### Acceptance Criteria

1. WHEN configuring wind THEN the system SHALL provide uniforms for wind direction and speed control
2. WHEN animating clouds THEN the system SHALL use time-based offsets to create smooth drifting effects
3. WHEN customizing THEN the system SHALL allow adjustment of animation speed and cloud density
4. WHEN saving preferences THEN the system SHALL persist wind and animation settings using existing settings infrastructure