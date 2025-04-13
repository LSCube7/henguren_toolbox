import { createRouter, createWebHistory } from "vue-router";
import HomePage from "@/HomePage.vue"; // 导入首页组件
import ShiciFinder from "@/ShiciFinder.vue"; // 导入寻词组件
import WenchangTable from "@/WenchangTable.vue";
import VocabTester from "@/VocabTester.vue";

const routes = [
  {
    path: "/",
    component: HomePage, // 指定首页组件为 HomePage.vue
    // meta:{title:"恨古人工具箱|首页"}
  },
  {
    path: "/shici",
    component: ShiciFinder,
    // meta:{title:"恨古人工具箱|寻找实词"}
  },
  {
    path: "/wenchang",
    component: WenchangTable,
    // meta:{title:"恨古人工具箱|文学常识"}
  },
  {
    path: "/vocab",
    component: VocabTester,
    // meta:{title:"恨古人工具箱|词汇测试"}
  }
  // 其他路由...
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});
export default router;
