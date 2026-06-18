/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // P0 阶段不扩展任何 token,保持空 extend,避免影响现有样式
  // P3 阶段会在这里加入结构 token(间距/圆角/字号/控件高度)
  theme: {
    extend: {}
  },
  plugins: []
};
