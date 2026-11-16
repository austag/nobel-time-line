import { defineConfig } from 'vite';

// 상대 경로 기준으로 빌드해서 GitHub Pages의 하위 경로에서도 그대로 동작한다.
export default defineConfig({ base: './' });
