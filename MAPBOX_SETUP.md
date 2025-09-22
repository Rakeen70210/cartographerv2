# Mapbox Setup Guide

This guide will help you configure Mapbox API keys for the Cartographer app.

## Prerequisites

You need a Mapbox account to get the required API tokens. If you don't have one:
1. Go to [mapbox.com](https://www.mapbox.com/)
2. Sign up for a free account
3. Navigate to your [Access Tokens page](https://account.mapbox.com/access-tokens/)

## Required Tokens

### 1. Public Access Token (EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN)
- **Purpose**: Used by the app for map rendering and API calls
- **Format**: Starts with `pk.`
- **Scope**: Public (can be included in client-side code)
- **Where to get**: Account → Access Tokens → Default Public Token

### 2. Secret Download Token (MAPBOX_DOWNLOAD_TOKEN)  
- **Purpose**: Used during build process to download Mapbox SDK
- **Format**: Starts with `sk.`
- **Scope**: Secret (used only during build)
- **Where to get**: Account → Access Tokens → Create Token → Select "Downloads:Read" scope

## Setup Steps

### 1. Copy Environment Template
```bash
cp .env.example .env
```

### 2. Get Your Tokens
1. Go to [Mapbox Access Tokens](https://account.mapbox.com/access-tokens/)
2. Copy your **Default Public Token** (starts with `pk.`)
3. Create a new token with **Downloads:Read** scope for the download token

### 3. Update .env File
Open `.env` and replace the placeholder values:

```env
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbGV4YW1wbGUifQ.your_actual_token
MAPBOX_DOWNLOAD_TOKEN=sk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbGV4YW1wbGUifQ.your_actual_download_token
```

### 4. Verify Configuration
Start the development server:
```bash
npm start
```

Check the console output for configuration validation messages:
- ✅ Green checkmarks indicate successful configuration
- ❌ Red X marks indicate configuration issues

## Troubleshooting

### "Mapbox access token not configured"
- Ensure your `.env` file exists and contains the tokens
- Verify the token starts with `pk.`
- Restart the development server after making changes

### "Invalid Mapbox access token format"
- Public tokens must start with `pk.`
- Download tokens must start with `sk.`
- Check for extra spaces or characters

### Build Issues
- Ensure `MAPBOX_DOWNLOAD_TOKEN` is set correctly
- The download token needs `Downloads:Read` scope
- Try clearing Expo cache: `expo start --clear`

## Security Notes

- The `.env` file is excluded from git to protect your tokens
- Never commit actual tokens to version control
- Use the `.env.example` file to document required variables
- Public tokens (`pk.`) are safe to use in client-side code
- Keep secret tokens (`sk.`) secure and never expose them publicly

## Testing Your Setup

Once configured, the app will:
1. Validate tokens on startup
2. Display configuration status in console
3. Load the Mapbox map successfully
4. Show proper error messages if tokens are invalid

If you see the map loading correctly, your setup is complete! 🎉