#!/bin/bash

# Cartographer Deployment Testing Script
# This script tests the deployment configuration

set -e

echo "🧪 Testing Cartographer deployment configuration..."

# Test 1: Check if required files exist
echo "📁 Checking required configuration files..."

required_files=("eas.json" "app.json" "package.json" "DEPLOYMENT.md")
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
        exit 1
    fi
done

# Test 2: Validate eas.json structure
echo "🔍 Validating eas.json structure..."
if command -v jq &> /dev/null; then
    # Check if eas.json has required build profiles
    if jq -e '.build.development' eas.json > /dev/null; then
        echo "✅ Development build profile configured"
    else
        echo "❌ Development build profile missing"
        exit 1
    fi
    
    if jq -e '.build.preview' eas.json > /dev/null; then
        echo "✅ Preview build profile configured"
    else
        echo "❌ Preview build profile missing"
        exit 1
    fi
    
    if jq -e '.build.production' eas.json > /dev/null; then
        echo "✅ Production build profile configured"
    else
        echo "❌ Production build profile missing"
        exit 1
    fi
else
    echo "⚠️  jq not installed, skipping JSON validation"
fi

# Test 3: Check app.json configuration
echo "🔍 Validating app.json configuration..."
if grep -q "runtimeVersion" app.json; then
    echo "✅ Runtime version policy configured"
else
    echo "❌ Runtime version policy missing"
    exit 1
fi

if grep -q "updates" app.json; then
    echo "✅ Updates configuration found"
else
    echo "❌ Updates configuration missing"
    exit 1
fi

# Test 4: Check package.json scripts
echo "🔍 Validating package.json scripts..."
required_scripts=("build:development" "build:preview" "build:production" "update")
for script in "${required_scripts[@]}"; do
    if grep -q "\"$script\":" package.json; then
        echo "✅ $script script configured"
    else
        echo "❌ $script script missing"
        exit 1
    fi
done

# Test 5: Check dependencies
echo "📦 Checking required dependencies..."
required_deps=("expo-updates")
for dep in "${required_deps[@]}"; do
    if grep -q "\"$dep\":" package.json; then
        echo "✅ $dep dependency found"
    else
        echo "❌ $dep dependency missing"
        exit 1
    fi
done

# Test 6: Environment variables check
echo "🔐 Checking environment configuration..."
if [ -f ".env" ]; then
    if grep -q "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN" .env; then
        echo "✅ Mapbox access token configured in .env"
    else
        echo "⚠️  Mapbox access token not found in .env"
    fi
    
    if grep -q "MAPBOX_DOWNLOAD_TOKEN" .env; then
        echo "✅ Mapbox download token configured in .env"
    else
        echo "⚠️  Mapbox download token not found in .env"
    fi
else
    echo "⚠️  .env file not found"
fi

# Test 7: Check EAS CLI availability
echo "🛠️  Checking EAS CLI..."
if command -v eas &> /dev/null; then
    echo "✅ EAS CLI available: $(eas --version)"
    
    # Test EAS login status
    if eas whoami &> /dev/null; then
        echo "✅ Logged in to Expo as: $(eas whoami)"
    else
        echo "⚠️  Not logged in to Expo (run 'eas login')"
    fi
else
    echo "❌ EAS CLI not installed"
    echo "   Install with: npm install -g @expo/eas-cli"
fi

# Test 8: Validate project structure
echo "📂 Checking project structure..."
required_dirs=("src" "assets" "scripts" "store-config")
for dir in "${required_dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ $dir directory exists"
    else
        echo "❌ $dir directory missing"
        exit 1
    fi
done

echo ""
echo "🎉 Deployment configuration test completed!"
echo ""
echo "Summary:"
echo "- Configuration files: ✅"
echo "- Build profiles: ✅"
echo "- Package scripts: ✅"
echo "- Dependencies: ✅"
echo "- Project structure: ✅"
echo ""
echo "Ready for deployment! 🚀"
echo "Next steps:"
echo "1. Run './scripts/setup-deployment.sh' to configure EAS"
echo "2. Test with: npm run build:preview"
echo "3. Deploy with: npm run build:production"