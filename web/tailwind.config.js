/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // цвета сфер задач — единая палитра для чипов/календаря
        category: {
          work: '#3b82f6', // blue-500
          study: '#8b5cf6', // violet-500
          life: '#22c55e', // green-500
        },
      },
    },
  },
  plugins: [],
};
