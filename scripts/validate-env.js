#!/usr/bin/env node

/**
 * Environment Configuration Validation Script
 * 
 * This script validates that all required environment variables are properly configured
 * for the specified environment (development, preview, production).
 */

const fs = require('fs');
const path = require('path');

// Required environment variables for each environment
const REQUIRED_VARS = {
  development: [
    'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN',
    'MAPBOX_DOWNLOAD_TOKEN',
    'EXPO_PUBLIC_ENVIRONMENT',
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_DEBUG_MODE',
    'EXPO_PUBLIC_LOG_LEVEL'
  ],
  preview: [
    'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN',
    'MAPBOX_DOWNLOAD_TOKEN',
    'EXPO_PUBLIC_ENVIRONMENT',
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_DEBUG_MODE',
    'EXPO_PUBLIC_LOG_LEVEL',
    'EXPO_PUBLIC_ENABLE_PERFORMANCE_MONITORING',
    'EXPO_PUBLIC_ENABLE_CRASH_REPORTING'
  ],
  production: [
    'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN',
    'MAPBOX_DOWNLOAD_TOKEN',
    'EXPO_PUBLIC_ENVIRONMENT',
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_DEBUG_MODE',
    'EXPO_PUBLIC_LOG_LEVEL',
    'EXPO_PUBLIC_ENABLE_PERFORMANCE_MONITORING',
    'EXPO_PUBLIC_ENABLE_CRASH_REPORTING',
    'EXPO_PUBLIC_ANALYTICS_ENABLED'
  ]
};

// Mapbox token validation patterns
const MAPBOX_PUBLIC_TOKEN_PATTERN = /^pk\./;
const MAPBOX_SECRET_TOKEN_PATTERN = /^sk\./;

function loadEnvFile(envFile) {
  if (!fs.existsSync(envFile)) {
    throw new Error(`Environment file not found: ${envFile}`);
  }

  const content = fs.readFileSync(envFile, 'utf8');
  const env = {};

  content.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  return env;
}

function validateMapboxTokens(env) {
  const errors = [];

  // Validate public access token
  const publicToken = env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!publicToken) {
    errors.push('EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is required');
  } else if (!MAPBOX_PUBLIC_TOKEN_PATTERN.test(publicToken)) {
    errors.push('EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN must start with "pk."');
  }

  // Validate download token
  const downloadToken = env.MAPBOX_DOWNLOAD_TOKEN;
  if (!downloadToken) {
    errors.push('MAPBOX_DOWNLOAD_TOKEN is required');
  } else if (!MAPBOX_SECRET_TOKEN_PATTERN.test(downloadToken)) {
    errors.push('MAPBOX_DOWNLOAD_TOKEN must start with "sk."');
  }

  return errors;
}

function validateEnvironment(environment) {
  console.log(`\n🔍 Validating ${environment} environment configuration...`);

  const envFile = path.join(process.cwd(), `.env.${environment}`);
  const errors = [];

  try {
    // Load environment file
    const env = loadEnvFile(envFile);
    console.log(`✅ Environment file loaded: ${envFile}`);

    // Check required variables
    const requiredVars = REQUIRED_VARS[environment] || [];
    const missingVars = requiredVars.filter(varName => !env[varName]);

    if (missingVars.length > 0) {
      errors.push(`Missing required variables: ${missingVars.join(', ')}`);
    }

    // Validate Mapbox tokens
    const mapboxErrors = validateMapboxTokens(env);
    errors.push(...mapboxErrors);

    // Environment-specific validations
    if (environment === 'production') {
      if (env.EXPO_PUBLIC_DEBUG_MODE === 'true') {
        errors.push('DEBUG_MODE should be false in production');
      }
      if (env.EXPO_PUBLIC_LOG_LEVEL === 'debug') {
        errors.push('LOG_LEVEL should not be debug in production');
      }
    }

    // Report results
    if (errors.length === 0) {
      console.log(`✅ ${environment} environment configuration is valid`);
      return true;
    } else {
      console.log(`❌ ${environment} environment configuration has errors:`);
      errors.forEach(error => console.log(`   - ${error}`));
      return false;
    }

  } catch (error) {
    console.log(`❌ Failed to validate ${environment} environment: ${error.message}`);
    return false;
  }
}

function main() {
  const environment = process.argv[2] || 'development';
  
  console.log('🚀 Cartographer Environment Configuration Validator');
  console.log('==================================================');

  if (!['development', 'preview', 'production'].includes(environment)) {
    console.error('❌ Invalid environment. Use: development, preview, or production');
    process.exit(1);
  }

  const isValid = validateEnvironment(environment);
  
  if (!isValid) {
    console.log('\n💡 Tips:');
    console.log('   - Ensure all required environment variables are set');
    console.log('   - Check that Mapbox tokens are valid and have correct prefixes');
    console.log('   - Verify API URLs are accessible');
    console.log('   - Review production-specific settings');
    process.exit(1);
  }

  console.log(`\n🎉 ${environment} environment is ready for deployment!`);
}

if (require.main === module) {
  main();
}

module.exports = { validateEnvironment, loadEnvFile };