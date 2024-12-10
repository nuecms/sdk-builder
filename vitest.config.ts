import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node', // 确保是在 Node 环境下运行
    globals: true,       // 如果需要全局变量支持
  },
});
