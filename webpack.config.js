/* eslint-disable */
const { resolve, join } = require('path');
const merge = require('webpack-merge');
/* eslint-enable */

const INCLUDE = resolve(__dirname, 'src');

const dev = process.env.ENV === 'dev';

const config = {
  mode: dev ? 'development' : 'production',

  devtool: dev ? 'inline-source-map' : 'source-map',

  output: {
    path: resolve(__dirname, 'build'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],

        include: INCLUDE,
      },
    ],
  },

  node: {
    __dirname: false,
    __filename: false,
  },

  resolve: {
    modules: ['node_modules'],
    extensions: ['.js', '.ts', '.json'],
    alias: {
      '~': INCLUDE,
    },
  },
};

function getConfig(...cfg) {
  return merge(config, ...cfg);
}

const mainConfig = getConfig({
  target: 'electron-main',

  watch: dev,

  entry: {
    index: './src',
  },

  plugins: [],
});

const preloadsConfig = getConfig({
  target: 'electron-renderer',

  watch: dev,

  entry: {
    preload: './src/renderer',
  },

  plugins: [],

  output: {
    libraryTarget: 'var',
  },
});

module.exports = [mainConfig, preloadsConfig];
