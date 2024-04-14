<template>
    <header class="header">
      <div class="left">
        <!-- LOGO -->
        <router-link to="/" class="logo-link">
          <img src="@/assets/png/android-chrome-512x512.png" alt="Logo" class="logo">
        </router-link>
        <!-- 标题 -->
        <h1 class="title" @click="goHome">恨古人工具箱</h1>
      </div>
      <div class="right">
        <!-- GitHub图标 -->
        <a href="https://github.com/LSCube7/henguren_toolbox" target="_blank" class="github-link">
          <img src="@/assets/png/github.png" alt="GitHub" class="github-icon">
        </a>
        <!-- ChangeLog 触发按钮 -->
        <!-- <button @click="showChangeLog">ChangeLog</button> -->
      </div>
    </header>
    <ChangeLog />
  </template>
  
  <script>
  //import ChangeLog from '@/components/ChangeLog.vue'; // 导入 ChangeLog 组件
  
  export default {
    components: {
      //ChangeLog
    },
    methods: {
      goHome() {
        this.$router.push('/');
      },
      /* showChangeLog() {
        // 在此处触发显示 ChangeLog 弹窗的逻辑
        // 可以通过事件或状态管理器来实现
        // 这里简单起见，直接使用事件触发显示
        this.$emit('showChangeLog');
      } */
    }
  };
  </script>
  
  <style scoped>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #fff;
    color: #000;
    padding: 10px;
    border-radius: 10px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s, box-shadow 0.3s; /* 添加过渡效果 */
  }
  .header:hover {
    transform: scale(1.005);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
  
  .left {
    display: flex;
    align-items: center;
  }
  
  .logo-link {
    text-decoration: none;
  }
  
  .logo {
    width: 40px;
    height: auto;
    margin-right: 10px;
  }
  
  .title {
    font-size: 24px;
    margin: 0;
    cursor: pointer; /* 添加鼠标指针 */
  }
  .title:hover {
    color: #5bcefa;
  }
  
  .right {
    display: flex;
    align-items: center;
  }
  
  .github-link {
    text-decoration: none;
  }
  
  .github-icon {
    width: 40px;
    height: auto;
  }
  </style>
  