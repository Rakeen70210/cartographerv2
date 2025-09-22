# Project Structure & Architecture

## Folder Organization

```
src/
├── components/     # React Native UI components
├── services/       # Business logic and external service integrations
├── database/       # SQLite schema, queries, and database utilities
├── store/          # Redux store configuration and state slices
├── types/          # TypeScript type definitions
├── hooks/          # Custom React hooks
├── utils/          # Utility functions and constants
└── config/         # Configuration files (Mapbox, etc.)
```

## Architecture Patterns

### State Management
- **Redux Toolkit** with feature-based slices: `mapSlice`, `locationSlice`, `explorationSlice`, `fogSlice`
- Typed hooks in `src/store/hooks.ts` for `useAppDispatch` and `useAppSelector`
- Store configuration with serializable check middleware

### Service Layer
- Singleton services for core functionality (LocationService, FogService, etc.)
- Services handle external integrations and complex business logic
- Background task management through `taskManager.ts`

### Component Structure
- Barrel exports in `index.ts` files for clean imports
- Components focused on UI rendering, business logic delegated to services
- Main app structure: `App.tsx` → `MapScreen` → `MapContainer` + overlays

### Database Layer
- SQLite schema definitions in `schema.ts`
- Database utilities and connection management in `database.ts`
- Service layer methods in `services.ts`

## Code Conventions

### File Naming
- PascalCase for components: `MapContainer.tsx`
- camelCase for services: `locationService.ts`
- Barrel exports via `index.ts` in each directory

### Import Structure
- External dependencies first
- Internal imports grouped by: types, components, services, utils
- Relative imports for same-directory files

### TypeScript
- Strict mode enabled
- Comprehensive type definitions in `src/types/`
- Proper typing for Redux state and actions