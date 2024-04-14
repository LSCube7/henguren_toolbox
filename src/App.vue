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
      currentAppVersion: '2.1.0' // 假设当前应用程序版本号为 1.0.0
    };
  },
  mounted() {
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
    }
  }
};
</script>

<style>
/* 全局样式 */
html {
  font-family: "Microsoft YaHei UI", Arial, sans-serif;
  margin: 0;
  padding: 0;
  background-color: var(--primary-background-color);
}

#container {
  width: 100%;
  max-width: 1200px;
  margin: 20px auto;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

footer p {
  color: var(--text-color);
}

footer {
  font-size: 95%;
  text-align: center;
}
</style>
