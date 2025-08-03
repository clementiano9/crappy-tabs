const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  // Load environment variables
  require('dotenv').config();
  
  return {
    entry: {
      background: './src/background.js',
      popup: './src/popup.js',
      analytics: './src/analytics.js'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'src/[name].js',
      clean: true
    },
    plugins: [
      // Load environment variables from .env file for webpack processing
      new Dotenv({
        path: './.env',
        systemvars: true, // Load system environment variables as well
        silent: false // Show errors if variables are missing
      }),
      
      // Copy static files to dist folder
      new CopyPlugin({
        patterns: [
          {
            from: 'manifest.json',
            to: 'manifest.json'
          },
          {
            from: 'src/popup.html',
            to: 'src/popup.html'
          },
          {
            from: 'img',
            to: 'img'
          },
          // Copy other JavaScript files needed by importScripts
          {
            from: 'src/update-checker.js',
            to: 'src/update-checker.js'
          },
          {
            from: 'src/update-notification.js',
            to: 'src/update-notification.js'
          },
          // Transform analytics-config.js to inject environment variables
          {
            from: 'src/analytics-config.js',
            to: 'src/analytics-config.js',
            transform(content, path) {
              // Replace process.env references with actual values for Chrome extension compatibility
              let transformed = content.toString()
                .replace(/process\.env\.POSTHOG_API_KEY/g, `"${process.env.POSTHOG_API_KEY || ''}"`)
                .replace(/process\.env\.ANALYTICS_DEBUG/g, `"${process.env.ANALYTICS_DEBUG || 'false'}"`)
                .replace(/process\.env\.NODE_ENV/g, `"${argv.mode || 'development'}"`);
              
              return transformed;
            }
          }
        ]
      })
    ],
    mode: argv.mode,
    devtool: isProduction ? false : 'cheap-module-source-map',
    resolve: {
      fallback: {
        "process": require.resolve("process/browser")
      }
    }
  };
};