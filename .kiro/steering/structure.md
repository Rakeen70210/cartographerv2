# Project Structure & Architecture

## Root Directory Organization
```
├── src/                    # Main source code
├── assets/                 # Static assets (images, icons)
├── android/               # Android-specific native code
├── scripts/               # Build and deployment scripts
├── docs/                  # Documentation and design files
├── store-config/          # App store metadata and configs
└── .kiro/                 # Kiro AI assistant configuration
```

## Source Code Architecture (`src/`)

### Core Directories
- **`components/`**: React Native UI components with barrel exports
- **`services/`**: Business logic, external integrations, and singleton services
- **`database/`**: SQLite schema, queries, and data access layer
- **`store/`**: Redux Toolkit store configuration, slices, and selectors
- **`types/`**: TypeScript type definitions and interfaces
- **`utils/`**: Utility functions, constants, and helper modules
- **`hooks/`**: Custom React hooks for shared logic
- **`config/`**: Configuration files and validation

### Service Layer Architecture
Services follow a singleton pattern with factory functions:
```typescript
// Pattern: getServiceName() factory function
export const getLocationService = () => LocationService.getInstance();
```

Key service categories:
- **Core Services**: Location, exploration, fog rendering
- **Integration Services**: Mapbox, background tasks, cloud system
- **Utility Services**: Statistics, achievements, backup, offline support
- **Performance Services**: Memory management, device capabilities, monitoring

### Component Organization
- **Barrel exports** in `index.ts` files for clean imports
- **Screen components**: Top-level navigation screens (MapScreen, ProfileScreen)
- **Container components**: Business logic containers (MapContainer)
- **UI components**: Reusable interface elements
- **Overlay components**: Fog, cloud, and particle systems

### State Management Pattern
- **Redux Toolkit** with feature-based slices
- **Typed hooks** for store access (`useAppSelector`, `useAppDispatch`)
- **Selectors** for computed state and memoization
- **Persistence** layer for state hydration

### Database Layer
- **Schema definitions** in `schema.ts` with SQL DDL
- **Service layer** for data operations and business logic
- **Initialization utilities** for database setup and migrations
- **Spatial indexing** for location-based queries

## File Naming Conventions
- **Components**: PascalCase (e.g., `MapContainer.tsx`)
- **Services**: camelCase with Service suffix (e.g., `locationService.ts`)
- **Types**: camelCase (e.g., `location.ts`, `fog.ts`)
- **Utilities**: camelCase (e.g., `spatial.ts`, `constants.ts`)
- **Tests**: Match source file with `.test.ts` suffix

## Import/Export Patterns
- Use **barrel exports** (`index.ts`) for public APIs
- **Relative imports** within feature directories
- **Absolute imports** from `src/` for cross-feature dependencies
- **Service initialization** handled in `services/index.ts`

## Cloud System Architecture
The cloud system is organized as a comprehensive subsystem:
```
src/services/cloudSystem/
├── animation/          # Animation controllers and effects
├── geometry/           # Spatial calculations and cloud shapes
├── integration/        # Mapbox and fog system integration
├── performance/        # Optimization and device adaptation
├── settings/           # Configuration and customization
├── shaders/           # Skia shader management
└── textures/          # Texture loading and atlases
```

## Testing Structure
- **Unit tests**: Co-located with source files
- **Integration tests**: In `__tests__/integration/`
- **E2E tests**: In `__tests__/e2e/`
- **Performance tests**: In `__tests__/performance/`
- **Test utilities**: Shared setup and helpers