# Environment Configuration Guide

This document outlines the environment configuration setup for the Cartographer app across different deployment stages.

## Overview

The app supports three environments:
- **Development**: Local development and testing
- **Preview**: Staging environment for testing before production
- **Production**: Live app store releases

## Environment Files

### `.env.development`
Used for local development and development builds.

### `.env.preview` 
Used for preview/staging builds and testing.

### `.env.production`
Used for production app store releases.

## Required Environment Variables

### Core Configuration
- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`: Public Mapbox API token (starts with `pk.`)
- `MAPBOX_DOWNLOAD_TOKEN`: Secret Mapbox download token (starts with `sk.`)
- `EXPO_PUBLIC_ENVIRONMENT`: Environment identifier (development/preview/production)
- `EXPO_PUBLIC_API_URL`: Backend API base URL

### Debug & Logging
- `EXPO_PUBLIC_DEBUG_MODE`: Enable/disable debug features (true/false)
- `EXPO_PUBLIC_LOG_LEVEL`: Logging level (debug/info/warn/error)

### Feature Flags
- `EXPO_PUBLIC_ENABLE_PERFORMANCE_MONITORING`: Enable performance tracking
- `EXPO_PUBLIC_ENABLE_CRASH_REPORTING`: Enable crash reporting
- `EXPO_PUBLIC_ANALYTICS_ENABLED`: Enable analytics (production only)

### Production-Specific
- `EXPO_PUBLIC_SENTRY_DSN`: Sentry error tracking DSN (production only)

## Mapbox Token Setup

### 1. Create Mapbox Account
1. Go to [Mapbox Account](https://account.mapbox.com/)
2. Sign up or log in to your account

### 2. Generate Access Tokens

#### Public Access Token
1. Navigate to "Access tokens" in your Mapbox account
2. Create a new public token with these scopes:
   - `styles:read`
   - `fonts:read`
   - `datasets:read`
   - `vision:read`
3. Copy the token (starts with `pk.`)

#### Download Token
1. Create a new secret token with these scopes:
   - `downloads:read`
2. Copy the token (starts with `sk.`)

### 3. Configure Tokens by Environment

#### Development
- Use development/testing tokens with higher rate limits
- Can use the same tokens across development and preview

#### Production
- Use production-specific tokens
- Configure appropriate rate limits for expected usage
- Consider using separate tokens for iOS and Android if needed

## EAS Build Configuration

The `eas.json` file is configured with environment-specific settings:

### Development Profile
- Uses development client
- Internal distribution
- Debug build configuration
- APK format for Android

### Preview Profile
- Internal distribution for testing
- Release build configuration
- APK format for easy sharing
- iOS simulator support

### Production Profile
- App store distribution
- Release build configuration
- App bundle format for Android
- Optimized for store submission

## Validation

### Automatic Validation
Environment validation runs automatically before builds:
```bash
npm run prebuild:development  # Validates before dev build
npm run prebuild:preview      # Validates before preview build
npm run prebuild:production   # Validates before production build
```

### Manual Validation
```bash
npm run validate:env:dev      # Validate development environment
npm run validate:env:preview  # Validate preview environment
npm run validate:env:prod     # Validate production environment
```

## Build Commands

### Development Build
```bash
npm run build:development
```

### Preview Build
```bash
npm run build:preview
```

### Production Build
```bash
npm run build:production
```

## Security Best Practices

### Token Security
1. **Never commit tokens to version control**
2. **Use different tokens for each environment**
3. **Rotate tokens regularly**
4. **Monitor token usage in Mapbox dashboard**

### Environment Variables
1. **Use EXPO_PUBLIC_ prefix only for client-side variables**
2. **Keep sensitive data in server-side environment variables**
3. **Validate all environment variables before builds**

### Production Considerations
1. **Disable debug mode in production**
2. **Set appropriate log levels**
3. **Enable crash reporting and analytics**
4. **Use production API endpoints**

## Troubleshooting

### Common Issues

#### Invalid Mapbox Token
- Ensure token starts with correct prefix (`pk.` or `sk.`)
- Verify token has required scopes
- Check token is not expired

#### Missing Environment Variables
- Run validation script to identify missing variables
- Check environment file exists and is properly formatted
- Ensure all required variables are set

#### Build Failures
- Validate environment before building
- Check EAS build logs for specific errors
- Verify all tokens and URLs are accessible

### Getting Help
1. Run the validation script for detailed error messages
2. Check Mapbox account for token status and usage
3. Review EAS build logs for specific build issues
4. Ensure all environment files are properly configured

## Environment Migration

When moving between environments or setting up new deployments:

1. **Copy environment template**
   ```bash
   cp .env.development .env.local
   ```

2. **Update tokens and URLs**
   - Replace Mapbox tokens with environment-specific ones
   - Update API URLs to match target environment
   - Adjust feature flags as needed

3. **Validate configuration**
   ```bash
   npm run validate:env
   ```

4. **Test build**
   ```bash
   npm run build:development
   ```

This ensures consistent configuration across all environments and reduces deployment issues.