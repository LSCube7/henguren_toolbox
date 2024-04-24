<template>
  <div>
    <HeaderComponent @open-changelog="openChangeLogDialog" @open-colorpicker="openColorPickerDialog" />
    <div id="container">
      <router-view /> <!-- 这里显示路由匹配的组件 -->
    </div>
    <FooterComponent /> <!-- FooterComponent 是你的底部组件 -->
    <!-- 使用 v-if 控制 ChangeLogDialog 的显示与隐藏 -->
    <ChangeLog v-if="isChangeLogVisible" @close="closeChangeLogDialog" />
    <!-- 使用 v-if 控制 ColorPicker 的显示与隐藏 -->
    <ColorPicker v-if="isColorPickerVisible" @close="closeColorPickerDialog" :showColorPicker="isColorPickerVisible" />

  </div>
</template>

<script>
import FooterComponent from '@/components/FooterComponent.vue'; // 导入底部组件
import HeaderComponent from '@/components/HeaderComponent.vue';
import ChangeLog from '@/components/ChangeLog.vue'; // 导入更新日志组件
import ColorPicker from '@/components/ColorPicker.vue'; // 导入颜色选择器组件

export default {
  components: {
    FooterComponent,
    HeaderComponent,
    ChangeLog,
    ColorPicker // 注册 ColorPicker 组件
  },
  data() {
    return {
      isChangeLogVisible: false,
      isColorPickerVisible: false,
      currentAppVersion: '2.2.1'
    };
  },
  mounted() {
    this.applyInitialColors();
    // 检查是否是第一次打开应用程序或者版本更新后第一次打开
    const viewedChangeLog = localStorage.getItem("viewedChangeLog");
    const lastViewedVersion = localStorage.getItem("lastViewedVersion");
    if (!viewedChangeLog || lastViewedVersion !== this.currentAppVersion) {
      // 如果是第一次打开应用程序或者版本更新后第一次打开，则显示更新日志
      this.openChangeLogDialog();
    }
  },
  methods: {
    openChangeLogDialog() {
      // 打开更新日志
      this.isChangeLogVisible = true;
      // 将状态标记为已查看，并保存当前应用程序版本号
      localStorage.setItem("viewedChangeLog", true);
      localStorage.setItem("lastViewedVersion", this.currentAppVersion);
    },
    closeChangeLogDialog() {
      // 关闭更新日志
      this.isChangeLogVisible = false;
    },
    openColorPickerDialog() {
      // 打开颜色选择器
      this.isColorPickerVisible = true;

    },
    closeColorPickerDialog() {
      // 关闭颜色选择器
      this.isColorPickerVisible = false;
    },
    applyInitialColors() {
      const colorKeys = [
        '--primary-color', '--secondary-color', '--text-color',
        '--primary-background-color', '--secondary-background-color', '--border-color'
      ];
      colorKeys.forEach(key => {
        const savedColor = localStorage.getItem(key);
        if (savedColor) {
          document.documentElement.style.setProperty(key, savedColor);
        }
      });
    },
  }
};
</script>

<style>
/* 全局样式 */
html {
  font-family: "Microsoft YaHei UI", Arial, sans-serif;
  margin: 0;
  padding: 0;
  /* 使用 CSS 变量定义颜色 */
  --primary-color: #5bcefa;
  --secondary-color: #f6a8b8;
  --text-color: #333;
  --primary-background-color: #f0f2f5;
  --secondary-background-color: #f9f9f9;
  --border-color: #ccc;
  --hover-color: #4ab3d1;
  /* 悬停颜色 */
  background-color: var(--primary-background-color);


}

#container {
  max-width: 75rem;
  margin: 1.25rem auto;
  padding: 1.25rem;
  background-color: #fff;
  border-radius: 0.5rem;
  box-shadow: 0 0 0.625rem rgba(0, 0, 0, 0.1);
}

footer p {
  color: var(--text-color);
}

footer {
  font-size: 95%;
  text-align: center;
}
</style>
