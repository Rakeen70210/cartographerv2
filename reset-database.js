#!/usr/bin/env node

/**
 * Simple script to reset the database and trigger first-launch initialization
 * This will create test explored areas so you can see the fog effect
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🗄️ Resetting database to trigger first-launch initialization...');

try {
  // For Android emulator, clear the app data
  console.log('📱 Clearing Android app data...');
  execSync('adb shell pm clear com.cartographer.app', { stdio: 'inherit' });
  
  console.log('✅ Database reset complete!');
  console.log('🚀 Next time you start the app, it will:');
  console.log('   - Initialize the database');
  console.log('   - Create test explored areas');
  console.log('   - Load them into Redux');
  console.log('   - Display the Skia fog overlay');
  console.log('');
  console.log('💡 Run: npm run android');
  
} catch (error) {
  console.error('❌ Failed to reset database:', error.message);
  console.log('');
  console.log('💡 Alternative: Uninstall and reinstall the app manually');
  console.log('   - Long press the app icon');
  console.log('   - Select "Uninstall"');
  console.log('   - Run: npm run android');
}