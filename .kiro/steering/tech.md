# Technology Stack

## Framework & Platform
- **React Native** with **Expo SDK 54** for cross-platform mobile development
- **TypeScript** with strict mode enabled for type safety
- **Expo New Architecture** enabled for performance improvements

## Core Dependencies
- **@rnmapbox/maps**: Mapbox integration for interactive mapping
- **@reduxjs/toolkit**: Modern Redux for state management
- **react-redux**: React bindings for Redux store
- **expo-sqlite**: Local SQLite database for offline data storage
- **expo-location**: GPS and location services with background tracking
- **expo-task-manager**: Background task processing
- **@react-native-async-storage/async-storage**: Persistent key-value storage

## Development Commands

```bash
# Start development server
npm start

# Run on specific platforms
npm run android
npm run ios
npm run web

# Install dependencies
npm install
```

## Build Configuration
- **Expo Configuration**: `app.json` contains platform-specific settings
- **TypeScript**: Extends `expo/tsconfig.base` with strict mode
- **Mapbox Setup**: Requires `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` environment variable
- **Location Permissions**: Configured for both foreground and background location access

## Environment Setup
1. Configure Mapbox API keys in `.env` file
2. Replace `YOUR_MAPBOX_DOWNLOAD_TOKEN` in `app.json`
3. Ensure location permissions are properly configured for target platforms