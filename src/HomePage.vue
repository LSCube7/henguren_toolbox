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
  color: #5bcefa;

}

p {
  text-align: center;
  color: #f6a8b8;
}

.toolbox {
  list-style-type: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}

.toolbox li {
  margin: 10px;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: pointer;
  background-color: #f9f9f9;
  width: 200px;
  /* 固定宽度 */
}

.toolbox li:hover {
  transform: scale(1.1);

  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.toolbox li h2 {
  text-decoration: none !important;
  color: #333;
  display: block;
}

.toolbox li p {
  color: #333;
}

.toolbox li h2:hover {
  color: #5bcefa;
  text-decoration: none;
}

.toolbox li p:hover {
  color: #f6a8b8;
}

.router-link {
  text-decoration: none !important;
  display: inline-block;
  /* 或者 display: inline; */
}
</style>