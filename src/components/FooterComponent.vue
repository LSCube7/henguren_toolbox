<template>
  <footer>
    &copy; 2024-2025
    <a href="https://lsc7.top"
      style="color: var(--primary-color); text-decoration: none" target="_blank">小方盒LSCube</a>
    <p id="LICENSE">
      An
      <a href="https://github.com/LSCube7/henguren_toolbox"
        style="color: var(--secondary-color); text-decoration: none">Opensource
        Project</a>
      Under the
      <router-link to="/license" style="color: var(--primary-color); text-decoration: none !important;">MIT LICENSE</router-link>
    </p>
    <p id="Thanks">
      Thanks to
      <a href="https://vercel.com" style="color: var(--secondary-color); text-decoration: none" target="_blank">Vercel</a>
      and
      <a href="https://cloudflare.com" style="color: var(--secondary-color); text-decoration: none" target="_blank">Cloudflare</a>
    </p>
  </footer>
</template>

<script>
export default {
};
</script>


<style scoped>
footer {
  color: var(--text-color);
}
</style>