// main.js

import { createApp } from "vue";
import App from "./App.vue";
import router from "./router"; // 导入 Vue Router 实例
import "./registerServiceWorker";

createApp(App).use(router).mount("#app");
