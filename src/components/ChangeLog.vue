<template>
  <div v-if="showChangeLog" class="change-log-wrapper">
    <div class="change-log">
      <div class="change-log-content" v-html="changeLogHtml"></div>
      <button @click="dismissChangeLog" class="close-button">关闭</button>
    </div>
  </div>
</template>
<script>
export default {
  data() {
    return {
      showChangeLog: false,
      changeLogHtml: '' // ChangeLog HTML内容将在 mounted 钩子中填充
    };
  },
  mounted() {
    // 发起网络请求获取 ChangeLog HTML内容
    fetch('../ChangeLog.html')
      .then(response => response.text())
      .then(html => {
        this.changeLogHtml = html;
        // 检查本地存储是否已经查看过版本更新
        const viewedChangeLog = localStorage.getItem("viewedChangeLog");
        if (!viewedChangeLog) {
          // 如果未查看过，则显示 ChangeLog
          this.showChangeLog = true;
        }
      })
      .catch(error => {
        console.error('Error fetching ChangeLog HTML:', error);
      });
  },
  methods: {
    dismissChangeLog() {
      // 隐藏 ChangeLog，并将状态标记为已查看
      this.showChangeLog = false;
      localStorage.setItem("viewedChangeLog", true);
    }
  }
};
</script>
<style scoped>
.change-log-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.5);
}

.change-log {
  width: 600px;
  max-height: 400px;
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.close-button {
  padding: 8px 16px;
  background-color: #5bcefa;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.close-button:hover {
  background-color: #4ab3d1;
}

.change-log-content {
  overflow-y: auto;
}
</style>