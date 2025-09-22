# Database Initialization Service

This module provides comprehensive database initialization functionality for the Cartographer app, ensuring proper setup on first launch and ongoing database health monitoring.

## Overview

The Database Initialization Service handles:
- Database schema creation and migration
- First-launch detection and setup
- Default user statistics initialization
- Initial achievement records creation
- Database health monitoring and verification
- Error handling and recovery

## Key Components

### DatabaseInitializationService

Main service class that orchestrates the initialization process.

```typescript
import { initializeDatabaseOnFirstLaunch } from './src/database';

// Initialize database on app startup
const result = await initializeDatabaseOnFirstLaunch();
if (result.errors.length > 0) {
  console.warn('Initialization completed with warnings:', result.errors);
}
```

### InitializationUtils

Utility functions for monitoring and debugging database initialization.

```typescript
import { 
  getInitializationStatus, 
  performInitializationHealthCheck,
  logInitializationStatus 
} from './src/database';

// Check current status
const status = await getInitializationStatus();

// Perform health check
const healthCheck = await performInitializationHealthCheck();

// Log detailed status for debugging
await logInitializationStatus();
```

## First Launch Process

When the app launches for the first time:

1. **Database Schema Setup**: Creates all required tables with proper indexes
2. **User Stats Initialization**: Creates initial user statistics record with default values
3. **Achievement Creation**: Populates the database with 13 default achievements across different categories:
   - Exploration achievements (First Steps, Local Explorer, etc.)
   - Distance achievements (First Mile, Marathon Explorer, etc.)
   - Streak achievements (Daily Explorer, Weekly Wanderer)
   - Percentage achievements (Getting Started, Making Progress, etc.)

## Default Achievements

The service creates the following achievements on first launch:

| Type | Name | Description |
|------|------|-------------|
| exploration | First Steps | Explore your first area |
| exploration | Local Explorer | Explore 10 different areas |
| exploration | Neighborhood Navigator | Explore 50 different areas |
| exploration | City Wanderer | Explore 100 different areas |
| exploration | Regional Rover | Explore 500 different areas |
| distance | First Mile | Travel 1 mile while exploring |
| distance | Marathon Explorer | Travel 26.2 miles while exploring |
| distance | Century Traveler | Travel 100 miles while exploring |
| streak | Daily Explorer | Explore for 7 consecutive days |
| streak | Weekly Wanderer | Explore for 30 consecutive days |
| percentage | Getting Started | Reach 1% exploration coverage |
| percentage | Making Progress | Reach 5% exploration coverage |
| percentage | Serious Explorer | Reach 10% exploration coverage |

## Integration with App.tsx

The initialization service is integrated into the main App component to ensure it runs before the UI loads:

```typescript
// App.tsx
useEffect(() => {
  const initializeApp = async () => {
    try {
      validateAppConfiguration();
      const result = await initializeDatabaseOnFirstLaunch();
      // Handle result...
    } catch (error) {
      // Handle error...
    }
  };
  initializeApp();
}, []);
```

## Error Handling

The service provides comprehensive error handling:
- Database connection failures
- Schema creation errors
- Data insertion failures
- Integrity check failures

All errors are collected and returned in the `InitializationResult` object for proper handling by the calling code.

## Health Monitoring

Use the utility functions to monitor database health:

```typescript
// Check if initialization is healthy
const healthCheck = await performInitializationHealthCheck();
if (!healthCheck.healthy) {
  console.error('Database issues detected:', healthCheck.issues);
  console.log('Recommendations:', healthCheck.recommendations);
}
```

## Development and Testing

For development purposes, you can reset the database to initial state:

```typescript
import { resetDatabaseForDevelopment } from './src/database';

// WARNING: This will delete all data!
const success = await resetDatabaseForDevelopment();
```

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

- **Requirement 7.1**: Database initialization on first launch
- **Requirement 5.2**: Initial achievement records creation
- **Requirement 7.4**: SQLite database setup with proper schema

## Files

- `initializationService.ts` - Main initialization service
- `initializationUtils.ts` - Utility functions for monitoring and debugging
- `database.ts` - Core database manager (existing)
- `services.ts` - Database service layer (existing)
- `schema.ts` - Database schema definitions (existing)