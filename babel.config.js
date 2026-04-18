module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // NativeWind babel plugins — inlined from nativewind/babel (react-native-css-interop/babel)
    // to avoid the unconditional 'react-native-worklets/plugin' that conflicts with
    // react-native-reanimated 3.x (which bundles worklets internally).
    require('react-native-css-interop/dist/babel-plugin').default,
    [
      '@babel/plugin-transform-react-jsx',
      {
        runtime: 'automatic',
        importSource: 'react-native-css-interop',
      },
    ],
    // reanimated plugin must be listed last
    'react-native-reanimated/plugin',
  ],
};
