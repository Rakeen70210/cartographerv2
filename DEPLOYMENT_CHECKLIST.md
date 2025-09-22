# Cartographer Deployment Checklist

Use this checklist to ensure all deployment requirements are met before releasing the app.

## Pre-Deployment Setup

### 1. Environment Configuration
- [ ] Mapbox access tokens configured in EAS secrets
- [ ] Environment variables set in `.env` file for local development
- [ ] Project ID updated in `app.json` (replace `[project-id]`)
- [ ] Expo username updated in `app.json` and plugin configurations

### 2. App Store Preparation
- [ ] App icons and splash screens created and optimized
- [ ] App store metadata prepared (see `store-config/app-store-metadata.json`)
- [ ] Privacy policy and support URLs configured
- [ ] App store screenshots and promotional materials ready

### 3. iOS Specific
- [ ] Apple Developer Account active
- [ ] iOS Distribution Certificate configured
- [ ] Provisioning profiles set up
- [ ] Bundle identifier matches Apple Developer Console
- [ ] Location permission descriptions are clear and compliant
- [ ] Background location usage justified in App Store review notes

### 4. Android Specific
- [ ] Google Play Console account active
- [ ] Android keystore generated and secured
- [ ] Package name matches Google Play Console
- [ ] Location permissions properly declared
- [ ] Target SDK version meets Google Play requirements

## Build Testing

### 5. Development Build Testing
- [ ] Run `npm run build:development` successfully
- [ ] Install and test development build on physical devices
- [ ] Verify location services work correctly
- [ ] Test fog clearing animations and performance
- [ ] Validate database operations and data persistence

### 6. Preview Build Testing
- [ ] Run `npm run build:preview` successfully
- [ ] Test preview build with production-like configuration
- [ ] Verify over-the-air updates work correctly
- [ ] Test offline functionality and map caching
- [ ] Performance testing on various device types

### 7. Production Build Testing
- [ ] Run `npm run build:production` successfully
- [ ] Final testing on production build
- [ ] Verify all features work without development tools
- [ ] Test app store compliance (no debug features visible)

## Deployment Process

### 8. Initial Release
- [ ] Create production builds for both platforms
- [ ] Submit iOS app to App Store Connect
- [ ] Submit Android app to Google Play Console
- [ ] Configure app store listings with metadata
- [ ] Set up app store review process

### 9. Over-the-Air Updates
- [ ] Test update mechanism with preview channel
- [ ] Verify update compatibility with existing installations
- [ ] Configure update rollout strategy
- [ ] Set up monitoring for update adoption rates

### 10. Post-Deployment
- [ ] Monitor crash reports and user feedback
- [ ] Set up analytics and performance monitoring
- [ ] Prepare hotfix deployment process
- [ ] Document known issues and workarounds

## Compliance and Legal

### 11. Privacy and Security
- [ ] Privacy policy covers location data usage
- [ ] Data retention policies implemented
- [ ] User consent mechanisms in place
- [ ] Security audit of location data handling

### 12. App Store Guidelines
- [ ] iOS App Store Review Guidelines compliance
- [ ] Google Play Developer Policy compliance
- [ ] Location services usage clearly explained to users
- [ ] No prohibited content or functionality

## Monitoring and Maintenance

### 13. Release Monitoring
- [ ] Set up crash reporting (Expo Crashlytics)
- [ ] Configure performance monitoring
- [ ] Monitor app store reviews and ratings
- [ ] Track key metrics (DAU, retention, exploration stats)

### 14. Update Strategy
- [ ] Plan regular update schedule
- [ ] Prepare feature roadmap
- [ ] Set up beta testing program
- [ ] Configure automated deployment pipeline

## Emergency Procedures

### 15. Rollback Plan
- [ ] Document rollback procedures for failed updates
- [ ] Prepare emergency contact information
- [ ] Set up monitoring alerts for critical issues
- [ ] Plan communication strategy for major issues

---

## Quick Commands Reference

```bash
# Setup deployment
./scripts/setup-deployment.sh

# Test configuration
./scripts/test-deployment.sh

# Build commands
npm run build:development
npm run build:preview
npm run build:production

# Platform-specific builds
npm run build:ios
npm run build:android

# Submit to stores
npm run submit:ios
npm run submit:android

# Over-the-air updates
npm run update
npm run update:preview
npm run update:production
```

## Support Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [EAS Update Documentation](https://docs.expo.dev/eas-update/introduction/)
- [iOS App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Developer Policies](https://play.google.com/about/developer-content-policy/)

---

**Note**: This checklist should be reviewed and updated regularly as deployment requirements and best practices evolve.