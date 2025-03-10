import { defineNavbarConfig } from 'vuepress-theme-plume'

export const navbar = defineNavbarConfig([
  { text: '博客', link: '/' },
  { text: '标签', link: '/blog/tags/' },
  { text: '归档', link: '/blog/archives/' },
  //{
  //  text: '笔记',
  //  items: [{ text: '示例', link: '/notes/demo/README.md' }]
  //},
])
