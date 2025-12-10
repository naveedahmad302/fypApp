const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const { withNativeWind } = require("nativewind/metro");

const defaultConfig = getDefaultConfig(__dirname);

const config = mergeConfig(defaultConfig, {});

module.exports = withNativeWind(config, {
  input: "./global.css"
});
