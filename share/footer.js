document.addEventListener("DOMContentLoaded", function () {
  fetch("../share/footer.html")
    .then((response) => response.text())
    .then((data) => {
      document.querySelector("footer").innerHTML = data;
    });
});

window.addEventListener('load', function() {
  if ('serviceWorker' in navigator) {
    // 发送消息给 Service Worker 请求重新加载页面
    navigator.serviceWorker.controller.postMessage({ type: 'RELOAD_PAGE' });
  }
});

