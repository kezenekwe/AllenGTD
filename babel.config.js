module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Required for WatermelonDB decorators (@field, @date, etc.)
    ['@babel/plugin-proposal-decorators', {legacy: true}],
    // Path aliases matching tsconfig
    [
      'module-resolver',
      {
        root: ['./'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          '@screens': './src/screens',
          '@components': './src/components',
          '@services': './src/services',
          '@hooks': './src/hooks',
          '@types': './src/types',
          '@utils': './src/utils',
          '@navigation': './src/navigation',
        },
      },
    ],
  ],
};
