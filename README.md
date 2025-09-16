# Cartographer App

A React Native mobile application built with Expo that gamifies real-world exploration through a fog-of-war map interface.

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Mapbox account and API keys

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure Mapbox:
   - Create a Mapbox account at https://mapbox.com
   - Get your public and secret API keys
   - Replace `YOUR_MAPBOX_DOWNLOAD_TOKEN` in `app.json` with your Mapbox download token
   - Create a `.env` file and add your Mapbox public key:
   ```
   EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your_public_mapbox_token_here
   ```

3. Run the development server:
```bash
npm start
```

## Project Structure

```
src/
├── components/     # React Native components
├── services/       # Business logic and external service integrations
├── database/       # SQLite database schema and queries
├── store/          # Redux store configuration and slices
├── types/          # TypeScript type definitions
└── utils/          # Utility functions and constants
```

## Dependencies

- **@rnmapbox/maps**: Mapbox integration for React Native
- **expo-sqlite**: Local database storage
- **@reduxjs/toolkit**: State management
- **react-redux**: React bindings for Redux
- **expo-location**: GPS and location services

## Next Steps

1. Configure Mapbox API keys
2. Implement SQLite database initialization
3. Set up location services
4. Create map container component
5. Build fog overlay system

## Requirements Addressed

- **4.1**: Cross-platform Expo deployment for iOS and Android
- **4.4**: Over-the-air updates through Expo deployment system