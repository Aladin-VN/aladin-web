const { getDefaultConfig, mergeConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * Metro configuration for ALADIN B2B Mobile.
 *
 * - Adds CSS support for NativeWind
 * - Configures the NativeWind Metro transformer
 * - Adds asset extensions for fonts and images
 */
const config = {
  transformer: {
    // Use NativeWind's Metro transformer to process Tailwind CSS classes
    babelTransformerPath: require.resolve('nativewind/metro/transformer'),
    // Enable minification in production
    minifierPath: 'metro-minify-terser',
    minifierConfig: {
      compress: {
        drop_console: true,
      },
    },
  },
  resolver: {
    // Add CSS as a recognized source extension
    sourceExts: [
      'js',
      'jsx',
      'ts',
      'tsx',
      'json',
      'css', // Required by NativeWind
    ],
    // Ensure CSS files resolve correctly
    assetExts: defaultConfig.resolver.assetExts.filter(
      (ext) => ext !== 'svg'
    ),
    // Preserve the default .ico and other asset extensions
    ...defaultConfig.resolver,
  },
};

module.exports = mergeConfig(defaultConfig, config);
