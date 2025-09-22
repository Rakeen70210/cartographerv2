#!/bin/bash

# Cartographer EAS Deployment Setup Script
# This script helps configure the project for EAS deployment

set -e

echo "🚀 Setting up Cartographer for EAS deployment..."

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI not found. Installing..."
    npm install -g @expo/eas-cli
else
    echo "✅ EAS CLI found"
fi

# Check if user is logged in
if ! eas whoami &> /dev/null; then
    echo "🔐 Please log in to Expo:"
    eas login
else
    echo "✅ Logged in to Expo as: $(eas whoami)"
fi

# Initialize EAS project if not already done
if [ ! -f "eas.json" ]; then
    echo "📝 Initializing EAS project..."
    eas build:configure
else
    echo "✅ EAS project already configured"
fi

# Check for required environment variables
echo "🔍 Checking environment configuration..."

if [ -z "$EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN" ]; then
    echo "⚠️  EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN not set in environment"
    echo "   Please add it to your .env file or EAS secrets"
fi

if [ -z "$MAPBOX_DOWNLOAD_TOKEN" ]; then
    echo "⚠️  MAPBOX_DOWNLOAD_TOKEN not set in environment"
    echo "   Please add it to your .env file or EAS secrets"
fi

# Offer to set up EAS secrets
read -p "🔑 Would you like to set up EAS secrets for Mapbox tokens? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Setting up EAS secrets..."
    
    read -p "Enter your Mapbox public access token: " MAPBOX_PUBLIC_TOKEN
    read -p "Enter your Mapbox download token: " MAPBOX_DOWNLOAD_TOKEN
    
    eas secret:create --scope project --name EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN --value "$MAPBOX_PUBLIC_TOKEN"
    eas secret:create --scope project --name MAPBOX_DOWNLOAD_TOKEN --value "$MAPBOX_DOWNLOAD_TOKEN"
    
    echo "✅ EAS secrets configured"
fi

# Update app.json with user's Expo username
EXPO_USERNAME=$(eas whoami)
echo "📝 Updating app.json with Expo username: $EXPO_USERNAME"

# Use sed to update the owner field (works on both macOS and Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"owner\": \"your-expo-username\"/\"owner\": \"$EXPO_USERNAME\"/" app.json
    sed -i '' "s/\"username\": \"your-expo-username\"/\"username\": \"$EXPO_USERNAME\"/" app.json
else
    # Linux
    sed -i "s/\"owner\": \"your-expo-username\"/\"owner\": \"$EXPO_USERNAME\"/" app.json
    sed -i "s/\"username\": \"your-expo-username\"/\"username\": \"$EXPO_USERNAME\"/" app.json
fi

echo "✅ app.json updated with your Expo username"

# Install dependencies if needed
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🎉 Deployment setup complete!"
echo ""
echo "Next steps:"
echo "1. Update the project ID in app.json updates.url"
echo "2. Configure iOS/Android credentials if needed"
echo "3. Run your first build: npm run build:preview"
echo ""
echo "For detailed instructions, see DEPLOYMENT.md"