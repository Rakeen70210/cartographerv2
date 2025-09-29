# Cartographer App - AI Coding Agent Instructions

## Project Overview
Cartographer is a React Native/Expo app that gamifies real-world exploration through a fog-of-war map interface. Users reveal areas of the map by physically visiting locations, similar to classic strategy games.

## Architecture Patterns

### Service-First Design
- **Services Layer**: Business logic lives in `src/services/` - each service handles a specific domain (location, fog, exploration, etc.)
- **Initialization Pattern**: Services use singleton pattern with `getXxxService()` functions and cross-service dependency management via `initializeServices()`
- **Background Processing**: Location tracking and fog processing happen in background services, not in React components

### Redux State Management
- **Store Structure**: 5 main slices - `map`, `location`, `exploration`, `fog`, `profile`
- **Selectors**: Use dedicated selectors in `src/store/selectors` - never access state directly in components
- **Service Integration**: Services dispatch actions to update state, components subscribe to state changes

### Database-First Persistence
- **SQLite**: Uses expo-sqlite with schema defined in `src/database/schema.ts`
- **Initialization Service**: Database setup happens in `initializeDatabaseOnFirstLaunch()` - creates schema, default achievements, and user stats
- **Achievement System**: 13 default achievements across exploration, distance, streak, and percentage categories

## Key Technical Patterns

### Location & Fog Integration
```typescript
// Always start fog-location integration in MapScreen
const success = await fogLocationIntegrationService.start();
```
- **Fog Service**: Processes explored areas into GeoJSON polygons using spatial grid optimization
- **Location Service**: Handles GPS tracking with background task manager
- **Integration Service**: Coordinates between location tracking and fog rendering

### Component Structure
- **Barrel Exports**: All components exported through `src/components/index.ts`
- **Screen Components**: `MapScreen` and `ProfileScreen` are main screens, wrapped by `TabNavigation`
- **Error Boundaries**: Always wrap components in `ErrorBoundary` for crash protection

### Mapbox Integration
- **Configuration**: Mapbox setup in `src/config/mapbox.ts` with token validation
- **Rendering**: Use `@rnmapbox/maps` for all map functionality - fog overlay renders as Mapbox ShapeSource/FillLayer
- **Performance**: Fog geometry uses Level of Detail (LOD) based on zoom level

## Development Workflows

### Environment Setup
```bash
# Development
npm run validate:env:dev
npm start

# Building
npm run build:development  # Internal testing
npm run build:preview     # Staging
npm run build:production  # App store
```

### Testing Strategy
- **Test Categories**: `integration`, `e2e`, `performance`, `edge-cases` - run specific types with dedicated scripts
- **Coverage**: Use `npm run test:coverage` for coverage reports
- **Watch Mode**: `npm run test:watch` for development

### Deployment (EAS)
- **Environment Variables**: Mapbox tokens required - `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` and `MAPBOX_DOWNLOAD_TOKEN`
- **Build Profiles**: Three profiles in `eas.json` - development, preview, production
- **Updates**: OTA updates via `eas update` with branch-specific deployments

## Critical Implementation Details

### Performance Optimizations
- **Memory Management**: `MemoryManagementService` handles cleanup and monitoring
- **Background Processing**: Location queue processing with configurable intervals and batch sizes
- **Fog Rendering**: Spatial grid system with cell merging to reduce polygon complexity

### Service Dependencies
- **Initialization Order**: App.tsx → `validateAppConfiguration()` → `initializeServices()` → `initializeDatabaseOnFirstLaunch()`
- **Cross-Service Communication**: Services communicate via Redux store, not direct references
- **Error Recovery**: `ErrorRecoveryService` handles service failures and restarts

### Data Flow
1. Location tracking → Background queue → Exploration service
2. Explored areas → Fog service → Geometry generation → Redux state
3. State changes → Component re-render → Mapbox layer update

## File Patterns

### When Adding New Features
- **Services**: Create in `src/services/` with singleton pattern and index.ts export
- **Types**: Define in `src/types/` with barrel exports
- **Components**: Create in `src/components/` with default export and index.ts re-export
- **State**: Add slice to `src/store/slices/` and update store configuration

### Configuration Management
- **Environment**: Use `src/config/validation.ts` for environment validation
- **Mapbox**: All map configuration in `src/config/mapbox.ts`
- **Types**: Strict TypeScript - extend existing type definitions rather than using `any`

Remember: This is a location-based app where the core experience depends on GPS tracking and real-time map rendering. Always consider performance implications and background processing requirements when making changes.