const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `expo-sqlite` web uses a `.wasm` asset (wa-sqlite). Metro must treat `.wasm` as an asset.
config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, 'wasm']));

module.exports = config;

