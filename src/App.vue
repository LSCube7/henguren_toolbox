<template>
  <div>
    <HeaderComponent @showChangeLog="showChangeLogDialog" />
    <div id="container">
      <router-view /> <!-- 这里显示路由匹配的组件 -->
    </div>
    <FooterComponent /> <!-- FooterComponent 是你的底部组件 -->
    <!-- 使用 v-if 控制 ChangeLogDialog 的显示与隐藏 -->
    <ChangeLog v-if="isChangeLogVisible" @close="hideChangeLogDialog" />
  </div>
</template>

<script>
import FooterComponent from '@/components/FooterComponent.vue'; // 导入底部组件
import HeaderComponent from '@/components/HeaderComponent.vue';
// import ChangeLog from '@/components/ChangeLog.vue'; // 导入 ChangeLogDialog 组件

export default {
  components: {
    FooterComponent,
    HeaderComponent,
    // ChangeLog
  },
  data() {
    return {
     // isChangeLogVisible: false // 添加 isChangeLogVisible 变量，用于控制 ChangeLog 的显示和隐藏
    };
  },
 /* methods: {
    showChangeLogDialog() {
      this.isChangeLogVisible = true; // 使用 isChangeLogVisible 控制 ChangeLog 的显示
    },
    hideChangeLogDialog() {
      this.isChangeLogVisible = false; // 使用 isChangeLogVisible 控制 ChangeLog 的隐藏
    }
  } */
};
</script>



<style>
/* 全局样式 */
html {
  font-family: "Microsoft YaHei UI", Arial, sans-serif;
  margin: 0;
  padding: 0;
  background-color: #f0f2f5;
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
  color: #000;
}
footer {
  font-size: 95%;
  text-align: center;
}
.change {
  text-decoration: none;
  color: #333;
  font-weight: bold;
}
.change:hover {
  color: #5bcefa;
  font-weight: bolder;
}
</style>
