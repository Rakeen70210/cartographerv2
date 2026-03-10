# Project Overview

- This is a cross-platform app that encourages exploring the world. A beautiful map is displayed that is originally covered in fog, and as the user explores the fog lifts to reveal the map underneath.

# Repository Guidelines

## Project Structure & Module Organization
- `App.tsx` and `index.ts` are the Expo entry points.
- `src/components/` holds React Native UI components (PascalCase filenames, barrel in `src/components/index.ts`).
- `src/services/` contains business logic and integrations (Mapbox, fog system, cloud system).
- `src/store/` is Redux Toolkit setup (slices, hooks).
- `src/database/` owns SQLite schema, services, and persistence.
- `src/utils/`, `src/hooks/`, `src/types/`, and `src/config/` host shared helpers, hooks, types, and runtime config.
- Tests live under `src/__tests__/` and feature folders like `src/components/__tests__/`.
- Static assets are under `assets/`.

## Build, Test, and Development Commands
- `npm start`: start the Expo dev server.
- `npm run android` / `npm run ios`: run on device/simulator via Expo.
- `npm run web`: run the web target.
- `npm test`: run Jest once.
- `npm run test:watch`: Jest watch mode.
- `npm run test:coverage`: coverage report to `coverage/`.
- `npm run test:e2e` / `npm run test:integration` / `npm run test:performance`: scoped test suites.
- `npm run validate:env` (or `:dev`, `:preview`, `:prod`): verify `.env` setup.
- `npm run reset-db`: reset local SQLite data.
- `npm run build:development|preview|production`: EAS build profiles.

## Coding Style & Naming Conventions
- TypeScript with strict mode (`tsconfig.json`).
- 2-space indentation, semicolons, and ES module imports.
- React components use PascalCase filenames (e.g., `MapContainer.tsx`).
- Keep Redux slices in `src/store/slices/` and reuse hooks from `src/store/hooks`.
- No repo-wide formatter or linter is configured; keep changes consistent with nearby files.

## Testing Guidelines
- Jest with `jest-expo` and Testing Library (`@testing-library/react-native`).
- Test files follow `__tests__` folders or `*.test.ts(x)` / `*.spec.ts(x)` naming.
- Coverage includes `src/**/*.{ts,tsx}` and excludes `d.ts`, `__tests__`, and `index.ts` barrels.
- Run focused suites with the `test:*` scripts; no explicit coverage thresholds are defined.

## Configuration & Secrets
- Mapbox tokens are required; copy `.env.example` to `.env` and follow `MAPBOX_SETUP.md`.
- Review `ENVIRONMENT_CONFIG.md` and run `npm run validate:env` before builds.
