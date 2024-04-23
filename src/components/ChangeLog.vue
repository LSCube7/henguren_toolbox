<template>
  <div class="change-log-wrapper">
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
      changeLogHtml: '' // ChangeLog HTML内容将在 mounted 钩子中填充
    };
  },
  mounted() {
    // 发起网络请求获取 ChangeLog HTML内容
    fetch('../ChangeLog.html')
      .then(response => response.text())
      .then(html => {
        this.changeLogHtml = html;
      })
      .catch(error => {
        console.error('Error fetching ChangeLog HTML:', error);
      });
  },
  methods: {
    dismissChangeLog() {
      // 隐藏 ChangeLog
      this.$emit('close');
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
  width: 37.5rem;
  max-height: 80%;
  max-width: 80%;
  background-color: white;
  padding: 1.25rem;
  border-radius: 0.5rem;
  box-shadow: 0rem 0rem 0.625rem rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.close-button {
  padding: 0.5rem 1rem;
  background-color: #5bcefa;
  color: white;
  border: none;
  border-radius: 0.25rem;
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
