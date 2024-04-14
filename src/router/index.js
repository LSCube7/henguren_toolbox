import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '@/HomePage.vue'; // 导入首页组件
import ShiciFinder from '@/ShiciFinder.vue'; // 导入寻词组件
import WenchangTable from '@/WenchangTable.vue'
// 导入其他组件...

const routes = [
  {
    path: '/',
    component: HomePage, // 指定首页组件为 HomePage.vue
  },
  {
    path: '/shici',
    component: ShiciFinder,
  },
  {
    path: '/wenchang',
    component: WenchangTable,
  }
  // 其他路由...
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
