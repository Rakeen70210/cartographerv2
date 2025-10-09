# Implementation Plan

- [ ] 1. Set up core infrastructure and device capability detection
  - Create device capability detection service with GPU texture and uniform testing
  - Implement tier-based fallback system with persistent storage for detected capabilities
  - Add performance monitoring utilities for FPS tracking and memory usage
  - _Requirements: 3.1, 3.2, 3.3, 6.4_

- [ ] 1.1 Create DeviceCapabilityService with GPU testing
  - Implement `DeviceCapabilityService.ts` with methods for detecting GPU texture support, uniform array limits, and caching capabilities
  - Create startup capability test that attempts shader compilation and texture creation
  - Add persistent storage for caching detected device tier across app sessions
  - _Requirements: 3.1, 3.2_

- [ ] 1.2 Implement performance monitoring utilities
  - Create `PerformanceMonitorService.ts` with FPS tracking, memory monitoring, and performance metrics collection
  - Add frame time measurement and performance degradation detection
  - Implement automatic tier switching when performance drops below thresholds
  - _Requirements: 6.1, 6.4, 6.5_

- [ ]* 1.3 Add unit tests for capability detection
  - Write tests for device capability detection accuracy
  - Test fallback tier switching scenarios
  - Verify performance monitoring metrics collection
  - _Requirements: 6.3_

- [ ] 2. Implement FogMaskUniformService for data processing
  - Create the core service that handles exploration data optimization, coordinate conversion, and texture packing
  - Implement viewport culling, LOD clustering, and RGBA texture generation
  - Add caching mechanisms for frame-to-frame optimization
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 2.1 Create FogMaskUniformService with data culling
  - Implement `FogMaskUniformService.ts` with viewport-based circle culling using configurable padding
  - Add geographic to screen-space coordinate conversion functions
  - Create data structure for managing exploration areas and dissipation animations
  - _Requirements: 2.1, 2.4_

- [ ] 2.2 Implement LOD clustering algorithm
  - Create spatial grid clustering system that merges nearby circles when count exceeds budget (>2000)
  - Implement weighted averaging for merged circle properties to maintain visual coverage
  - Add zoom-level based clustering strategies for different detail levels
  - _Requirements: 2.2, 2.3_

- [ ] 2.3 Add RGBA texture packing and ImageShader creation
  - Implement texture packing that normalizes circle data (x, y, radius, type) to 0-1 range
  - Create SkImage data texture generation with proper RGBA8 format
  - Add ImageShader creation and uniform preparation for GPU consumption
  - _Requirements: 1.3, 2.5_

- [ ] 2.4 Implement caching and performance optimization
  - Add frame-to-frame caching for unchanged viewport/zoom scenarios
  - Implement dirty flagging system for exploration data changes
  - Create object pooling for temporary data structures to reduce garbage collection
  - _Requirements: 2.5, 6.5_

- [ ]* 2.5 Write comprehensive unit tests for FogMaskUniformService
  - Test data culling accuracy with various viewport configurations
  - Verify LOD clustering algorithm correctness and performance
  - Test coordinate conversion precision and texture packing round-trip accuracy
  - _Requirements: 6.3_

- [ ] 3. Extend SkiaCloudShader with GPU masking logic
  - Modify existing cloud shader to accept circle data texture and masking uniforms
  - Implement per-pixel masking logic using SkSL with squared-distance checks and smoothstep edges
  - Integrate masking with existing fog rendering while maintaining visual quality
  - _Requirements: 1.1, 1.2, 4.1, 4.2, 4.3, 4.4_

- [ ] 3.1 Add shader uniforms and texture sampling
  - Modify `SkiaCloudShader.ts` to accept new uniforms: u_circleData shader, u_circleCount, u_texWidth, u_resolution, u_featherPx, u_unpackScale
  - Implement texture sampling logic to read circle data from RGBA texture
  - Add denormalization functions to convert 0-1 texture values back to screen coordinates
  - _Requirements: 1.3, 4.3_

- [ ] 3.2 Implement per-pixel masking logic in SkSL
  - Create fragment shader code that loops through circles and performs squared-distance checks (sqrt-free optimization)
  - Implement smoothstep-based soft edge calculation using u_featherPx for feathered fog edges
  - Add mask alpha calculation that multiplies with base fog alpha without using discard operations
  - _Requirements: 1.2, 4.1, 4.2, 4.4_

- [ ] 3.3 Integrate masking with existing cloud shader effects
  - Preserve existing cloud shader functionality while adding masking layer
  - Ensure visual output matches current CPU-based implementation
  - Optimize shader performance for mobile GPU constraints
  - _Requirements: 4.3, 4.5_

- [ ]* 3.4 Add shader logic unit tests and visual validation
  - Create mock shader execution tests with known input/output pairs
  - Implement visual regression testing with screenshot comparison
  - Add edge case testing for empty data, single circle, and maximum circle scenarios
  - _Requirements: 6.3_

- [ ] 4. Refactor SkiaFogOverlay component for GPU integration
  - Transform component into thin orchestrator that delegates processing to FogMaskUniformService
  - Integrate with SkiaShaderSystem for uniform passing and shader execution
  - Implement single full-screen Fill rendering approach
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 4.1 Refactor SkiaFogOverlay to use FogMaskUniformService
  - Modify `SkiaFogOverlay.tsx` to call FogMaskUniformService for uniform generation
  - Remove existing CPU-based path union logic and replace with service delegation
  - Add proper error handling and fallback integration
  - _Requirements: 5.1, 5.3_

- [ ] 4.2 Integrate with SkiaShaderSystem for uniform passing
  - Connect component to existing SkiaShaderSystem for shader compilation and execution
  - Pass FogMaskUniforms to shader system with proper type safety
  - Implement shader caching and recompilation handling
  - _Requirements: 5.4_

- [ ] 4.3 Implement single Fill component rendering
  - Replace complex rendering logic with single full-screen Fill node
  - Add Paint component with Shader integration for GPU-driven effects
  - Ensure proper Canvas setup and styling for full-screen overlay
  - _Requirements: 5.2_

- [ ]* 4.4 Add component integration tests
  - Test component rendering with various exploration data scenarios
  - Verify proper integration with FogMaskUniformService and SkiaShaderSystem
  - Add performance testing for component render cycles
  - _Requirements: 6.3_

- [ ] 5. Implement multi-tier fallback system
  - Create fallback logic that switches between GPU texture, GPU uniform array, and CPU methods
  - Implement automatic tier switching based on capability detection and performance monitoring
  - Preserve existing CPU-based components as Tier 3 fallback
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5.1 Create tier-based rendering strategy
  - Implement `FogRenderingStrategy` interface with methods for each tier (GPU texture, GPU uniform, CPU fallback)
  - Add automatic tier selection based on DeviceCapabilityService results
  - Create strategy factory that returns appropriate implementation based on device capabilities
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 5.2 Implement GPU uniform array fallback (Tier 2)
  - Create uniform array-based shader variant with 100 circle limit for devices that don't support texture sampling
  - Implement data preparation service variant that uses uniform arrays instead of textures
  - Add performance monitoring to detect when uniform array method should be used
  - _Requirements: 3.3_

- [ ] 5.3 Preserve CPU fallback system (Tier 3)
  - Mark existing ExplorationMaskManager, FogMaskingSystem, and BlurMaskManager as deprecated but functional
  - Ensure CPU fallback can be activated when all GPU methods fail
  - Add seamless switching between GPU and CPU methods without data loss
  - _Requirements: 3.4, 7.3_

- [ ] 5.4 Add graceful degradation and error handling
  - Implement automatic tier switching when shader compilation fails or performance degrades
  - Add error recovery mechanisms that don't crash the app
  - Create user notification system for manual tier selection if needed
  - _Requirements: 3.5_

- [ ]* 5.5 Test fallback system scenarios
  - Test forced tier switching with error injection
  - Verify graceful degradation across different device types
  - Add performance testing for each tier to validate fallback decisions
  - _Requirements: 6.3_

- [ ] 6. Add comprehensive testing and validation
  - Implement performance profiling tools for FPS measurement in dense exploration areas
  - Create debug overlay for visual confirmation of circle alignment and rendering accuracy
  - Add automated testing for performance improvements and memory usage
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 6.1 Create debug overlay and visual validation tools
  - Implement debug overlay component that shows circle positions, viewport bounds, and performance metrics
  - Add visual confirmation tools for circle alignment between CPU and GPU implementations
  - Create screenshot comparison utilities for visual regression testing
  - _Requirements: 6.2_

- [ ] 6.2 Implement performance profiling and benchmarking
  - Create performance profiling tools that measure FPS in dense exploration scenarios (>2000 circles)
  - Add memory usage monitoring and battery impact assessment
  - Implement automated benchmarking with success criteria validation (>30 FPS, <100ms response time)
  - _Requirements: 6.1, 6.4, 6.5_

- [ ]* 6.3 Add end-to-end integration tests
  - Create integration tests for complete rendering pipeline from exploration data to final output
  - Test cross-device compatibility and performance across different device tiers
  - Add automated performance regression testing
  - _Requirements: 6.3_

- [ ] 7. Implement migration strategy and deployment preparation
  - Create feature flag system for A/B testing between old and new implementations
  - Ensure backward compatibility with existing exploration data and Redux state
  - Implement gradual rollout mechanism with rollback capabilities
  - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [ ] 7.1 Create feature flag system for gradual rollout
  - Implement feature flag that allows switching between CPU and GPU fog implementations
  - Add A/B testing infrastructure for comparing performance between implementations
  - Create user preference system for manual override of automatic tier selection
  - _Requirements: 7.4_

- [ ] 7.2 Ensure data compatibility and migration
  - Verify new system works with existing exploration data structures and Redux state
  - Implement data migration utilities if needed for new format requirements
  - Add validation to ensure no exploration data is lost during transition
  - _Requirements: 7.1, 7.5_

- [ ] 7.3 Add rollback mechanism and monitoring
  - Implement automatic rollback triggers based on error rates and performance metrics
  - Create monitoring dashboard for tracking rollout success and identifying issues
  - Add manual rollback capabilities for emergency situations
  - _Requirements: 7.4_

- [ ]* 7.4 Create deployment validation tests
  - Add tests that validate smooth transition between old and new implementations
  - Test rollback scenarios and data integrity during transitions
  - Verify feature flag functionality and A/B testing infrastructure
  - _Requirements: 7.1, 7.2_