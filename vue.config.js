const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  transpileDependencies: true,

  pwa: {
    name: "恨古人工具箱",
    themeColor: "#000000",
    msTileColor: "#5bcefa",
  },

  pluginOptions: {
    "style-resources-loader": {
      preProcessor: "sass",
      patterns: ["./src/assets/colors.scss"],
    },
  },
});
