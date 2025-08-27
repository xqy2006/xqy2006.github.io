---
title: jsc2js——将v8字节码转换为可读的js代码
createTime: 2025/08/27 20:36:00
permalink: /article/w3cmceab/
---

最近在研究Typora的时候需要分析被bytenode加密的jsc文件，如今大多数electron架构的项目为了保护js代码都使用bytenode将js编译成了jsc（例如qq，从major.node中可以提取出jsc，分析一下可以找到一些有趣的东西），而网上的教程和已有的工具（**[suleram/View8](https://github.com/suleram/View8)**）只支持v12.0.1版本以前的v8引擎，之后v8引擎的api发生了较大的改动，为此我编写了下面的项目，提供了12.0.1版本以来所有被node和electron使用过的v8：

[xqy2006/jsc2js](https://github.com/xqy2006/jsc2js)

![img](https://opengraph.githubassets.com/githubcard/xqy2006/jsc2js)

在仓库README中有详细的使用说明，这里就不再赘述了

注意，可能只对electron中的jsc有效，若是使用node编译出来的jsc，d8会因为找不到node中的builtin对象而报错

目前可能仍有一点小问题，在反编译部分jsc时会报错（有时候会无法从哈希表中获取对象，暂未找到原因），欢迎pr



有了工具，那也应该有些题目来练手，我出了一道：[ez_jsc](/ez_jsc.zip)（如果下载太慢，可以从这里下载：[蓝奏云](https://wwri.lanzouo.com/iHP0434op6oh)）

欢迎在评论中分享你的解题过程

不知道以后会不会有ctf题目出jsc逆向呢🤔
