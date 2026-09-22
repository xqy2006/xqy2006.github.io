var e={html:`<p>静态编译后的Python本身就是一个十分复杂的系统，且难以恢复符号，十分适合用来当壳，在AI的帮助下花一天搓了个简单的授权系统，可以通过process hollowing加载任意32/64位EXE程序</p>
<span class="md-media" data-kind="image" data-src="/img/Program/assets/pysandbox_1.png" data-name="pysandbox_1.png" data-alt=""><img class="md-img" src="/img/Program/assets/pysandbox_1.png" alt="" loading="lazy" decoding="async"></span>
<p>然后又用C#写了一个加壳器</p>
<span class="md-media" data-kind="image" data-src="/img/Program/assets/pysandbox_2.png" data-name="pysandbox_2.png" data-alt=""><img class="md-img" src="/img/Program/assets/pysandbox_2.png" alt="" loading="lazy" decoding="async"></span>
<p>经测试在体积较小的exe（10MB以下）均能良好运行</p>
<p>但在较大的exe（例如electron打包的应用）会导致闪退（暂未找到原因），并且十分缓慢（Python的运行速度相较于其它语言还是太慢了）</p>
<p>下载地址：</p>
<p><a class="md-link" href="https://wwbdu.lanzouv.com/iPYWm3h00pmd" target="_blank" rel="noopener noreferrer">https://wwbdu.lanzouv.com/iPYWm3h00pmd<span class="md-link-ext" aria-hidden="true">↗</span></a></p>
`,toc:[]};export{e as default};