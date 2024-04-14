<template>
    <footer>
      &copy; 2024
      <a
        href="https://github.com/LSCube7/henguren_toolbox"
        style="color: #5bcefa; text-decoration: none"
        >小方盒LSCube</a
      >
      <p id="LICENSE">
        An
        <a
          href="https://github.com/LSCube7/henguren_toolbox"
          style="color: #f6a8b8; text-decoration: none"
          >Opensource Project</a
        >
        Under the
        <a
          href="../LICENSE"
          type="text/plain"
          target="_blank"
          style="color: #5bcefa; text-decoration: none"
          >MIT LICENSE</a
        >
      </p>
      <p id="Thanks">
        Thanks to
        <a href="https://vercel.com" style="color: #f6a8b8; text-decoration: none"
          >Vercel</a
        >,
        <a
          href="https://cloudflare.com"
          style="color: #f6a8b8; text-decoration: none"
          >Cloudflare</a
        >
        and
        <a href="https://openai.com" style="color: #f6a8b8; text-decoration: none"
          >OpenAI</a
        >
      </p>
      <p id="hitokoto">
        Hitokoto:
        <a href="#" style="color: #f6a8b8; text-decoration: none" id="hitokoto_text"
          >:D 获取中...</a
        >
      </p>
    </footer>
  </template>
  
  <script>
  export default {
    mounted() {
      fetch("https://v1.hitokoto.cn")
        .then((response) => response.json())
        .then((data) => {
          const hitokoto = this.$el.querySelector("#hitokoto_text");
          hitokoto.href = `https://hitokoto.cn/?uuid=${data.uuid}`;
          hitokoto.innerText = data.hitokoto;
        })
        .catch(console.error);
    },
  };
  </script>
  
  
  <style scoped>
  /* 样式 */
  </style>
  