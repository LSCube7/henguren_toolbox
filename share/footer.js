document.addEventListener("DOMContentLoaded", function () {
  fetch("../share/footer.html")
    .then((response) => response.text())
    .then((data) => {
      document.querySelector("footer").innerHTML = data;
    });
});


fetch("https://v1.hitokoto.cn")
  .then((response) => response.json())
  .then((data) => {
    const hitokoto = document.querySelector("#hitokoto_text");
    hitokoto.href = `https://hitokoto.cn/?uuid=${data.uuid}`;
    hitokoto.innerText = data.hitokoto;
  })
  .catch(console.error);

window.addEventListener('load', function() {
  if ('serviceWorker' in navigator) {
    // 发送消息给 Service Worker 请求重新加载页面
    navigator.serviceWorker.controller.postMessage({ type: 'RELOAD_PAGE' });
  }
});

