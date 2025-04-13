<template>
  <h1>恨古人工具箱</h1>
  <p>不恨古人吾不见，恨古人不见吾狂耳</p>
  <ul class="toolbox">
    <li>
      <router-link to="/shici" class="router-link">
        <h2>寻找实词</h2>
        <p>根据上海中考的150个实词要求找寻古文中的实词</p>
      </router-link>
    </li>
    <li>
      <router-link to="/wenchang" class="router-link">
        <h2>文学常识</h2>
        <p>《评价指南》要求的的文学常识</p>
      </router-link>
    </li>
    <li>
      <router-link to="/vocab" class="router-link">
        <h2>单词测试</h2>
        <p>测试英语书后的单词，轻松助你通过Ⅱ卷，支持自定义单词列表</p>
      </router-link>
    </li>
    <li>
      <router-link to="#" class="router-link">
        <h2>开发中……</h2>
        <p>更多工具绝赞添加中</p>
      </router-link>
    </li>
    <!-- 在此添加更多工具 -->
  </ul>
</template>



<style scoped>
h1 {
  text-align: center;
  color: var(--primary-color);

}

p {
  text-align: center;
  color: var(--secondary-color);
}

.toolbox {
  list-style-type: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}

.toolbox li {
  margin: 0.625rem;
  padding: 1.25rem;
  border-radius: 0.5rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: pointer;
  background-color: var(--secondary-background-color);
  width: 12.5rem;
  /* 固定宽度 */
}

.toolbox li:hover {
  transform: scale(1.1);

  box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.2);
}

.toolbox li h2 {
  text-decoration: none !important;
  color: var(--text-color);
  display: block;
}

.toolbox li p {
  color: var(--text-color);
}

.toolbox li h2:hover {
  color: var(--primary-color);
  text-decoration: none;
}

.toolbox li p:hover {
  color: var(--secondary-color);
}

.router-link {
  text-decoration: none !important;
  display: inline-block;
  /* 或者 display: inline; */
}
</style>