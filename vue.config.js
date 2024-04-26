const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  transpileDependencies: true,

  pwa: {
    name: "恨古人工具箱",
    themeColor: "#000000",
    msTileColor: "#5bcefa",
    updatePopup: {
      message: "发现新内容可用",
      buttonText: "刷新"
    }
  },


});
