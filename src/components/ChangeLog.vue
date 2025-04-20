<template>
  <div 
    class="change-log-wrapper" 
    v-if="showChangeLog || isClosing" 
    @animationend="handleAnimationEnd"
    :class="{ 'fade-out': isClosing }"
  >
    <div class="change-log-dialog">
      <!-- 标题 -->
      <div class="dialog-header">
        <h3>更新日志</h3>
        <button @click="dismissChangeLog" class="close-button">×</button>
      </div>

      <!-- 内容区域 -->
      <div class="dialog-content">
        <div class="change-log-content" v-html="changeLogHtml"></div>
      </div>

      <!-- 按钮 -->
      <div class="dialog-footer">
        <button @click="dismissChangeLog">关闭</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    showChangeLog: {
      type: Boolean,
      required: true
    }
  },
  data() {
    return {
      changeLogHtml: '', // ChangeLog HTML内容将在 mounted 钩子中填充
      isClosing: false // 控制淡出动画
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
      // 开始淡出动画
      this.isClosing = true;
    },
    handleAnimationEnd() {
      // 动画结束后关闭弹窗
      if (this.isClosing) {
        this.isClosing = false;
        this.$emit('close');
      }
    }
  }
};
</script>

<style scoped>
/* 页面内容样式 */
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
  animation: fadeIn 0.3s ease-in-out;
}

.change-log-wrapper.fade-out {
  animation: fadeOut 0.3s ease-in-out;
}

.change-log-dialog {
  width: 35rem;
  max-height: 80%; /* 限制弹窗最大高度 */
  background-color: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: hidden; /* 防止内容溢出 */
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #ccc;
  padding-bottom: 0.5rem;
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #333;
}

.dialog-content {
  overflow-y: auto; /* 启用垂直滚动 */
  flex-grow: 1;
  padding-right: 0.5rem;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

button {
  padding: 0.5rem 1rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.3s;
}

button:hover {
  background-color: var(--hover-color);
}

/* 自定义滚动条样式 */
.dialog-content::-webkit-scrollbar {
  width: 8px;
}

.dialog-content::-webkit-scrollbar-thumb {
  background-color: #ccc;
  border-radius: 4px;
}

.dialog-content::-webkit-scrollbar-thumb:hover {
  background-color: #aaa;
}

/* 弹窗淡入效果 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 弹窗淡出效果 */
@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
</style>
