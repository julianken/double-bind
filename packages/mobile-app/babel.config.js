module.exports = {
  presets: ["@react-native/babel-preset"],
  plugins: [
    // Enable support for TypeScript decorators if needed
    // ["@babel/plugin-proposal-decorators", { legacy: true }],

    // react-native-reanimated/plugin MUST be listed last
    "react-native-reanimated/plugin",
  ],
};
