module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': '.',
          },
          extensions: ['.jsx', '.js', '.json', '.ts', '.tsx'],
        },
      ],
    ],
  };
};
