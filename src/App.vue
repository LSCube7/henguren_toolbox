<template>
  <SpeedInsights />
  <div>
    <!-- 头部组件，监听 open-changelog 和 open-colorpicker 事件 -->
    <HeaderComponent 
      @open-changelog="openChangeLogDialog" 
      @open-colorpicker="openColorPickerDialog" 
    />
    <div id="container">
      <router-view /> <!-- 路由匹配的组件 -->
    </div>
    <FooterComponent /> <!-- 底部组件 -->

    <!-- 更新日志弹窗 -->
    <ChangeLog 
      v-if="isChangeLogVisible" 
      @close="closeChangeLogDialog"
      :showChangeLog="isChangeLogVisible" 
    />

    <!-- 颜色选择器弹窗 -->
    <ColorPicker 
      v-if="isColorPickerVisible" 
      @close="closeColorPickerDialog" 
      :showColorPicker="isColorPickerVisible" 
    />
  </div>
</template>

<script setup>
import { SpeedInsights } from '@vercel/speed-insights/vue';
</script>

<script>
import FooterComponent from '@/components/FooterComponent.vue';
import HeaderComponent from '@/components/HeaderComponent.vue';
import ChangeLog from '@/components/ChangeLog.vue';
import ColorPicker from '@/components/ColorPicker.vue';
import { inject } from '@vercel/analytics';
inject();

export default {
  components: {
    FooterComponent,
    HeaderComponent,
    ChangeLog,
    ColorPicker
  },
  data() {
    return {
      isChangeLogVisible: false, // 控制更新日志弹窗的显示
      isColorPickerVisible: false, // 控制颜色选择器弹窗的显示
      currentAppVersion: '2.4.0' // 当前应用版本
    };
  },
  mounted() {
    this.applyInitialColors();

    // 检查是否需要显示更新日志
    const viewedChangeLog = localStorage.getItem("viewedChangeLog");
    const lastViewedVersion = localStorage.getItem("lastViewedVersion");
    if (!viewedChangeLog || lastViewedVersion !== this.currentAppVersion) {
      this.openChangeLogDialog();
    }
  },
  methods: {
    openChangeLogDialog() {
      // 打开更新日志弹窗
      this.isChangeLogVisible = true;
      localStorage.setItem("viewedChangeLog", true);
      localStorage.setItem("lastViewedVersion", this.currentAppVersion);
    },
    closeChangeLogDialog() {
      // 关闭更新日志弹窗
      this.isChangeLogVisible = false;
    },
    openColorPickerDialog() {
      // 打开颜色选择器弹窗
      this.isColorPickerVisible = true;
    },
    closeColorPickerDialog() {
      // 关闭颜色选择器弹窗
      this.isColorPickerVisible = false;
    },
    applyInitialColors() {
      // 应用保存的颜色设置
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
  --primary-color: #5bcefa;
  --secondary-color: #f6a8b8;
  --text-color: #333;
  --primary-background-color: #f0f2f5;
  --secondary-background-color: #f9f9f9;
  --border-color: #ccc;
  --hover-color: #4ab3d1;
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
