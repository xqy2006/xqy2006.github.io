var e={html:`<blockquote class="md-quote"><p>本文基于版本9.9.21-38711</p>
</blockquote>
<h2 class="md-h md-h2" id="获取前端伪代码"><span class="md-hash" aria-hidden="true">## </span><span class="md-h-text">获取前端伪代码</span></h2>
<p>为支持多平台，软件采用的是electron架构，通过将js编译为jsc以保护前端代码，目前对改软件的修改多通过注入js，劫持IPC实现，但是极其容易被检测，从而触发风控，若是直接修改其前端的jsc字节码，则几乎不会被发现（目前没发现校验）</p>
<p>jsc可以从major.node中提取出来，之后再通过我之前的项目<a class="md-link" href="https://github.com/xqy2006/jsc2js/" target="_blank" rel="noopener noreferrer">jsc2js<span class="md-link-ext" aria-hidden="true">↗</span></a>，可以将所有jsc转换为可读的js：<a class="md-link" href="/qqnt.js" data-internal="1">qqnt.js</a></p>
<p>此外我还统计了其中出现中文的代码行：<a class="md-link" href="/utf8_strings.txt" data-internal="1">utf8_strings.txt</a></p>
<p>有了前端的伪代码，我们该如何去实际修改呢？接下来以破解svip功能超级调色盘为例进行探究</p>
<h2 class="md-h md-h2" id="破解超级调色盘"><span class="md-hash" aria-hidden="true">## </span><span class="md-h-text">破解超级调色盘</span></h2>
<h3 class="md-h md-h3" id="定位目标文件"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">定位目标文件</span></h3>
<p>软件的前端代码被拆分成数百个 webpack chunk（<code class="md-code-inline">.jsc</code> 文件），每个 chunk 用数字 ID 标识。第一步是从 633 个反编译 JS 文件中找出哪些与超级调色盘功能相关。</p>
<h4 class="md-h md-h4" id="搜索入口-中文关键词"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">搜索入口：中文关键词</span></h4>
<p>最直接的入口是搜索功能名称本身：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">bash</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-bash">grep -n <span class="hljs-string">&quot;超级调色盘&quot;</span> qqnt.js</code></pre></div>
<p>结果：</p>
<div class="md-table-wrap"><pre class="md-table">┌─────────┬──────────┬────────────────────────────────────────┬───────────────────────────────────────┐
<span class="md-th">│ 行号    │ 文件     │ 代码                                   │ 含义                                  │</span>
├─────────┼──────────┼────────────────────────────────────────┼───────────────────────────────────────┤
│ 617750  │ 36346.js │ <code class="md-code-inline">&quot;超级调色盘&quot; === a0[&quot;innerText&quot;]</code>       │ 新手引导：通过 DOM 元素文本匹配菜单项 │
│ 617946  │ 36346.js │ <code class="md-code-inline">&quot;打开超级调色盘，&lt;br&gt;定制你的QQ主题！&quot;</code> │ 引导气泡提示文案                      │
│ 2264353 │ 89454.js │ <code class="md-code-inline">&quot;超级调色盘&quot; === a0[&lt;unknown&gt;]</code>         │ 过滤侧边栏菜单，打开超级调色盘窗口    │
└─────────┴──────────┴────────────────────────────────────────┴───────────────────────────────────────┘</pre></div>
<p><strong>36346.js</strong> 是新手引导系统，仅负责展示 UI 引导动画，不涉及主题逻辑——<strong>排除</strong>。</p>
<p><strong>89454.js</strong> 才是核心入口。</p>
<h4 class="md-h md-h4" id="分析-89454-js-超级调色盘入口组件"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">分析 89454.js —— 超级调色盘入口组件</span></h4>
<p>读取 89454.js 的 <code class="md-code-inline">onCall</code> 函数：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">javascript</span><span class="md-code-meta">7 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-javascript"><span class="hljs-keyword">function</span> <span class="hljs-title function_">onCall</span>(<span class="hljs-params"></span>) {
    <span class="hljs-comment">// 在侧边栏菜单中查找&quot;超级调色盘&quot;项</span>
    r3 = <span class="hljs-title function_">filter</span>(<span class="hljs-function"><span class="hljs-params">item</span> =&gt;</span> <span class="hljs-string">&quot;超级调色盘&quot;</span> === item[name])
    r0 = firstMatch  <span class="hljs-comment">// 获取对应的 tabConfig</span>
    <span class="hljs-comment">// 打开设置窗口，传入 tabConfig</span>
    <span class="hljs-title function_">openExternalWindow</span>(<span class="hljs-title class_">SettingWindow</span>, { <span class="hljs-attr">tabConfig</span>: r0 })
}</code></pre></div>
<p>这揭示了架构：点击&quot;超级调色盘&quot;菜单 → 打开<strong>设置窗口</strong>（SettingWindow）并跳转到对应标签页。也就是说，超级调色盘的主 UI 不在 89454.js 本身，而在设置窗口加载的另一个 chunk 中。</p>
<p>89454.js 同时也包含 <code class="md-code-inline">selectTemplateTheme</code> 和 <code class="md-code-inline">selectStaticTheme</code> 函数（qqnt.js 第 2264415、2264462 行），它们处理主题选择时的 SVIP/试用/保存逻辑。但这是弹窗式的快捷入口（侧边栏面板），不是设置页的完整 UI。</p>
<h4 class="md-h md-h4" id="追踪-svip-按钮-定位-77263-js"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">追踪 SVIP 按钮 —— 定位 77263.js</span></h4>
<p>超级调色盘设置页面有三种按钮：SVIP 开通按钮、试用按钮、套用按钮。搜索这些 UI 控制函数：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">bash</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-bash">grep -n <span class="hljs-string">&quot;showSvipBtn\\|showTrialBtn\\|showFreeThemeUseBtn&quot;</span> qqnt.js</code></pre></div>
<p>结果：<strong>仅在 77263.js 中找到</strong>：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">javascript</span><span class="md-code-meta">11 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-javascript"><span class="hljs-keyword">function</span> <span class="hljs-keyword">get</span> <span class="hljs-title function_">showSvipBtn</span>() {
    <span class="hljs-keyword">return</span> !isSelectedFreeTheme &amp;&amp; !isSvip &amp;&amp; !showTemplateTrialBtn &amp;&amp; !isTrialing
}

<span class="hljs-keyword">function</span> <span class="hljs-keyword">get</span> <span class="hljs-title function_">showTrialBtn</span>() {
    <span class="hljs-keyword">return</span> !isSelectedFreeTheme &amp;&amp; !isSvip &amp;&amp; showTemplateTrialBtn &amp;&amp; !isTrialing
}

<span class="hljs-keyword">function</span> <span class="hljs-keyword">get</span> <span class="hljs-title function_">showFreeThemeUseBtn</span>() {
    <span class="hljs-keyword">return</span> !isSvip &amp;&amp; appearanceStore.<span class="hljs-property">isSelectedFreeTheme</span>
}</code></pre></div>
<p>进一步确认——搜索&quot;套用&quot;按钮文本：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">bash</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-bash">grep -n <span class="hljs-string">&quot;套用&quot;</span> qqnt.js</code></pre></div>
<p>唯一匹配在 77263.js：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">javascript</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-javascript">r0[<span class="hljs-number">0</span>] = <span class="hljs-title class_">Scope</span>[<span class="hljs-number">216</span>][<span class="hljs-number">2</span>][<span class="hljs-string">&quot;Uk&quot;</span>](<span class="hljs-string">&quot;套用&quot;</span>)</code></pre></div>
<p><strong>结论</strong>：<code class="md-code-inline">77263.jsc</code> 是超级调色盘设置页面的 Vue 组件，控制所有按钮的显隐和点击行为。</p>
<h4 class="md-h md-h4" id="追踪持久化逻辑-定位-52574-js"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">追踪持久化逻辑 —— 定位 52574.js</span></h4>
<p>在 77263.js 的 <code class="md-code-inline">handleClick</code> 函数中，点击&quot;套用&quot;按钮后执行：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">javascript</span><span class="md-code-meta">6 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-javascript"><span class="hljs-keyword">function</span> <span class="hljs-title function_">handleClick</span>(<span class="hljs-params"></span>) {
    <span class="hljs-keyword">if</span> (<span class="hljs-variable language_">this</span>.<span class="hljs-property">appearanceStore</span>.<span class="hljs-property">isSelectedFreeTheme</span>) {
        <span class="hljs-variable language_">this</span>.<span class="hljs-property">trialThemeStore</span>.<span class="hljs-title function_">cancelTrialTheme</span>()
        <span class="hljs-variable language_">this</span>.<span class="hljs-property">appearanceStore</span>.<span class="hljs-title function_">setThemeInfo</span>()     <span class="hljs-comment">// ← 关键：持久化保存</span>
    }
}</code></pre></div>
<p><code class="md-code-inline">setThemeInfo()</code> 是主题持久化的核心方法。它来自 <code class="md-code-inline">appearanceStore</code>，而 <code class="md-code-inline">appearanceStore</code> 是通过 Pinia store 注入的。查看 77263.js 的模块初始化：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">javascript</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-javascript"><span class="hljs-title class_">Scope</span>[<span class="hljs-number">5</span>][<span class="hljs-number">9</span>] = <span class="hljs-title function_">a2</span>(<span class="hljs-number">52574</span>)   <span class="hljs-comment">// 导入 52574 模块</span></code></pre></div>
<p><code class="md-code-inline">get appearanceStore</code> getter：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">javascript</span><span class="md-code-meta">3 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-javascript"><span class="hljs-keyword">function</span> <span class="hljs-keyword">get</span> <span class="hljs-title function_">appearanceStore</span>() {
    <span class="hljs-keyword">return</span> <span class="hljs-title class_">Scope</span>[<span class="hljs-number">5</span>][<span class="hljs-number">11</span>][<span class="hljs-string">&quot;useStore&quot;</span>](<span class="hljs-title class_">Scope</span>[<span class="hljs-number">5</span>][<span class="hljs-number">9</span>][<span class="hljs-string">&quot;ZL&quot;</span>])  <span class="hljs-comment">// 从 52574 创建 store</span>
}</code></pre></div>
<p>由此确认 <code class="md-code-inline">52574</code> 就是 AppearanceStore 所在的模块。搜索验证：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">bash</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-bash">grep -n <span class="hljs-string">&quot;func_setThemeInfo&quot;</span> qqnt.js</code></pre></div>
<p>在 52574.js 中找到：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">javascript</span><span class="md-code-meta">11 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-javascript"><span class="hljs-keyword">function</span> <span class="hljs-title function_">setThemeInfo</span>(<span class="hljs-params">a0</span>) {
    <span class="hljs-comment">// ...日志：输出 isSvip、isDefaultThemeId、isFreeTheme 状态...</span>
    <span class="hljs-keyword">if</span> (!<span class="hljs-variable language_">this</span>.<span class="hljs-property">isSvip</span>) {
        <span class="hljs-keyword">if</span> (<span class="hljs-variable language_">this</span>.<span class="hljs-property">themeId</span> !== defaultThemeId) {
            <span class="hljs-keyword">if</span> (!<span class="hljs-variable language_">this</span>.<span class="hljs-property">isSelectedFreeTheme</span>) {
                <span class="hljs-keyword">return</span> <span class="hljs-literal">undefined</span>  <span class="hljs-comment">// ← 三级拦截：非 SVIP + 非默认 + 非免费 → 拒绝</span>
            }
        }
    }
    <span class="hljs-comment">// 构建请求，调用 nodeIKernelSkinService.setThemeInfo() 持久化</span>
}</code></pre></div>
<p><strong>结论</strong>：<code class="md-code-inline">52574.jsc</code> 是 AppearanceStore，包含 <code class="md-code-inline">setThemeInfo</code> 的权限校验逻辑。</p>
<h4 class="md-h md-h4" id="文件关系图"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">文件关系图</span></h4>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">19 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">用户点击侧边栏&quot;超级调色盘&quot;
    │
    ▼
89454.jsc (onCall)
    │  过滤菜单项，调用 openExternalWindow(SettingWindow)
    │
    ▼
77263.jsc (设置页面 Vue 组件)                    ← 补丁 B1、B3、B11
    │  showSvipBtn / showTrialBtn / showFreeThemeUseBtn → 按钮显隐
    │  handleClick → 点击&quot;套用&quot;按钮
    │       │
    │       ▼  this.appearanceStore.setThemeInfo()
    │
    ▼
52574.jsc (AppearanceStore)                      ← 补丁 C1
    │  setThemeInfo() → 三级权限校验 → nodeIKernelSkinService.setThemeInfo()
    │
    ▼
持久化到本地配置</code></pre></div>
<div class="md-hr" role="separator"></div>
<h3 class="md-h md-h3" id="v8-字节码基础"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">V8 字节码基础</span></h3>
<p><strong>以下的字节码仅针对当前软件版本所对应的V8版本，字节码会随着V8版本的不同而不同</strong></p>
<h4 class="md-h md-h4" id="关键操作码"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">关键操作码</span></h4>
<div class="md-table-wrap"><pre class="md-table">┌─────────────┬───────────────────────────┬────────────────────────────────────────────────┐
<span class="md-th">│ 操作码      │ 助记符                    │ 说明                                           │</span>
├─────────────┼───────────────────────────┼────────────────────────────────────────────────┤
│ <code class="md-code-inline">0E</code>          │ LdaUndefined              │ 累加器 = undefined（可用作 NOP 填充）          │
│ <code class="md-code-inline">11</code>          │ LdaTrue                   │ 累加器 = true                                  │
│ <code class="md-code-inline">12</code>          │ LdaFalse                  │ 累加器 = false                                 │
│ <code class="md-code-inline">33 RR II FF</code> │ GetNamedProperty          │ 从寄存器 RR 读取属性，II=常量池索引，FF=反馈槽 │
│ <code class="md-code-inline">5B</code>          │ ToBooleanLogicalNot       │ 累加器 = !累加器                               │
│ <code class="md-code-inline">64</code>          │ CallProperty0             │ 无参方法调用                                   │
│ <code class="md-code-inline">93 XX</code>       │ Jump [XX]                 │ 无条件跳转，目标 = 当前偏移 + XX               │
│ <code class="md-code-inline">A0 XX</code>       │ JumpIfToBooleanTrue [XX]  │ 若累加器为 true 则跳转                         │
│ <code class="md-code-inline">A1 XX</code>       │ JumpIfToBooleanFalse [XX] │ 若累加器为 false 则跳转                        │
│ <code class="md-code-inline">A3 XX</code>       │ JumpIfFalse [XX]          │ 若累加器为 false 则跳转（不做 ToBoolean）      │
│ <code class="md-code-inline">B3</code>          │ Return                    │ 返回累加器中的值                               │
│ <code class="md-code-inline">CE</code>          │ Star0                     │ r0 = 累加器                                    │
│ <code class="md-code-inline">CD</code>          │ Star1                     │ r1 = 累加器                                    │
└─────────────┴───────────────────────────┴────────────────────────────────────────────────┘</pre></div>
<h4 class="md-h md-h4" id="寄存器编码"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">寄存器编码</span></h4>
<div class="md-table-wrap"><pre class="md-table">┌──────┬──────────┐
<span class="md-th">│ 编码 │ 含义     │</span>
├──────┼──────────┤
│ <code class="md-code-inline">02</code>   │ <code class="md-code-inline">&lt;this&gt;</code>   │
│ <code class="md-code-inline">F9</code>   │ <code class="md-code-inline">r0</code>       │
│ <code class="md-code-inline">F8</code>   │ <code class="md-code-inline">r1</code>       │
│ <code class="md-code-inline">F7</code>   │ <code class="md-code-inline">r2</code>       │
│ ...  │ 依次递减 │
└──────┴──────────┘</pre></div>
<div class="md-hr" role="separator"></div>
<h3 class="md-h md-h3" id="定位目标函数"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">定位目标函数</span></h3>
<h4 class="md-h md-h4" id="从-ui-行为出发"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">从 UI 行为出发</span></h4>
<p>我们需要让付费主题出现&quot;套用&quot;按钮，点击后永久保存。</p>
<p>在反编译的 <code class="md-code-inline">77263.js</code> 中搜索关键词：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">grep -n &quot;showSvipBtn\\|showTrialBtn\\|showFreeThemeUseBtn\\|setThemeInfo\\|isSvip&quot; 77263.js</code></pre></div>
<p>发现关键 computed 属性和方法：</p>
<div class="md-table-wrap"><pre class="md-table">┌────────────────────────────────┬──────┬────────────────────────┐
<span class="md-th">│ 函数名                         │ 行号 │ 作用                   │</span>
├────────────────────────────────┼──────┼────────────────────────┤
│ <code class="md-code-inline">showSvipBtn</code>                    │ 4503 │ 控制&quot;开通SVIP&quot;按钮显隐 │
│ <code class="md-code-inline">showTrialBtn</code>                   │ 4519 │ 控制&quot;试用&quot;按钮显隐     │
│ <code class="md-code-inline">showFreeThemeUseBtn</code>            │ 4535 │ 控制&quot;套用&quot;按钮显隐     │
│ <code class="md-code-inline">handleClick</code>（FreeThemeUseBtn） │ 4208 │ &quot;套用&quot;按钮点击处理     │
└────────────────────────────────┴──────┴────────────────────────┘</pre></div>
<h4 class="md-h md-h4" id="分析按钮显隐逻辑"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">分析按钮显隐逻辑</span></h4>
<p>从反编译 JS 中读到的逻辑：</p>
<p><strong>showSvipBtn</strong>（显示&quot;开通SVIP&quot;按钮）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">javascript</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-javascript"><span class="hljs-keyword">return</span> !isSelectedFreeTheme &amp;&amp; !isSvip &amp;&amp; !showTemplateTrialBtn &amp;&amp; !isTrialing</code></pre></div>
<p><strong>showTrialBtn</strong>（显示&quot;试用&quot;按钮）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">javascript</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-javascript"><span class="hljs-keyword">return</span> !isSelectedFreeTheme &amp;&amp; !isSvip &amp;&amp; showTemplateTrialBtn &amp;&amp; !isTrialing</code></pre></div>
<p><strong>showFreeThemeUseBtn</strong>（显示&quot;套用&quot;按钮）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">javascript</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-javascript"><span class="hljs-keyword">return</span> !isSvip &amp;&amp; <span class="hljs-variable language_">this</span>.<span class="hljs-property">appearanceStore</span>.<span class="hljs-property">isSelectedFreeTheme</span></code></pre></div>
<p>→ 仅对免费主题显示&quot;套用&quot;。</p>
<p><strong>handleClick</strong>（FreeThemeUseBtn 的点击事件）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">javascript</span><span class="md-code-meta">4 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-javascript"><span class="hljs-keyword">if</span> (<span class="hljs-variable language_">this</span>.<span class="hljs-property">appearanceStore</span>.<span class="hljs-property">isSelectedFreeTheme</span>) {  <span class="hljs-comment">// 仅免费主题可执行</span>
    <span class="hljs-variable language_">this</span>.<span class="hljs-property">trialThemeStore</span>.<span class="hljs-title function_">cancelTrialTheme</span>()       <span class="hljs-comment">// 取消试用</span>
    <span class="hljs-variable language_">this</span>.<span class="hljs-property">appearanceStore</span>.<span class="hljs-title function_">setThemeInfo</span>()            <span class="hljs-comment">// 保存主题（持久化）</span>
}</code></pre></div>
<h4 class="md-h md-h4" id="分析-setthemeinfo-的权限校验"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">分析 setThemeInfo 的权限校验</span></h4>
<p>在 <code class="md-code-inline">52574.js</code> 中找到 <code class="md-code-inline">setThemeInfo</code> 的实现：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">javascript</span><span class="md-code-meta">12 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-javascript"><span class="hljs-keyword">async</span> <span class="hljs-title function_">setThemeInfo</span>(<span class="hljs-params">a0</span>) {
    <span class="hljs-comment">// ...日志...</span>
    <span class="hljs-keyword">if</span> (!<span class="hljs-variable language_">this</span>.<span class="hljs-property">isSvip</span>) {                           <span class="hljs-comment">// 非 SVIP</span>
        <span class="hljs-keyword">if</span> (<span class="hljs-variable language_">this</span>.<span class="hljs-property">themeId</span> !== defaultThemeId) {     <span class="hljs-comment">// 非默认主题</span>
            <span class="hljs-keyword">if</span> (!<span class="hljs-variable language_">this</span>.<span class="hljs-property">isSelectedFreeTheme</span>) {       <span class="hljs-comment">// 非免费主题</span>
                <span class="hljs-keyword">return</span> <span class="hljs-literal">undefined</span>;                  <span class="hljs-comment">// ← 直接拒绝！</span>
            }
        }
    }
    <span class="hljs-comment">// 通过校验后，构建请求并保存</span>
    nodeIKernelSkinService.<span class="hljs-title function_">setThemeInfo</span>(request)
}</code></pre></div>
<p><strong>结论</strong>：<code class="md-code-inline">setThemeInfo</code> 内部有三级拦截，非 SVIP 用户保存付费主题会被静默拒绝。</p>
<div class="md-hr" role="separator"></div>
<h3 class="md-h md-h3" id="从-js-映射到字节码"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">从 JS 映射到字节码</span></h3>
<h4 class="md-h md-h4" id="在字节码转储中定位函数"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">在字节码转储中定位函数</span></h4>
<p>字节码转储文件 <code class="md-code-inline">77263.txt</code> 包含每个函数的 <code class="md-code-inline">SharedFunctionInfo</code> 及完整字节码。通过函数名搜索定位：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">grep -n &quot;showSvipBtn\\|showFreeThemeUseBtn&quot; 77263.txt</code></pre></div>
<p>找到：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">3 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">33837: 00000326001A9AF5: [SharedFunctionInfo] get showSvipBtn
33978: 00000326001A9C15: [SharedFunctionInfo] get showFreeThemeUseBtn
31607: 00000326001A82D5: [SharedFunctionInfo] handleClick</code></pre></div>
<h4 class="md-h md-h4" id="读取字节码"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">读取字节码</span></h4>
<p><strong>showSvipBtn</strong>（BytecodeArray[32]）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">14 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">offset  0: 33 02 00 00    GetNamedProperty &lt;this&gt;, [0]  ; appearanceStore
offset  4: CE             Star0
offset  5: 33 F9 01 02    GetNamedProperty r0, [1]      ; isSelectedFreeTheme
offset  9: 5B             ToBooleanLogicalNot
offset 10: A3 15          JumpIfFalse [21] → 31          ; if isSelectedFreeTheme → 跳到 return
offset 12: 33 02 02 04    GetNamedProperty &lt;this&gt;, [2]  ; isSvip
offset 16: 5B             ToBooleanLogicalNot
offset 17: A3 0E          JumpIfFalse [14] → 31
offset 19: 33 02 03 06    GetNamedProperty &lt;this&gt;, [3]  ; showTemplateTrialBtn
offset 23: 5B             ToBooleanLogicalNot
offset 24: A3 07          JumpIfFalse [7] → 31
offset 26: 33 02 04 08    GetNamedProperty &lt;this&gt;, [4]  ; isTrialing
offset 30: 5B             ToBooleanLogicalNot
offset 31: B3             Return</code></pre></div>
<p>注意跳转距离：<code class="md-code-inline">A3 15</code>（→31）、<code class="md-code-inline">A3 0E</code>（→31）、<code class="md-code-inline">A3 07</code>（→31），都跳转到同一个 return。</p>
<p><strong>showFreeThemeUseBtn</strong>（BytecodeArray[17]）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">7 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">offset  0: 33 02 00 00    GetNamedProperty &lt;this&gt;, [0]  ; isSvip
offset  4: 5B             ToBooleanLogicalNot
offset  5: A3 0B          JumpIfFalse [11] → 16          ; if isSvip → return(false)
offset  7: 33 02 01 02    GetNamedProperty &lt;this&gt;, [1]  ; appearanceStore
offset 11: CE             Star0
offset 12: 33 F9 02 04    GetNamedProperty r0, [2]      ; isSelectedFreeTheme
offset 16: B3             Return                          ; return isSelectedFreeTheme</code></pre></div>
<p><strong>handleClick</strong>（FreeThemeUseBtn，BytecodeArray[41]）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">16 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">offset  0: 33 02 00 00    GetNamedProperty &lt;this&gt;, [0]  ; appearanceStore
offset  4: CE             Star0
offset  5: 33 F9 01 02    GetNamedProperty r0, [1]      ; isSelectedFreeTheme
offset  9: A1 1E          JumpIfToBooleanFalse [30] → 39 ; 非免费主题 → 跳过
offset 11: 33 02 02 04    GetNamedProperty &lt;this&gt;, [2]  ; trialThemeStore
offset 15: CD             Star1
offset 16: 33 F8 03 06    GetNamedProperty r1, [3]      ; cancelTrialTheme
offset 20: CE             Star0
offset 21: 64 F9 F8 08    CallProperty0                  ; cancelTrialTheme()
offset 25: 33 02 00 0A    GetNamedProperty &lt;this&gt;, [0]  ; appearanceStore
offset 29: CD             Star1
offset 30: 33 F8 04 0C    GetNamedProperty r1, [4]      ; setThemeInfo
offset 34: CE             Star0
offset 35: 64 F9 F8 0E    CallProperty0                  ; setThemeInfo()
offset 39: 0E             LdaUndefined
offset 40: B3             Return</code></pre></div>
<p>常量池：<code class="md-code-inline">[0]=appearanceStore, [1]=isSelectedFreeTheme, [2]=trialThemeStore, [3]=cancelTrialTheme, [4]=setThemeInfo</code></p>
<p><strong>setThemeInfo 权限校验</strong>（52574.txt，BytecodeArray[410]）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">14 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">offset  99: 33 02 04 10    GetNamedProperty &lt;this&gt;, [4]  ; isSvip
offset 103: A0 23          JumpIfToBooleanTrue [35] → 138 ; SVIP → 跳过校验
offset 105: 33 02 06 12    GetNamedProperty &lt;this&gt;, [6]  ; themeId
offset 109: C9             Star5
offset 110: 19 13          LdaImmutableCurrentContextSlot [19] ; defaultThemeId
offset 112: C8             Star6
offset 113: 33 F3 07 09    GetNamedProperty r6, [7]
offset 117: 74 F4 14       TestEqualStrict r5             ; themeId === default?
offset 120: A2 12          JumpIfTrue [18] → 138           ; 是默认主题 → 放行
offset 122: 33 02 09 15    GetNamedProperty &lt;this&gt;, [9]  ; isSelectedFreeTheme
offset 126: A0 0C          JumpIfToBooleanTrue [12] → 138 ; 免费主题 → 放行
offset 128: 0E             LdaUndefined                    ; ← 拒绝保存
offset 129-137: ... return undefined
offset 138: 85 0A 17 29    CreateObjectLiteral             ; ← 开始构建保存请求</code></pre></div>
<div class="md-hr" role="separator"></div>
<h3 class="md-h md-h3" id="构造补丁"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">构造补丁</span></h3>
<div class="md-table-wrap"><pre class="md-table">┌───────────┬─────────────────────┬──────────────────────────────────────────────────┐
<span class="md-th">│ 文件      │ 目标函数            │ 策略                                             │</span>
├───────────┼─────────────────────┼──────────────────────────────────────────────────┤
│ 77263.jsc │ showSvipBtn         │ 返回 false → 隐藏&quot;开通SVIP&quot;按钮                  │
│ 77263.jsc │ showFreeThemeUseBtn │ 返回 true → 所有主题显示&quot;套用&quot;                   │
│ 77263.jsc │ handleClick         │ 去掉 isSelectedFreeTheme 条件 → 付费主题也能套用 │
│ 52574.jsc │ setThemeInfo        │ 跳过三级权限校验 → 允许保存付费主题              │
└───────────┴─────────────────────┴──────────────────────────────────────────────────┘</pre></div>
<p><strong>替换整个函数体为常量返回：</strong></p>
<p>原理：将函数体首字节改为 <code class="md-code-inline">11 B3</code>（LdaTrue + Return）或 <code class="md-code-inline">12 B3</code>（LdaFalse + Return），后续字节用 <code class="md-code-inline">0E</code>（LdaUndefined）填充。V8 解释器执行到 Return 后即返回，填充字节永远不会被执行。</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">2 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">原始: 33 02 00 00 CE 33 F9 01 02 5B A3 15 ...  (复杂的条件逻辑)
修改: 12 B3 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E ...  (直接返回 false)</code></pre></div>
<p><strong>去除条件跳转：</strong></p>
<p>原理：将 <code class="md-code-inline">A1 1E</code>（JumpIfToBooleanFalse [30]）替换为 <code class="md-code-inline">0E 0E</code>（两个 NOP），使代码无条件执行后续的 <code class="md-code-inline">cancelTrialTheme()</code> + <code class="md-code-inline">setThemeInfo()</code>。</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">2 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">原始 offset 9: A1 1E  → 若 isSelectedFreeTheme 为 false，跳过保存
修改 offset 9: 0E 0E  → 无条件落入保存逻辑</code></pre></div>
<p><strong>条件跳转改为无条件跳转：</strong></p>
<p>原理：将 <code class="md-code-inline">A0 23</code>（JumpIfToBooleanTrue [35]）改为 <code class="md-code-inline">93 23</code>（Jump [35]），无论 isSvip 是否为 true，都无条件跳转到 offset 138 开始保存。原来只有 SVIP 用户能到达的保存代码，现在所有用户都能执行。</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">2 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">原始 offset 103: A0 23  → 仅 isSvip 为 true 时跳到保存
修改 offset 103: 93 23  → 无条件跳到保存</code></pre></div>
<div class="md-hr" role="separator"></div>
<h3 class="md-h md-h3" id="完整补丁列表"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">完整补丁列表</span></h3>
<h4 class="md-h md-h4" id="77263-jsc-showsvipbtn-return-false"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">77263.jsc— showSvipBtn → return false</span></h4>
<p><strong>搜索</strong>（32字节）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">33 02 00 00 CE 33 F9 01 02 5B A3 15 33 02 02 04 5B A3 0E 33 02 03 06 5B A3 07 33 02 04 08 5B B3</code></pre></div>
<p><strong>替换</strong>（32字节）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">12 B3 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E</code></pre></div>
<h4 class="md-h md-h4" id="77263-jsc-showfreethemeusebtn-return-true"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">77263.jsc— showFreeThemeUseBtn → return true</span></h4>
<p><strong>搜索</strong>（37字节）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">11 04 75 05 04 0D 2E 67 08 00 00 00 01 00 00 00 00 00 00 00 33 02 00 00 5B A3 0B 33 02 01 02 CE 33 F9 02 04 B3</code></pre></div>
<p><strong>替换</strong>（37字节）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">11 04 75 05 04 0D 2E 67 08 00 00 00 01 00 00 00 00 00 00 00 11 B3 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E</code></pre></div>
<h4 class="md-h md-h4" id="77263-jsc-handleclick-去除-isselectedfreetheme-守卫"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">77263.jsc— handleClick 去除 isSelectedFreeTheme 守卫</span></h4>
<p><strong>搜索</strong>（41字节）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">33 02 00 00 CE 33 F9 01 02 A1 1E 33 02 02 04 CD 33 F8 03 06 CE 64 F9 F8 08 33 02 00 0A CD 33 F8 04 0C CE 64 F9 F8 0E 0E B3</code></pre></div>
<p><strong>替换</strong>（41字节）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">33 02 00 00 CE 33 F9 01 02 0E 0E 33 02 02 04 CD 33 F8 03 06 CE 64 F9 F8 08 33 02 00 0A CD 33 F8 04 0C CE 64 F9 F8 0E 0E B3</code></pre></div>
<h4 class="md-h md-h4" id="52574-jsc-setthemeinfo-跳过权限检查"><span class="md-hash" aria-hidden="true">#### </span><span class="md-h-text">52574.jsc— setThemeInfo 跳过权限检查</span></h4>
<p><strong>搜索</strong>（15字节）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">65 F4 F3 F2 0E 33 02 04 10 A0 23 33 02 06 12</code></pre></div>
<p><strong>替换</strong>（15字节）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">65 F4 F3 F2 0E 33 02 04 10 93 23 33 02 06 12</code></pre></div>
<span class="md-media" data-kind="image" data-src="/img/Crack/qq/1.png" data-name="1.png" data-alt=""><img class="md-img" src="/img/Crack/qq/1.png" alt="" loading="lazy" decoding="async"></span>
<span class="md-media" data-kind="image" data-src="/img/Crack/qq/2.png" data-name="2.png" data-alt=""><img class="md-img" src="/img/Crack/qq/2.png" alt="" loading="lazy" decoding="async"></span>
<div class="md-hr" role="separator"></div>
<h2 class="md-h md-h2" id="练习"><span class="md-hash" aria-hidden="true">## </span><span class="md-h-text">练习</span></h2>
<p>PS：谁在release中还塞开发工具，看了刚刚的分析，尝试把开发工具调出来吧</p>
<span class="md-media" data-kind="image" data-src="/img/Crack/qq/3.png" data-name="3.png" data-alt=""><img class="md-img" src="/img/Crack/qq/3.png" alt="" loading="lazy" decoding="async"></span>
`,toc:[{depth:2,id:`获取前端伪代码`,text:`获取前端伪代码`},{depth:2,id:`破解超级调色盘`,text:`破解超级调色盘`},{depth:3,id:`定位目标文件`,text:`定位目标文件`},{depth:4,id:`搜索入口-中文关键词`,text:`搜索入口：中文关键词`},{depth:4,id:`分析-89454-js-超级调色盘入口组件`,text:`分析 89454.js —— 超级调色盘入口组件`},{depth:4,id:`追踪-svip-按钮-定位-77263-js`,text:`追踪 SVIP 按钮 —— 定位 77263.js`},{depth:4,id:`追踪持久化逻辑-定位-52574-js`,text:`追踪持久化逻辑 —— 定位 52574.js`},{depth:4,id:`文件关系图`,text:`文件关系图`},{depth:3,id:`v8-字节码基础`,text:`V8 字节码基础`},{depth:4,id:`关键操作码`,text:`关键操作码`},{depth:4,id:`寄存器编码`,text:`寄存器编码`},{depth:3,id:`定位目标函数`,text:`定位目标函数`},{depth:4,id:`从-ui-行为出发`,text:`从 UI 行为出发`},{depth:4,id:`分析按钮显隐逻辑`,text:`分析按钮显隐逻辑`},{depth:4,id:`分析-setthemeinfo-的权限校验`,text:`分析 setThemeInfo 的权限校验`},{depth:3,id:`从-js-映射到字节码`,text:`从 JS 映射到字节码`},{depth:4,id:`在字节码转储中定位函数`,text:`在字节码转储中定位函数`},{depth:4,id:`读取字节码`,text:`读取字节码`},{depth:3,id:`构造补丁`,text:`构造补丁`},{depth:3,id:`完整补丁列表`,text:`完整补丁列表`},{depth:4,id:`77263-jsc-showsvipbtn-return-false`,text:`77263.jsc— showSvipBtn → return false`},{depth:4,id:`77263-jsc-showfreethemeusebtn-return-true`,text:`77263.jsc— showFreeThemeUseBtn → return true`},{depth:4,id:`77263-jsc-handleclick-去除-isselectedfreetheme-守卫`,text:`77263.jsc— handleClick 去除 isSelectedFreeTheme 守卫`},{depth:4,id:`52574-jsc-setthemeinfo-跳过权限检查`,text:`52574.jsc— setThemeInfo 跳过权限检查`},{depth:2,id:`练习`,text:`练习`}]};export{e as default};