// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// ─── Local Expo Module Resolution ─────────────────────────────────
// Ensures 'expo-module-lockin' resolves reliably across all platforms
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'expo-module-lockin': path.resolve(__dirname, 'modules/expo-module-lockin/src'),
};

// ─── expo-sqlite Web WASM support ─────────────────────────────────
// expo-sqlite@57 imports ./wa-sqlite/wa-sqlite.wasm as an asset.
// Metro does not include .wasm in assetExts by default, causing
// "Unable to resolve module ./wa-sqlite/wa-sqlite.wasm" on Web.
config.resolver.assetExts.push('wasm');
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

// ─── SharedArrayBuffer headers (Web dev server only) ──────────────
// expo-sqlite's Web worker uses SharedArrayBuffer for synchronous
// communication. SharedArrayBuffer requires cross-origin isolation
// headers (COOP + COEP) to be present on every response.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Required for SharedArrayBuffer availability in the browser
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
