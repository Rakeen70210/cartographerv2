# Technology Stack

## Framework & Runtime
- **React Native 0.81.4** with **Expo ~54.0.7** (managed workflow)
- **TypeScript ~5.9.2** with strict mode enabled
- **Node.js v16+** required for development

## Core Dependencies
- **@rnmapbox/maps ^10.1.44**: Mapbox integration for mapping services
- **@shopify/react-native-skia ^2.2.12**: Advanced graphics and shader rendering
- **expo-sqlite ^16.0.8**: Local SQLite database for data persistence
- **@reduxjs/toolkit ^2.9.0** + **react-redux ^9.2.0**: State management
- **expo-location ^19.0.7**: GPS and location services with background tracking
- **expo-task-manager ^14.0.7**: Background task execution

## Build System
- **Expo Application Services (EAS)** for building and deployment
- **Metro bundler** (via Expo) for JavaScript bundling
- **TypeScript compiler** for type checking

## Testing Framework
- **Jest ^29.7.0** with **jest-expo ~52.0.1**
- **@testing-library/react-native ^12.4.3** for component testing
- **@testing-library/jest-native ^5.4.3** for native assertions

## Common Commands

### Development
```bash
npm start                    # Start Expo development server
npm run android             # Run on Android device/emulator
npm run ios                 # Run on iOS device/simulator
npm run web                 # Run web version
```

### Testing
```bash
npm test                    # Run all tests
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Run tests with coverage report
npm run test:e2e           # Run end-to-end tests
npm run test:performance   # Run performance tests
npm run test:integration   # Run integration tests
```

### Building & Deployment
```bash
npm run build:development  # Build development version
npm run build:preview      # Build preview version
npm run build:production   # Build production version
npm run build:ios          # Build iOS production
npm run build:android      # Build Android production
```

### Environment Validation
```bash
npm run validate:env        # Validate all environment configs
npm run validate:env:dev    # Validate development config
npm run validate:env:prod   # Validate production config
```

### Updates & Submission
```bash
npm run update              # Push OTA update
npm run update:production   # Push to production branch
npm run submit:ios          # Submit to App Store
npm run submit:android      # Submit to Google Play
```

## Environment Setup Requirements
- Mapbox account with API tokens configured in `.env` files
- Expo CLI and EAS CLI installed globally
- Android Studio (for Android development)
- Xcode (for iOS development on macOS)