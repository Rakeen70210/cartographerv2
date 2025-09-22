# Cartographer Deployment Guide

This guide covers the deployment process for the Cartographer app using Expo Application Services (EAS).

## Prerequisites

1. **Install EAS CLI**
   ```bash
   npm install -g @expo/eas-cli
   ```

2. **Login to Expo**
   ```bash
   eas login
   ```

3. **Configure Project**
   - Update `owner` field in `app.json` with your Expo username
   - Update `updates.url` in `app.json` with your project ID
   - Update `username` in the expo-updates plugin configuration

## Environment Setup

### Required Environment Variables
- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`: Your Mapbox public access token
- `MAPBOX_DOWNLOAD_TOKEN`: Your Mapbox download token for builds

### Mapbox Configuration
1. Get tokens from [Mapbox Account](https://account.mapbox.com/access-tokens/)
2. Add tokens to your `.env` file (for local development)
3. Add tokens to EAS secrets for builds:
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN --value your_public_token
   eas secret:create --scope project --name MAPBOX_DOWNLOAD_TOKEN --value your_download_token
   ```

## Build Profiles

### Development Build
For internal testing with development features:
```bash
npm run build:development
```

### Preview Build
For internal testing with production-like features:
```bash
npm run build:preview
```

### Production Build
For app store submission:
```bash
npm run build:production
```

## Platform-Specific Builds

### iOS Build
```bash
npm run build:ios
```

**Requirements:**
- Apple Developer Account
- iOS Distribution Certificate
- Provisioning Profile

### Android Build
```bash
npm run build:android
```

**Requirements:**
- Google Play Console Account
- Android Keystore

## App Store Submission

### iOS App Store
1. Build production iOS app:
   ```bash
   npm run build:ios
   ```

2. Submit to App Store:
   ```bash
   npm run submit:ios
   ```

3. Configure in `eas.json`:
   - `appleId`: Your Apple ID email
   - `ascAppId`: Your App Store Connect app ID
   - `appleTeamId`: Your Apple Developer Team ID

### Google Play Store
1. Build production Android app:
   ```bash
   npm run build:android
   ```

2. Submit to Play Store:
   ```bash
   npm run submit:android
   ```

3. Configure in `eas.json`:
   - `serviceAccountKeyPath`: Path to your Google Play service account key
   - `track`: Release track (internal, alpha, beta, production)

## Over-the-Air Updates

### Publishing Updates
```bash
# Update to default branch
npm run update

# Update to preview branch
npm run update:preview

# Update to production branch
npm run update:production
```

### Update Channels
- **Preview**: For testing updates before production
- **Production**: For live app updates

### Update Policies
- Runtime version policy: `appVersion` - Updates are compatible within the same app version
- Automatic updates: Enabled by default
- Fallback: App will fall back to bundled version if update fails

## Build Configuration Details

### Resource Classes
- **m-medium**: Standard build resources for most apps
- Upgrade to **m-large** if builds fail due to memory constraints

### Build Types
- **APK**: For internal distribution and testing
- **AAB**: For Google Play Store submission (required)

### Distribution
- **Internal**: For team testing
- **Store**: For app store submission

## Monitoring and Analytics

### Build Status
Monitor builds at: https://expo.dev/accounts/[username]/projects/cartographer-app/builds

### Update Analytics
View update adoption at: https://expo.dev/accounts/[username]/projects/cartographer-app/updates

## Troubleshooting

### Common Issues

1. **Mapbox Token Issues**
   - Ensure tokens are valid and have correct permissions
   - Check token expiration dates
   - Verify download token is set in EAS secrets

2. **Location Permissions**
   - iOS: Ensure Info.plist descriptions are clear and compliant
   - Android: Verify all required permissions are declared

3. **Build Failures**
   - Check build logs for specific errors
   - Ensure all dependencies are compatible
   - Verify native code compilation

4. **Update Failures**
   - Check runtime version compatibility
   - Verify update bundle integrity
   - Test update on development build first

### Support Resources
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [EAS Update Documentation](https://docs.expo.dev/eas-update/introduction/)
- [Expo Community Forums](https://forums.expo.dev/)