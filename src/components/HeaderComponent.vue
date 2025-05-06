<template>
  <header class="header">
    <div class="left">
      <!-- LOGO -->
      <router-link to="/" class="logo-link">
        <img src="@/assets/png/henguren-horizontal.svg" alt="Logo" class="logo">
      </router-link>
    </div>
    <div class="right">
      <!-- 更新日志按钮 -->

      <button @click="openColorPicker" class="color-picker-button">设置</button>
      <button @click="openChangeLog" class="change-log-button">更新日志</button>
      <!-- GitHub图标 -->
      <a href="https://github.com/LSCube7/henguren_toolbox" target="_blank" class="github-link">
        <img src="@/assets/png/github.svg" alt="GitHub" class="github-icon">
      </a>
      <!-- 新增按钮：打开颜色选择器 -->
    </div>
  </header>
</template>

<script>
export default {
  methods: {
    goHome() {
      this.$router.push('/');
    },
    openChangeLog() {
      // 触发父组件的方法来显示更新日志
      this.$emit('open-changelog');
    },
    openColorPicker() {
      // 触发父组件的方法来显示颜色选择器
      this.$emit('open-colorpicker');
    }
  }
};
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--background-color);
  color: var(--text-color);
  padding: 0.625rem;
  border-radius: 0.625rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
  transition: transform 0.3s, box-shadow 0.3s;
  /* 添加过渡效果 */
}

.header:hover {
  transform: scale(1.005);
  box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.2);
}

.left {
  display: flex;
  align-items: center;
}

.logo-link {
  text-decoration: none;
}

.logo {
  width: 10rem;
  height: auto;
  margin-right: 0.625rem;
}

.title {
  font-size: larger;
  margin: 0;
  cursor: pointer;
  /* 添加鼠标指针 */
}

.title:hover {
  color: var(--primary-color);
}

.right {
  display: flex;
  align-items: center;
}

.github-link {
  text-decoration: none;
}

.github-icon {
  width: 2.5rem;
  height: auto;
}

.change-log-button {
  padding: 0.5rem 1rem;
  background-color: var(--background-color);
  color: var(--text-color);
  font-weight: bold;
  font-size: large;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.3s;
}

.change-log-button:hover {
  background-color: var(--background-color);
  color: var(--primary-color);
}

/* 新增的按钮样式 */
.color-picker-button {
  padding: 0.5rem 1rem;
  background-color: var(--background-color);
  color: var(--text-color);
  font-weight: bold;
  font-size: large;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.3s;
  margin-left: 0.625rem;
  /* 为了与其他按钮分隔开 */
}

.color-picker-button:hover {
  background-color: var(--background-color);
  color: var(--primary-color);
}
</style>