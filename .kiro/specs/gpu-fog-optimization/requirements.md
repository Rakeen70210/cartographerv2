# Requirements Document

## Introduction

The current fog of war implementation in Cartographer suffers from critical performance issues due to CPU-bound vector path union operations in the `SkiaFogOverlay` component. This feature will implement a high-performance GPU-based fog masking system that moves the computational load from CPU to GPU using Skia shaders and data textures. The new system will maintain visual fidelity while achieving stable, high-FPS performance even with thousands of explored areas.

## Requirements

### Requirement 1: GPU-Based Fog Masking System

**User Story:** As a user exploring dense urban areas with thousands of visited locations, I want the fog of war overlay to render smoothly without frame drops, so that my exploration experience remains fluid and responsive.

#### Acceptance Criteria

1. WHEN the app renders fog of war with >2000 explored circles THEN the system SHALL maintain >30 FPS on mid-range devices
2. WHEN processing explored areas THEN the system SHALL use GPU-based per-pixel masking instead of CPU vector path unions
3. WHEN encoding exploration data THEN the system SHALL pack circle data into RGBA data textures with normalized values (R=x, G=y, B=radius, A=type)
4. WHEN rendering fog overlay THEN the system SHALL use SkSL (Skia Shading Language) shaders for all masking calculations

### Requirement 2: Intelligent Data Optimization Service

**User Story:** As a user with extensive exploration history, I want the app to efficiently manage large datasets of explored areas, so that performance remains optimal regardless of my exploration progress.

#### Acceptance Criteria

1. WHEN the viewport changes THEN the system SHALL cull circles outside the current map viewport with appropriate padding
2. WHEN circle count exceeds 2000 THEN the system SHALL apply Level of Detail (LOD) clustering to merge nearby circles
3. WHEN at lower zoom levels THEN the system SHALL use spatial grid clustering to reduce data volume
4. WHEN converting coordinates THEN the system SHALL transform geographic coordinates to screen-space pixel coordinates
5. WHEN preparing data THEN the system SHALL normalize all values to 0-1 range for GPU texture compatibility

### Requirement 3: Multi-Tier Fallback System

**User Story:** As a user on various device types and capabilities, I want the fog of war feature to work reliably across all supported devices, so that I can explore regardless of my hardware limitations.

#### Acceptance Criteria

1. WHEN the app starts THEN the system SHALL perform a one-time capability test to determine the best-supported rendering method
2. WHEN GPU texture sampling is available THEN the system SHALL use Tier 1 (high-performance data texture approach)
3. WHEN texture sampling fails BUT uniform arrays work THEN the system SHALL fall back to Tier 2 (uniform arrays with 100 circle limit)
4. WHEN all GPU methods fail THEN the system SHALL fall back to Tier 3 (original CPU-based path unioning)
5. WHEN any tier fails THEN the system SHALL gracefully degrade to the next available tier without crashing

### Requirement 4: Shader Integration and Visual Quality

**User Story:** As a user, I want the new high-performance fog system to maintain the same visual quality and effects as the current implementation, so that my exploration experience is not compromised by the performance improvements.

#### Acceptance Criteria

1. WHEN rendering fog edges THEN the system SHALL use smoothstep functions for soft, feathered edges
2. WHEN calculating pixel masking THEN the system SHALL use sqrt-free squared-distance checks for performance
3. WHEN integrating with existing shaders THEN the system SHALL extend the current SkiaCloudShader without breaking existing functionality
4. WHEN rendering fog THEN the system SHALL NOT use discard operations that could cause performance issues
5. WHEN displaying fog overlay THEN the visual result SHALL be indistinguishable from the current CPU-based implementation

### Requirement 5: Component Architecture Refactoring

**User Story:** As a developer maintaining the codebase, I want the fog overlay component to have a clean, maintainable architecture that separates concerns between data processing and rendering, so that future modifications are easier to implement.

#### Acceptance Criteria

1. WHEN refactoring SkiaFogOverlay THEN the component SHALL become a thin orchestrator that delegates processing to services
2. WHEN rendering fog overlay THEN the component SHALL use a single full-screen Fill node with shader-driven effects
3. WHEN processing fog data THEN all computational logic SHALL be moved to the FogMaskUniformService
4. WHEN integrating with shaders THEN the component SHALL pass uniforms through the existing SkiaShaderSystem
5. WHEN maintaining backward compatibility THEN existing fog-related components SHALL be preserved as fallback options

### Requirement 6: Performance Monitoring and Validation

**User Story:** As a developer, I want comprehensive performance monitoring and validation tools, so that I can verify the performance improvements and debug any issues that arise.

#### Acceptance Criteria

1. WHEN testing performance THEN the system SHALL include FPS profiling capabilities in dense exploration areas
2. WHEN debugging rendering THEN the system SHALL provide a debug overlay to visually confirm circle alignment
3. WHEN validating functionality THEN the system SHALL include unit tests for the FogMaskUniformService
4. WHEN measuring improvements THEN the system SHALL demonstrate measurable FPS gains over the current implementation
5. WHEN monitoring memory usage THEN the system SHALL not increase memory consumption beyond acceptable limits

### Requirement 7: Smooth Migration and Deployment

**User Story:** As a user of the existing app, I want the performance improvements to be deployed seamlessly without affecting my current exploration data or experience, so that I can benefit from better performance without any disruption.

#### Acceptance Criteria

1. WHEN deploying the new system THEN existing exploration data SHALL remain compatible and functional
2. WHEN migrating from old implementation THEN the transition SHALL be transparent to users
3. WHEN preserving old components THEN ExplorationMaskManager, FogMaskingSystem, and BlurMaskManager SHALL be marked for deprecation but remain functional
4. WHEN rolling out updates THEN the system SHALL support gradual rollout with ability to rollback if issues occur
5. WHEN maintaining compatibility THEN the new system SHALL work with all existing fog-related Redux state and data structures