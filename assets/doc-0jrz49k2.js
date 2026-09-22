var e={html:`<blockquote class="md-quote"><p>本文依据python3.13.2+编写</p>
</blockquote>
<p>前往<a class="md-link" href="https://github.com/python/cpython" target="_blank" rel="noopener noreferrer">python/cpython: The Python programming language<span class="md-link-ext" aria-hidden="true">↗</span></a>下载python源码，解压</p>
<p>进入PCbuild文件夹，运行<code class="md-code-inline">get_externals.bat</code>下载依赖（可能需要魔法）</p>
<p>下载完依赖后使用VS打开<code class="md-code-inline">pcbuild.sln</code>，将配置由<code class="md-code-inline">Debug</code>改为<code class="md-code-inline">Release</code>（确保此时是x64 Release），在解决方案资源管理器中选中<code class="md-code-inline">Python</code>，右键生成</p>
<p>此时<code class="md-code-inline">PCbuild</code>文件夹下生成<code class="md-code-inline">amd64</code>文件夹</p>
<p>在解决方案资源管理器中找到<code class="md-code-inline">pythoncore</code>，右键属性，配置选择Release，平台选择x64，配置属性--&gt;常规--&gt;配置类型由动态库(.dll)改为静态库(.lib)</p>
<p>C/C++--&gt;预处理器--&gt;预处理器定义点击编辑，取消继承，并修改定义为</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">9 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">_Py_HAVE_ZLIB
_USRDLL
Py_BUILD_CORE
Py_BUILD_CORE_BUILTIN
Py_NO_ENABLE_SHARED
MS_DLL_ID=&quot;$(SysWinVer)&quot;
WIN32
$(_Py3NamePreprocessorDefinition)
$(_PlatformPreprocessorDefinition)$(_DebugPreprocessorDefinition)$(_PydPreprocessorDefinition)_WINDLL</code></pre></div>
<p>C/C++--&gt;代码生成--&gt;运行库修改为多线程（/MT）</p>
<p>应用上述<code class="md-code-inline">pythoncore</code>的修改</p>
<p>在解决方案资源管理器中找到<code class="md-code-inline">Python</code>，右键属性，配置选择Release，平台选择x64，</p>
<p>C/C++--&gt;预处理器--&gt;预处理器定义点击编辑，不要取消继承，并修改定义为</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">3 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">Py_BUILD_CORE
_CONSOLE
Py_NO_ENABLE_SHARED</code></pre></div>
<p>C/C++--&gt;代码生成--&gt;运行库修改为多线程（/MT）</p>
<p>链接器--&gt;输入--&gt;附加依赖项添加</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">4 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">bcrypt.lib
version.lib
ws2_32.lib
pathcch.lib</code></pre></div>
<p>应用上述<code class="md-code-inline">python</code>的修改</p>
<p>打开<code class="md-code-inline">Lib/site.py</code>，寻找<code class="md-code-inline">sys.winver.replace('.', '')</code>修改为<code class="md-code-inline">&quot;3.13&quot;.replace('.', '')</code>（3.13修改为你编译的python版本）</p>
<p>打开<code class="md-code-inline">Lib/_pyrepl/__main.py__</code>，在文件的开头加上</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">2 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python">__package__ = <span class="hljs-string">&#x27;_pyrepl&#x27;</span>
__path__ = [__name__]</code></pre></div>
<p>打开<code class="md-code-inline">Tools/build/freeze_modules.py</code></p>
<p>将整个文件内容替换为下面的代码</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">906 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-string">&quot;&quot;&quot;Freeze modules and regen related files (e.g. Python/frozen.c).

See the notes at the top of Python/frozen.c for more info.
&quot;&quot;&quot;</span>
<span class="hljs-keyword">import</span> subprocess


<span class="hljs-keyword">from</span> collections <span class="hljs-keyword">import</span> namedtuple
<span class="hljs-keyword">import</span> hashlib
<span class="hljs-keyword">import</span> os
<span class="hljs-keyword">import</span> ntpath
<span class="hljs-keyword">import</span> posixpath
<span class="hljs-keyword">import</span> argparse
<span class="hljs-keyword">from</span> update_file <span class="hljs-keyword">import</span> updating_file_with_tmpfile
<span class="hljs-comment"># 定义冻结模块数据结构</span>
FrozenModule1 = namedtuple(<span class="hljs-string">&#x27;FrozenModule&#x27;</span>, [
    <span class="hljs-string">&#x27;fullname&#x27;</span>,      <span class="hljs-comment"># 完整模块名（如&quot;encodings.utf_8&quot;）</span>
    <span class="hljs-string">&#x27;py_path&#x27;</span>,       <span class="hljs-comment"># 源文件路径（如&quot;Lib/encodings/utf_8.py&quot;）</span>
    <span class="hljs-string">&#x27;h_path&#x27;</span>,        <span class="hljs-comment"># 生成的头文件路径（如&quot;Python/frozen_modules/encodings/utf_8.h&quot;）</span>
    <span class="hljs-string">&#x27;c_path&#x27;</span>,        <span class="hljs-comment"># 生成的C文件路径（如&quot;Python/frozen_modules/encodings/utf_8.c&quot;）</span>
    <span class="hljs-string">&#x27;is_package&#x27;</span>     <span class="hljs-comment"># 是否为包目录</span>
])
<span class="hljs-keyword">def</span> <span class="hljs-title function_">find_python_modules</span>(<span class="hljs-params">root_dir</span>):
    <span class="hljs-string">&quot;&quot;&quot;
    递归查找所有Python模块
    返回生成器：FrozenModule对象
    &quot;&quot;&quot;</span>
    lib_dir = os.path.join(root_dir, <span class="hljs-string">&#x27;Lib&#x27;</span>)
    frozen_dir = os.path.join(root_dir, <span class="hljs-string">&#x27;Python&#x27;</span>, <span class="hljs-string">&#x27;frozen_modules&#x27;</span>)

    <span class="hljs-keyword">for</span> root, dirs, files <span class="hljs-keyword">in</span> os.walk(lib_dir):
        <span class="hljs-comment"># 计算模块相对路径（相对于Lib目录）</span>
        rel_path = os.path.relpath(root, lib_dir)
        <span class="hljs-keyword">if</span> rel_path == <span class="hljs-string">&quot;.&quot;</span>:
            namespace_parts = []
        <span class="hljs-keyword">else</span>:
            namespace_parts = rel_path.split(os.sep)

        <span class="hljs-comment"># 处理包目录（包含__init__.py）</span>
        <span class="hljs-keyword">if</span> <span class="hljs-string">&#x27;__init__.py&#x27;</span> <span class="hljs-keyword">in</span> files:
            pkg_name = <span class="hljs-string">&quot;.&quot;</span>.join(namespace_parts) <span class="hljs-keyword">if</span> namespace_parts <span class="hljs-keyword">else</span> <span class="hljs-string">&quot;&quot;</span>
            
            <span class="hljs-comment"># 生成包自身的模块信息（不要__init__.h）</span>
            <span class="hljs-keyword">yield</span> FrozenModule1(
                fullname=pkg_name,
                py_path=os.path.join(root, <span class="hljs-string">&#x27;__init__.py&#x27;</span>),
                h_path=os.path.join(frozen_dir, <span class="hljs-string">f&quot;<span class="hljs-subst">{pkg_name}</span>.h&quot;</span>) <span class="hljs-keyword">if</span> pkg_name <span class="hljs-keyword">else</span> <span class="hljs-string">&quot;&quot;</span>,
                c_path=os.path.join(frozen_dir, <span class="hljs-string">f&quot;<span class="hljs-subst">{pkg_name}</span>.c&quot;</span>) <span class="hljs-keyword">if</span> pkg_name <span class="hljs-keyword">else</span> <span class="hljs-string">&quot;&quot;</span>,
                is_package=<span class="hljs-literal">True</span>
            )

            <span class="hljs-comment"># 处理包内所有子模块</span>
            <span class="hljs-keyword">for</span> f <span class="hljs-keyword">in</span> files:
                <span class="hljs-keyword">if</span> f.endswith(<span class="hljs-string">&#x27;.py&#x27;</span>) <span class="hljs-keyword">and</span> f != <span class="hljs-string">&#x27;__init__.py&#x27;</span>:
                    mod_name = f[:-<span class="hljs-number">3</span>]
                    full_name = <span class="hljs-string">f&quot;<span class="hljs-subst">{pkg_name}</span>.<span class="hljs-subst">{mod_name}</span>&quot;</span> <span class="hljs-keyword">if</span> pkg_name <span class="hljs-keyword">else</span> mod_name
                    <span class="hljs-keyword">yield</span> FrozenModule1(
                        fullname=full_name,
                        py_path=os.path.join(root, f),
                        h_path=os.path.join(frozen_dir, <span class="hljs-string">f&quot;<span class="hljs-subst">{full_name}</span>.h&quot;</span>),
                        c_path=os.path.join(frozen_dir, <span class="hljs-string">f&quot;<span class="hljs-subst">{full_name}</span>.c&quot;</span>),
                        is_package=<span class="hljs-literal">False</span>
                    )

        <span class="hljs-comment"># 处理非包普通模块（仅限Lib根目录）</span>
        <span class="hljs-keyword">elif</span> root == lib_dir:
            <span class="hljs-keyword">for</span> f <span class="hljs-keyword">in</span> files:
                <span class="hljs-keyword">if</span> f.endswith(<span class="hljs-string">&#x27;.py&#x27;</span>):
                    mod_name = f[:-<span class="hljs-number">3</span>]
                    <span class="hljs-keyword">yield</span> FrozenModule1(
                        fullname=mod_name,
                        py_path=os.path.join(root, f),
                        h_path=os.path.join(frozen_dir, <span class="hljs-string">f&quot;<span class="hljs-subst">{mod_name}</span>.h&quot;</span>),
                        c_path=os.path.join(frozen_dir, <span class="hljs-string">f&quot;<span class="hljs-subst">{mod_name}</span>.c&quot;</span>),
                        is_package=<span class="hljs-literal">False</span>
                    )



<span class="hljs-keyword">def</span> <span class="hljs-title function_">load_auto_frozen</span>():
    filenames = []
    
    <span class="hljs-keyword">for</span> root, dirs, files <span class="hljs-keyword">in</span> os.walk(os.path.join(ROOT_DIR, <span class="hljs-string">&#x27;Python&#x27;</span>, <span class="hljs-string">&#x27;frozen_modules&#x27;</span>)):
        <span class="hljs-keyword">for</span> file <span class="hljs-keyword">in</span> files:
            <span class="hljs-keyword">if</span> file.endswith(<span class="hljs-string">&#x27;.h&#x27;</span>):
                <span class="hljs-comment"># 分离文件名和扩展名</span>
                name_without_ext = os.path.splitext(file)[<span class="hljs-number">0</span>]
                filenames.append(name_without_ext)
    <span class="hljs-built_in">print</span>(filenames)
    <span class="hljs-keyword">return</span> filenames


ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
ROOT_DIR = os.path.abspath(ROOT_DIR)
FROZEN_ONLY = os.path.join(ROOT_DIR, <span class="hljs-string">&#x27;Tools&#x27;</span>, <span class="hljs-string">&#x27;freeze&#x27;</span>, <span class="hljs-string">&#x27;flag.py&#x27;</span>)

STDLIB_DIR = os.path.join(ROOT_DIR, <span class="hljs-string">&#x27;Lib&#x27;</span>)
<span class="hljs-comment"># If FROZEN_MODULES_DIR or DEEPFROZEN_MODULES_DIR is changed then the</span>
<span class="hljs-comment"># .gitattributes and .gitignore files needs to be updated.</span>
FROZEN_MODULES_DIR = os.path.join(ROOT_DIR, <span class="hljs-string">&#x27;Python&#x27;</span>, <span class="hljs-string">&#x27;frozen_modules&#x27;</span>)

FROZEN_FILE = os.path.join(ROOT_DIR, <span class="hljs-string">&#x27;Python&#x27;</span>, <span class="hljs-string">&#x27;frozen.c&#x27;</span>)
MAKEFILE = os.path.join(ROOT_DIR, <span class="hljs-string">&#x27;Makefile.pre.in&#x27;</span>)
PCBUILD_PROJECT = os.path.join(ROOT_DIR, <span class="hljs-string">&#x27;PCbuild&#x27;</span>, <span class="hljs-string">&#x27;_freeze_module.vcxproj&#x27;</span>)
PCBUILD_FILTERS = os.path.join(ROOT_DIR, <span class="hljs-string">&#x27;PCbuild&#x27;</span>, <span class="hljs-string">&#x27;_freeze_module.vcxproj.filters&#x27;</span>)
PCBUILD_PYTHONCORE = os.path.join(ROOT_DIR, <span class="hljs-string">&#x27;PCbuild&#x27;</span>, <span class="hljs-string">&#x27;pythoncore.vcxproj&#x27;</span>)


FREEZE_MODULE_EXE = os.path.join(ROOT_DIR, <span class="hljs-string">&#x27;PCbuild&#x27;</span>, <span class="hljs-string">&#x27;amd64&#x27;</span>, <span class="hljs-string">&#x27;_freeze_module.exe&#x27;</span>)

OS_PATH = <span class="hljs-string">&#x27;ntpath&#x27;</span> <span class="hljs-keyword">if</span> os.name == <span class="hljs-string">&#x27;nt&#x27;</span> <span class="hljs-keyword">else</span> <span class="hljs-string">&#x27;posixpath&#x27;</span>

<span class="hljs-comment"># These are modules that get frozen.</span>
<span class="hljs-comment"># If you&#x27;re debugging new bytecode instructions,</span>
<span class="hljs-comment"># you can delete all sections except &#x27;import system&#x27;.</span>
<span class="hljs-comment"># This also speeds up building somewhat.</span>
TESTS_SECTION = <span class="hljs-string">&#x27;Test module&#x27;</span>
FROZEN = [
    <span class="hljs-comment"># See parse_frozen_spec() for the format.</span>
    <span class="hljs-comment"># In cases where the frozenid is duplicated, the first one is re-used.</span>
    (<span class="hljs-string">&#x27;import system&#x27;</span>, [
        *load_auto_frozen(),
        <span class="hljs-comment"># These frozen modules are necessary for bootstrapping</span>
        <span class="hljs-comment"># the import system.</span>
        <span class="hljs-string">&#x27;importlib._bootstrap : _frozen_importlib&#x27;</span>,
        <span class="hljs-string">&#x27;importlib._bootstrap_external : _frozen_importlib_external&#x27;</span>,
        <span class="hljs-comment"># This module is important because some Python builds rely</span>
        <span class="hljs-comment"># on a builtin zip file instead of a filesystem.</span>
        <span class="hljs-string">&#x27;zipimport&#x27;</span>,
        ]),
    <span class="hljs-comment"># (You can delete entries from here down to the end of the list.)</span>
    (<span class="hljs-string">&#x27;stdlib - startup, without site (python -S)&#x27;</span>, [
        <span class="hljs-string">&#x27;abc&#x27;</span>,
        <span class="hljs-string">&#x27;codecs&#x27;</span>,
        <span class="hljs-comment"># For now we do not freeze the encodings, due # to the noise all</span>
        <span class="hljs-comment"># those extra modules add to the text printed during the build.</span>
        <span class="hljs-comment"># (See https://github.com/python/cpython/pull/28398#pullrequestreview-756856469.)</span>
        <span class="hljs-comment">#&#x27;&lt;encodings.*&gt;&#x27;,</span>
        <span class="hljs-string">&#x27;io&#x27;</span>,
        ]),
    (<span class="hljs-string">&#x27;stdlib - startup, with site&#x27;</span>, [
        <span class="hljs-string">&#x27;_collections_abc&#x27;</span>,
        <span class="hljs-string">&#x27;_sitebuiltins&#x27;</span>,
        <span class="hljs-string">&#x27;genericpath&#x27;</span>,
        <span class="hljs-string">&#x27;ntpath&#x27;</span>,
        <span class="hljs-string">&#x27;posixpath&#x27;</span>,
        <span class="hljs-comment"># We must explicitly mark os.path as a frozen module</span>
        <span class="hljs-comment"># even though it will never be imported.</span>
        <span class="hljs-string">f&#x27;<span class="hljs-subst">{OS_PATH}</span> : os.path&#x27;</span>,
        <span class="hljs-string">&#x27;os&#x27;</span>,
        <span class="hljs-string">&#x27;site&#x27;</span>,
        <span class="hljs-string">&#x27;stat&#x27;</span>,
        ]),
    (<span class="hljs-string">&#x27;runpy - run module with -m&#x27;</span>, [
        <span class="hljs-string">&quot;importlib.util&quot;</span>,
        <span class="hljs-string">&quot;importlib.machinery&quot;</span>,
        <span class="hljs-string">&quot;runpy&quot;</span>,
    ]),
    (TESTS_SECTION, [
        
        <span class="hljs-string">&#x27;__hello__&#x27;</span>,
        <span class="hljs-string">&#x27;__hello__ : __hello_alias__&#x27;</span>,
        <span class="hljs-string">&#x27;__hello__ : &lt;__phello_alias__&gt;&#x27;</span>,
        <span class="hljs-string">&#x27;__hello__ : __phello_alias__.spam&#x27;</span>,
        ]),
    <span class="hljs-comment"># (End of stuff you could delete.)</span>
]
BOOTSTRAP = {
    <span class="hljs-string">&#x27;importlib._bootstrap&#x27;</span>,
    <span class="hljs-string">&#x27;importlib._bootstrap_external&#x27;</span>,
    <span class="hljs-string">&#x27;zipimport&#x27;</span>,
}


<span class="hljs-keyword">import</span> os
<span class="hljs-keyword">import</span> subprocess
<span class="hljs-keyword">from</span> collections <span class="hljs-keyword">import</span> namedtuple
<span class="hljs-keyword">import</span> shutil



<span class="hljs-keyword">def</span> <span class="hljs-title function_">generate_frozen_files</span>(<span class="hljs-params">root_dir</span>):
    <span class="hljs-string">&quot;&quot;&quot;
    核心生成函数
    &quot;&quot;&quot;</span>
    <span class="hljs-comment"># 清理旧文件</span>
    frozen_dir = os.path.join(root_dir, <span class="hljs-string">&#x27;Python&#x27;</span>, <span class="hljs-string">&#x27;frozen_modules&#x27;</span>)
    <span class="hljs-keyword">if</span> os.path.exists(frozen_dir):
        shutil.rmtree(frozen_dir)
    
    <span class="hljs-comment"># 创建冻结工具路径</span>
    freeze_tool = os.path.join(root_dir, <span class="hljs-string">&#x27;PCbuild&#x27;</span>, <span class="hljs-string">&#x27;amd64&#x27;</span>, <span class="hljs-string">&#x27;_freeze_module.exe&#x27;</span>)
    
    <span class="hljs-comment"># 遍历所有模块</span>
    <span class="hljs-keyword">for</span> module <span class="hljs-keyword">in</span> find_python_modules(root_dir):
        <span class="hljs-keyword">if</span>(module.fullname.startswith(<span class="hljs-string">&#x27;test&#x27;</span>)==<span class="hljs-literal">False</span>):
            <span class="hljs-comment"># 创建目标目录</span>
            os.makedirs(os.path.dirname(module.h_path), exist_ok=<span class="hljs-literal">True</span>)
            
            <span class="hljs-comment"># 构建命令行参数</span>
            cmd = [
                freeze_tool,
                module.fullname,
                module.py_path,
                module.h_path,
            ]
            
            <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;冻结命令: <span class="hljs-subst">{<span class="hljs-string">&#x27; &#x27;</span>.join(cmd)}</span>&quot;</span>)
            <span class="hljs-comment"># 执行冻结命令</span>
            <span class="hljs-keyword">try</span>:
                <span class="hljs-keyword">if</span>(module.is_package):
                    <span class="hljs-keyword">with</span> <span class="hljs-built_in">open</span>(module.py_path, <span class="hljs-string">&#x27;rb&#x27;</span>) <span class="hljs-keyword">as</span> f:
                        content = f.read()
                    
                    bom = <span class="hljs-string">b&#x27;&#x27;</span>
                    newline = <span class="hljs-string">b&#x27;\\n&#x27;</span>  <span class="hljs-comment"># 默认换行符</span>
                    insert_pos = <span class="hljs-number">0</span>
                    
                    <span class="hljs-comment"># 处理 BOM（UTF-8 文件头）</span>
                    <span class="hljs-keyword">if</span> content.startswith(<span class="hljs-string">b&#x27;\\xef\\xbb\\xbf&#x27;</span>):
                        bom = content[:<span class="hljs-number">3</span>]
                        content = content[<span class="hljs-number">3</span>:]
                    
                    <span class="hljs-comment"># 分割行并保留换行符</span>
                    lines = content.splitlines(keepends=<span class="hljs-literal">True</span>)
                    
                    <span class="hljs-comment"># 寻找第一个非空行</span>
                    first_non_empty_idx = <span class="hljs-literal">None</span>
                    <span class="hljs-keyword">for</span> idx, line <span class="hljs-keyword">in</span> <span class="hljs-built_in">enumerate</span>(lines):
                        <span class="hljs-keyword">if</span> line.strip():  <span class="hljs-comment"># 检查是否非空行</span>
                            first_non_empty_idx = idx
                            <span class="hljs-comment"># 检测换行符类型（优先使用第一个非空行的换行符）</span>
                            <span class="hljs-keyword">if</span> line.endswith(<span class="hljs-string">b&#x27;\\r\\n&#x27;</span>):
                                newline = <span class="hljs-string">b&#x27;\\r\\n&#x27;</span>
                            <span class="hljs-keyword">elif</span> line.endswith(<span class="hljs-string">b&#x27;\\n&#x27;</span>):
                                newline = <span class="hljs-string">b&#x27;\\n&#x27;</span>
                            <span class="hljs-keyword">break</span>
                    
                    <span class="hljs-comment"># 生成要插入的字节内容</span>
                    new_lines = [
                        <span class="hljs-string">f&quot;__package__ = &#x27;<span class="hljs-subst">{module.fullname}</span>&#x27;\\n&quot;</span>.encode(<span class="hljs-string">&#x27;utf-8&#x27;</span>) + newline,
                        <span class="hljs-string">&quot;__path__ = [__name__]\\n&quot;</span>.encode(<span class="hljs-string">&#x27;utf-8&#x27;</span>) + newline
                    ]
                    
                    <span class="hljs-comment"># 判断插入位置</span>
                    <span class="hljs-keyword">if</span> first_non_empty_idx <span class="hljs-keyword">is</span> <span class="hljs-keyword">not</span> <span class="hljs-literal">None</span>:
                        target_line = lines[first_non_empty_idx]
                        <span class="hljs-comment"># 检查是否以 from __future__ 开头（允许前导空格）</span>
                        <span class="hljs-keyword">if</span> target_line.lstrip().startswith(<span class="hljs-string">b&#x27;from __future__&#x27;</span>):
                            insert_pos = first_non_empty_idx + <span class="hljs-number">1</span>
                        <span class="hljs-keyword">else</span>:
                            insert_pos = <span class="hljs-number">0</span>
                    <span class="hljs-keyword">else</span>:
                        <span class="hljs-comment"># 整个文件都是空行，直接在开头插入</span>
                        insert_pos = <span class="hljs-number">0</span>
                    
                    <span class="hljs-comment"># 插入新内容</span>
                    <span class="hljs-keyword">if</span> insert_pos == <span class="hljs-number">0</span>:
                        <span class="hljs-comment"># 在开头插入（BOM之后）</span>
                        lines = new_lines + lines
                    <span class="hljs-keyword">else</span>:
                        <span class="hljs-comment"># 在指定位置插入</span>
                        lines[insert_pos:insert_pos] = new_lines
                    
                    <span class="hljs-comment"># 重建内容并保留BOM</span>
                    new_content = bom + <span class="hljs-string">b&#x27;&#x27;</span>.join(lines)
                    
                    <span class="hljs-comment"># 写回文件</span>
                    <span class="hljs-keyword">with</span> <span class="hljs-built_in">open</span>(module.py_path, <span class="hljs-string">&#x27;wb&#x27;</span>) <span class="hljs-keyword">as</span> f:
                        f.write(new_content)
                    <span class="hljs-comment">#with open(module.py_path, &#x27;rb+&#x27;) as f:</span>
                    <span class="hljs-comment">#    old = f.read()</span>
                    <span class="hljs-comment">#    f.seek(0)</span>
                    <span class="hljs-comment">#    f.write(old)</span>
                    <span class="hljs-comment">#    f.write(f&quot;__package__ = &#x27;{module.fullname}&#x27;\\n&quot;.encode(&quot;utf-8&quot;))</span>
                    <span class="hljs-comment">#    f.write(&quot;__path__ = [__name__]\\n&quot;.encode(&quot;utf-8&quot;))</span>
                        
                result = subprocess.run(
                    cmd,
                    check=<span class="hljs-literal">True</span>,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=<span class="hljs-literal">True</span>,
                    encoding=<span class="hljs-string">&#x27;utf-8&#x27;</span>,
                    cwd=root_dir
                )
                <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;成功冻结: <span class="hljs-subst">{module.fullname}</span>&quot;</span>)
                <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;生成文件: <span class="hljs-subst">{module.h_path}</span>&quot;</span>)
                <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;          <span class="hljs-subst">{module.c_path}</span>&quot;</span>)
                
            <span class="hljs-keyword">except</span> subprocess.CalledProcessError <span class="hljs-keyword">as</span> e:
                <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;冻结失败: <span class="hljs-subst">{module.fullname}</span>&quot;</span>)
                <span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;错误输出:&quot;</span>)
                <span class="hljs-built_in">print</span>(e.stdout)


<span class="hljs-comment">#######################################</span>
<span class="hljs-comment"># platform-specific helpers</span>

<span class="hljs-keyword">if</span> os.path <span class="hljs-keyword">is</span> posixpath:
    relpath_for_posix_display = os.path.relpath

    <span class="hljs-keyword">def</span> <span class="hljs-title function_">relpath_for_windows_display</span>(<span class="hljs-params">path, base</span>):
        <span class="hljs-keyword">return</span> ntpath.relpath(
            ntpath.join(*path.split(os.path.sep)),
            ntpath.join(*base.split(os.path.sep)),
        )

<span class="hljs-keyword">else</span>:
    relpath_for_windows_display = ntpath.relpath

    <span class="hljs-keyword">def</span> <span class="hljs-title function_">relpath_for_posix_display</span>(<span class="hljs-params">path, base</span>):
        <span class="hljs-keyword">return</span> posixpath.relpath(
            posixpath.join(*path.split(os.path.sep)),
            posixpath.join(*base.split(os.path.sep)),
        )


<span class="hljs-comment">#######################################</span>
<span class="hljs-comment"># specs</span>

<span class="hljs-keyword">def</span> <span class="hljs-title function_">parse_frozen_specs</span>():
    seen = {}
    <span class="hljs-keyword">for</span> section, specs <span class="hljs-keyword">in</span> FROZEN:
        parsed = _parse_specs(specs, section, seen)
        <span class="hljs-keyword">for</span> item <span class="hljs-keyword">in</span> parsed:
            frozenid, pyfile, modname, ispkg, section = item
            <span class="hljs-keyword">try</span>:
                source = seen[frozenid]
            <span class="hljs-keyword">except</span> KeyError:
                source = FrozenSource.from_id(frozenid, pyfile)
                seen[frozenid] = source
            <span class="hljs-keyword">else</span>:
                <span class="hljs-keyword">assert</span> <span class="hljs-keyword">not</span> pyfile <span class="hljs-keyword">or</span> pyfile == source.pyfile, item
            <span class="hljs-keyword">yield</span> FrozenModule(modname, ispkg, section, source)


<span class="hljs-keyword">def</span> <span class="hljs-title function_">_parse_specs</span>(<span class="hljs-params">specs, section, seen</span>):
    <span class="hljs-keyword">for</span> spec <span class="hljs-keyword">in</span> specs:
        info, subs = _parse_spec(spec, seen, section)
        <span class="hljs-keyword">yield</span> info
        <span class="hljs-keyword">for</span> info <span class="hljs-keyword">in</span> subs <span class="hljs-keyword">or</span> ():
            <span class="hljs-keyword">yield</span> info


<span class="hljs-keyword">def</span> <span class="hljs-title function_">_parse_spec</span>(<span class="hljs-params">spec, knownids=<span class="hljs-literal">None</span>, section=<span class="hljs-literal">None</span></span>):
    <span class="hljs-string">&quot;&quot;&quot;Yield an info tuple for each module corresponding to the given spec.

    The info consists of: (frozenid, pyfile, modname, ispkg, section).

    Supported formats:

      frozenid
      frozenid : modname
      frozenid : modname = pyfile

    &quot;frozenid&quot; and &quot;modname&quot; must be valid module names (dot-separated
    identifiers).  If &quot;modname&quot; is not provided then &quot;frozenid&quot; is used.
    If &quot;pyfile&quot; is not provided then the filename of the module
    corresponding to &quot;frozenid&quot; is used.

    Angle brackets around a frozenid (e.g. &#x27;&lt;encodings&gt;&quot;) indicate
    it is a package.  This also means it must be an actual module
    (i.e. &quot;pyfile&quot; cannot have been provided).  Such values can have
    patterns to expand submodules:

      &lt;encodings.*&gt;    - also freeze all direct submodules
      &lt;encodings.**.*&gt; - also freeze the full submodule tree

    As with &quot;frozenid&quot;, angle brackets around &quot;modname&quot; indicate
    it is a package.  However, in this case &quot;pyfile&quot; should not
    have been provided and patterns in &quot;modname&quot; are not supported.
    Also, if &quot;modname&quot; has brackets then &quot;frozenid&quot; should not,
    and &quot;pyfile&quot; should have been provided..
    &quot;&quot;&quot;</span>
    frozenid, _, remainder = spec.partition(<span class="hljs-string">&#x27;:&#x27;</span>)
    modname, _, pyfile = remainder.partition(<span class="hljs-string">&#x27;=&#x27;</span>)
    frozenid = frozenid.strip()
    modname = modname.strip()
    pyfile = pyfile.strip()

    submodules = <span class="hljs-literal">None</span>
    <span class="hljs-keyword">if</span> modname.startswith(<span class="hljs-string">&#x27;&lt;&#x27;</span>) <span class="hljs-keyword">and</span> modname.endswith(<span class="hljs-string">&#x27;&gt;&#x27;</span>):
        <span class="hljs-keyword">assert</span> check_modname(frozenid), spec
        modname = modname[<span class="hljs-number">1</span>:-<span class="hljs-number">1</span>]
        <span class="hljs-keyword">assert</span> check_modname(modname), spec
        <span class="hljs-keyword">if</span> frozenid <span class="hljs-keyword">in</span> knownids:
            <span class="hljs-keyword">pass</span>
        <span class="hljs-keyword">elif</span> pyfile:
            <span class="hljs-keyword">assert</span> <span class="hljs-keyword">not</span> os.path.isdir(pyfile), spec
        <span class="hljs-keyword">else</span>:
            pyfile = _resolve_module(frozenid, ispkg=<span class="hljs-literal">False</span>)
        ispkg = <span class="hljs-literal">True</span>
    <span class="hljs-keyword">elif</span> pyfile:
        <span class="hljs-keyword">assert</span> check_modname(frozenid), spec
        <span class="hljs-keyword">assert</span> <span class="hljs-keyword">not</span> knownids <span class="hljs-keyword">or</span> frozenid <span class="hljs-keyword">not</span> <span class="hljs-keyword">in</span> knownids, spec
        <span class="hljs-keyword">assert</span> check_modname(modname), spec
        <span class="hljs-keyword">assert</span> <span class="hljs-keyword">not</span> os.path.isdir(pyfile), spec
        ispkg = <span class="hljs-literal">False</span>
    <span class="hljs-keyword">elif</span> knownids <span class="hljs-keyword">and</span> frozenid <span class="hljs-keyword">in</span> knownids:
        <span class="hljs-keyword">assert</span> check_modname(frozenid), spec
        <span class="hljs-comment">#assert check_modname(modname), spec</span>
        ispkg = <span class="hljs-literal">False</span>
    <span class="hljs-keyword">else</span>:
        <span class="hljs-keyword">assert</span> <span class="hljs-keyword">not</span> modname <span class="hljs-keyword">or</span> check_modname(modname), spec
        resolved = <span class="hljs-built_in">iter</span>(resolve_modules(frozenid))
        frozenid, pyfile, ispkg = <span class="hljs-built_in">next</span>(resolved)
        <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> modname:
            modname = frozenid
        <span class="hljs-keyword">if</span> ispkg:
            pkgid = frozenid
            pkgname = modname
            pkgfiles = {pyfile: pkgid}
            <span class="hljs-keyword">def</span> <span class="hljs-title function_">iter_subs</span>():
                <span class="hljs-keyword">for</span> frozenid, pyfile, ispkg <span class="hljs-keyword">in</span> resolved:
                    <span class="hljs-keyword">if</span> pkgname:
                        modname = frozenid.replace(pkgid, pkgname, <span class="hljs-number">1</span>)
                    <span class="hljs-keyword">else</span>:
                        modname = frozenid
                    <span class="hljs-keyword">if</span> pyfile:
                        <span class="hljs-keyword">if</span> pyfile <span class="hljs-keyword">in</span> pkgfiles:
                            frozenid = pkgfiles[pyfile]
                            pyfile = <span class="hljs-literal">None</span>
                        <span class="hljs-keyword">elif</span> ispkg:
                            pkgfiles[pyfile] = frozenid
                    <span class="hljs-keyword">yield</span> frozenid, pyfile, modname, ispkg, section
            submodules = iter_subs()

    info = (frozenid, pyfile <span class="hljs-keyword">or</span> <span class="hljs-literal">None</span>, modname, ispkg, section)
    <span class="hljs-keyword">return</span> info, submodules


<span class="hljs-comment">#######################################</span>
<span class="hljs-comment"># frozen source files</span>

<span class="hljs-keyword">class</span> <span class="hljs-title class_">FrozenSource</span>(namedtuple(<span class="hljs-string">&#x27;FrozenSource&#x27;</span>, <span class="hljs-string">&#x27;id pyfile frozenfile&#x27;</span>)):

<span class="hljs-meta">    @classmethod</span>
    <span class="hljs-keyword">def</span> <span class="hljs-title function_">from_id</span>(<span class="hljs-params">cls, frozenid, pyfile=<span class="hljs-literal">None</span></span>):
        <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> pyfile:
            pyfile = os.path.join(STDLIB_DIR, *frozenid.split(<span class="hljs-string">&#x27;.&#x27;</span>)) + <span class="hljs-string">&#x27;.py&#x27;</span>
            <span class="hljs-comment">#assert os.path.exists(pyfile), (frozenid, pyfile)</span>
        <span class="hljs-comment">#print(frozenid)</span>
        frozenfile = resolve_frozen_file(frozenid, FROZEN_MODULES_DIR)
        <span class="hljs-keyword">return</span> cls(frozenid, pyfile, frozenfile)

<span class="hljs-meta">    @property</span>
    <span class="hljs-keyword">def</span> <span class="hljs-title function_">frozenid</span>(<span class="hljs-params">self</span>):
        <span class="hljs-keyword">return</span> <span class="hljs-variable language_">self</span>.<span class="hljs-built_in">id</span>

<span class="hljs-meta">    @property</span>
    <span class="hljs-keyword">def</span> <span class="hljs-title function_">modname</span>(<span class="hljs-params">self</span>):
        <span class="hljs-keyword">if</span> <span class="hljs-variable language_">self</span>.pyfile.startswith(STDLIB_DIR):
            <span class="hljs-keyword">return</span> <span class="hljs-variable language_">self</span>.<span class="hljs-built_in">id</span>
        <span class="hljs-keyword">return</span> <span class="hljs-literal">None</span>

<span class="hljs-meta">    @property</span>
    <span class="hljs-keyword">def</span> <span class="hljs-title function_">symbol</span>(<span class="hljs-params">self</span>):
        <span class="hljs-comment"># This matches what we do in Programs/_freeze_module.c:</span>
        name = <span class="hljs-variable language_">self</span>.frozenid.replace(<span class="hljs-string">&#x27;.&#x27;</span>, <span class="hljs-string">&#x27;_&#x27;</span>)
        <span class="hljs-keyword">return</span> <span class="hljs-string">&#x27;_Py_M__&#x27;</span> + name

<span class="hljs-meta">    @property</span>
    <span class="hljs-keyword">def</span> <span class="hljs-title function_">ispkg</span>(<span class="hljs-params">self</span>):
        <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> <span class="hljs-variable language_">self</span>.pyfile:
            <span class="hljs-keyword">return</span> <span class="hljs-literal">False</span>
        <span class="hljs-keyword">elif</span> <span class="hljs-variable language_">self</span>.frozenid.endswith(<span class="hljs-string">&#x27;.__init__&#x27;</span>):
            <span class="hljs-keyword">return</span> <span class="hljs-literal">False</span>
        <span class="hljs-keyword">else</span>:
            <span class="hljs-keyword">return</span> os.path.basename(<span class="hljs-variable language_">self</span>.pyfile) == <span class="hljs-string">&#x27;__init__.py&#x27;</span>

<span class="hljs-meta">    @property</span>
    <span class="hljs-keyword">def</span> <span class="hljs-title function_">isbootstrap</span>(<span class="hljs-params">self</span>):
        <span class="hljs-keyword">return</span> <span class="hljs-variable language_">self</span>.<span class="hljs-built_in">id</span> <span class="hljs-keyword">in</span> BOOTSTRAP


<span class="hljs-keyword">def</span> <span class="hljs-title function_">resolve_frozen_file</span>(<span class="hljs-params">frozenid, destdir</span>):
    <span class="hljs-string">&quot;&quot;&quot;Return the filename corresponding to the given frozen ID.

    For stdlib modules the ID will always be the full name
    of the source module.
    &quot;&quot;&quot;</span>
    <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> <span class="hljs-built_in">isinstance</span>(frozenid, <span class="hljs-built_in">str</span>):
        <span class="hljs-keyword">try</span>:
            frozenid = frozenid.frozenid
        <span class="hljs-keyword">except</span> AttributeError:
            <span class="hljs-keyword">raise</span> ValueError(<span class="hljs-string">f&#x27;unsupported frozenid <span class="hljs-subst">{frozenid!r}</span>&#x27;</span>)
    <span class="hljs-comment"># We use a consistent naming convention for all frozen modules.</span>
    frozenfile = <span class="hljs-string">f&#x27;<span class="hljs-subst">{frozenid}</span>.h&#x27;</span>
    <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> destdir:
        <span class="hljs-keyword">return</span> frozenfile
    <span class="hljs-keyword">return</span> os.path.join(destdir, frozenfile)


<span class="hljs-comment">#######################################</span>
<span class="hljs-comment"># frozen modules</span>

<span class="hljs-keyword">class</span> <span class="hljs-title class_">FrozenModule</span>(namedtuple(<span class="hljs-string">&#x27;FrozenModule&#x27;</span>, <span class="hljs-string">&#x27;name ispkg section source&#x27;</span>)):

    <span class="hljs-keyword">def</span> <span class="hljs-title function_">__getattr__</span>(<span class="hljs-params">self, name</span>):
        <span class="hljs-keyword">return</span> <span class="hljs-built_in">getattr</span>(<span class="hljs-variable language_">self</span>.source, name)

<span class="hljs-meta">    @property</span>
    <span class="hljs-keyword">def</span> <span class="hljs-title function_">modname</span>(<span class="hljs-params">self</span>):
        <span class="hljs-keyword">return</span> <span class="hljs-variable language_">self</span>.name

<span class="hljs-meta">    @property</span>
    <span class="hljs-keyword">def</span> <span class="hljs-title function_">orig</span>(<span class="hljs-params">self</span>):
        <span class="hljs-keyword">return</span> <span class="hljs-variable language_">self</span>.source.modname

<span class="hljs-meta">    @property</span>
    <span class="hljs-keyword">def</span> <span class="hljs-title function_">isalias</span>(<span class="hljs-params">self</span>):
        orig = <span class="hljs-variable language_">self</span>.source.modname
        <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> orig:
            <span class="hljs-keyword">return</span> <span class="hljs-literal">True</span>
        <span class="hljs-keyword">return</span> <span class="hljs-variable language_">self</span>.name != orig

    <span class="hljs-keyword">def</span> <span class="hljs-title function_">summarize</span>(<span class="hljs-params">self</span>):
        source = <span class="hljs-variable language_">self</span>.source.modname
        <span class="hljs-keyword">if</span> source:
            source = <span class="hljs-string">f&#x27;&lt;<span class="hljs-subst">{source}</span>&gt;&#x27;</span>
        <span class="hljs-keyword">else</span>:
            source = relpath_for_posix_display(<span class="hljs-variable language_">self</span>.pyfile, ROOT_DIR)
        <span class="hljs-keyword">return</span> {
            <span class="hljs-string">&#x27;module&#x27;</span>: <span class="hljs-variable language_">self</span>.name,
            <span class="hljs-string">&#x27;ispkg&#x27;</span>: <span class="hljs-variable language_">self</span>.ispkg,
            <span class="hljs-string">&#x27;source&#x27;</span>: source,
            <span class="hljs-string">&#x27;frozen&#x27;</span>: os.path.basename(<span class="hljs-variable language_">self</span>.frozenfile),
            <span class="hljs-string">&#x27;checksum&#x27;</span>: _get_checksum(<span class="hljs-variable language_">self</span>.frozenfile),
        }


<span class="hljs-keyword">def</span> <span class="hljs-title function_">_iter_sources</span>(<span class="hljs-params">modules</span>):
    seen = <span class="hljs-built_in">set</span>()
    <span class="hljs-keyword">for</span> mod <span class="hljs-keyword">in</span> modules:
        <span class="hljs-keyword">if</span> mod.source <span class="hljs-keyword">not</span> <span class="hljs-keyword">in</span> seen:
            <span class="hljs-keyword">yield</span> mod.source
            seen.add(mod.source)


<span class="hljs-comment">#######################################</span>
<span class="hljs-comment"># generic helpers</span>

<span class="hljs-keyword">def</span> <span class="hljs-title function_">_get_checksum</span>(<span class="hljs-params">filename</span>):
    <span class="hljs-keyword">with</span> <span class="hljs-built_in">open</span>(filename, <span class="hljs-string">&quot;rb&quot;</span>) <span class="hljs-keyword">as</span> infile:
        contents = infile.read()
    m = hashlib.sha256()
    m.update(contents)
    <span class="hljs-keyword">return</span> m.hexdigest()


<span class="hljs-keyword">def</span> <span class="hljs-title function_">resolve_modules</span>(<span class="hljs-params">modname, pyfile=<span class="hljs-literal">None</span></span>):
    <span class="hljs-string">&quot;&quot;&quot;自动识别包目录和普通模块&quot;&quot;&quot;</span>
    <span class="hljs-comment"># 自动检测包结构</span>
    <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> pyfile:
        pyfile = _resolve_module(modname, ispkg=<span class="hljs-literal">False</span>)
        <span class="hljs-keyword">if</span> os.path.isdir(pyfile):
            pyfile = os.path.join(pyfile, <span class="hljs-string">&#x27;__init__.py&#x27;</span>)
    
    ispkg = <span class="hljs-literal">False</span>
    <span class="hljs-comment"># 检查是否为包</span>
    <span class="hljs-keyword">if</span> os.path.basename(pyfile) == <span class="hljs-string">&#x27;__init__.py&#x27;</span>:
        ispkg = <span class="hljs-literal">True</span>
        actual_path = os.path.dirname(pyfile)
    <span class="hljs-keyword">else</span>:
        actual_path = pyfile
    
    <span class="hljs-comment"># 处理包目录的递归发现</span>
    <span class="hljs-keyword">if</span> os.path.isdir(actual_path):
        ispkg = <span class="hljs-literal">True</span>
        <span class="hljs-keyword">yield</span> <span class="hljs-keyword">from</span> _find_package_modules(modname, actual_path)
    <span class="hljs-keyword">else</span>:
        <span class="hljs-keyword">yield</span> modname, pyfile, ispkg

<span class="hljs-keyword">def</span> <span class="hljs-title function_">_find_package_modules</span>(<span class="hljs-params">pkgname, pkgdir</span>):
    <span class="hljs-string">&quot;&quot;&quot;递归发现包内所有子模块&quot;&quot;&quot;</span>
    <span class="hljs-keyword">yield</span> pkgname, os.path.join(pkgdir, <span class="hljs-string">&#x27;__init__.py&#x27;</span>), <span class="hljs-literal">True</span>
    
    <span class="hljs-keyword">for</span> root, dirs, files <span class="hljs-keyword">in</span> os.walk(pkgdir):
        rel_path = os.path.relpath(root, pkgdir).replace(os.sep, <span class="hljs-string">&#x27;.&#x27;</span>)
        <span class="hljs-keyword">if</span> rel_path == <span class="hljs-string">&#x27;.&#x27;</span>:
            rel_path = <span class="hljs-string">&#x27;&#x27;</span>
        
        <span class="hljs-keyword">for</span> f <span class="hljs-keyword">in</span> files:
            <span class="hljs-keyword">if</span> f.endswith(<span class="hljs-string">&#x27;.py&#x27;</span>) <span class="hljs-keyword">and</span> f != <span class="hljs-string">&#x27;__init__.py&#x27;</span>:
                modname = <span class="hljs-string">f&#x27;<span class="hljs-subst">{pkgname}</span>.<span class="hljs-subst">{rel_path}</span>.<span class="hljs-subst">{f[:-<span class="hljs-number">3</span>]}</span>&#x27;</span> <span class="hljs-keyword">if</span> rel_path <span class="hljs-keyword">else</span> <span class="hljs-string">f&#x27;<span class="hljs-subst">{pkgname}</span>.<span class="hljs-subst">{f[:-<span class="hljs-number">3</span>]}</span>&#x27;</span>
                <span class="hljs-keyword">yield</span> modname, os.path.join(root, f), <span class="hljs-literal">False</span>
        
        <span class="hljs-keyword">for</span> d <span class="hljs-keyword">in</span> dirs:
            subdir = os.path.join(root, d)
            <span class="hljs-keyword">if</span> os.path.exists(os.path.join(subdir, <span class="hljs-string">&#x27;__init__.py&#x27;</span>)):
                submod = <span class="hljs-string">f&#x27;<span class="hljs-subst">{pkgname}</span>.<span class="hljs-subst">{rel_path}</span>.<span class="hljs-subst">{d}</span>&#x27;</span> <span class="hljs-keyword">if</span> rel_path <span class="hljs-keyword">else</span> <span class="hljs-string">f&#x27;<span class="hljs-subst">{pkgname}</span>.<span class="hljs-subst">{d}</span>&#x27;</span>
                <span class="hljs-keyword">yield</span> <span class="hljs-keyword">from</span> _find_package_modules(submod, subdir)

<span class="hljs-keyword">def</span> <span class="hljs-title function_">check_modname</span>(<span class="hljs-params">modname</span>):
    <span class="hljs-built_in">print</span>(modname)
    <span class="hljs-keyword">return</span> <span class="hljs-built_in">all</span>(n.isidentifier() <span class="hljs-keyword">for</span> n <span class="hljs-keyword">in</span> modname.split(<span class="hljs-string">&#x27;.&#x27;</span>))


<span class="hljs-keyword">def</span> <span class="hljs-title function_">iter_submodules</span>(<span class="hljs-params">pkgname, pkgdir=<span class="hljs-literal">None</span>, <span class="hljs-keyword">match</span>=<span class="hljs-string">&#x27;*&#x27;</span></span>):
    <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> pkgdir:
        pkgdir = os.path.join(STDLIB_DIR, *pkgname.split(<span class="hljs-string">&#x27;.&#x27;</span>))
    <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> <span class="hljs-keyword">match</span>:
        <span class="hljs-keyword">match</span> = <span class="hljs-string">&#x27;**.*&#x27;</span>
    match_modname = _resolve_modname_matcher(<span class="hljs-keyword">match</span>, pkgdir)

    <span class="hljs-keyword">def</span> <span class="hljs-title function_">_iter_submodules</span>(<span class="hljs-params">pkgname, pkgdir</span>):
        <span class="hljs-keyword">for</span> entry <span class="hljs-keyword">in</span> <span class="hljs-built_in">sorted</span>(os.scandir(pkgdir), key=<span class="hljs-keyword">lambda</span> e: e.name):
            matched, recursive = match_modname(entry.name)
            <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> matched:
                <span class="hljs-keyword">continue</span>
            modname = <span class="hljs-string">f&#x27;<span class="hljs-subst">{pkgname}</span>.<span class="hljs-subst">{entry.name}</span>&#x27;</span>
            <span class="hljs-keyword">if</span> modname.endswith(<span class="hljs-string">&#x27;.py&#x27;</span>):
                <span class="hljs-keyword">yield</span> modname[:-<span class="hljs-number">3</span>], entry.path, <span class="hljs-literal">False</span>
            <span class="hljs-keyword">elif</span> entry.is_dir():
                pyfile = os.path.join(entry.path, <span class="hljs-string">&#x27;__init__.py&#x27;</span>)
                <span class="hljs-comment"># We ignore namespace packages.</span>
                <span class="hljs-keyword">if</span> os.path.exists(pyfile):
                    <span class="hljs-keyword">yield</span> modname, pyfile, <span class="hljs-literal">True</span>
                    <span class="hljs-keyword">if</span> recursive:
                        <span class="hljs-keyword">yield</span> <span class="hljs-keyword">from</span> _iter_submodules(modname, entry.path)

    <span class="hljs-keyword">return</span> _iter_submodules(pkgname, pkgdir)


<span class="hljs-keyword">def</span> <span class="hljs-title function_">_resolve_modname_matcher</span>(<span class="hljs-params"><span class="hljs-keyword">match</span>, rootdir=<span class="hljs-literal">None</span></span>):
    <span class="hljs-keyword">if</span> <span class="hljs-built_in">isinstance</span>(<span class="hljs-keyword">match</span>, <span class="hljs-built_in">str</span>):
        <span class="hljs-keyword">if</span> <span class="hljs-keyword">match</span>.startswith(<span class="hljs-string">&#x27;**.&#x27;</span>):
            recursive = <span class="hljs-literal">True</span>
            pat = <span class="hljs-keyword">match</span>[<span class="hljs-number">3</span>:]
            <span class="hljs-keyword">assert</span> <span class="hljs-keyword">match</span>
        <span class="hljs-keyword">else</span>:
            recursive = <span class="hljs-literal">False</span>
            pat = <span class="hljs-keyword">match</span>

        <span class="hljs-keyword">if</span> pat == <span class="hljs-string">&#x27;*&#x27;</span>:
            <span class="hljs-keyword">def</span> <span class="hljs-title function_">match_modname</span>(<span class="hljs-params">modname</span>):
                <span class="hljs-keyword">return</span> <span class="hljs-literal">True</span>, recursive
        <span class="hljs-keyword">else</span>:
            <span class="hljs-keyword">raise</span> NotImplementedError(<span class="hljs-keyword">match</span>)
    <span class="hljs-keyword">elif</span> <span class="hljs-built_in">callable</span>(<span class="hljs-keyword">match</span>):
        match_modname = <span class="hljs-keyword">match</span>(rootdir)
    <span class="hljs-keyword">else</span>:
        <span class="hljs-keyword">raise</span> ValueError(<span class="hljs-string">f&#x27;unsupported matcher <span class="hljs-subst">{<span class="hljs-keyword">match</span>!r}</span>&#x27;</span>)
    <span class="hljs-keyword">return</span> match_modname


<span class="hljs-keyword">def</span> <span class="hljs-title function_">_resolve_module</span>(<span class="hljs-params">modname, pathentry=STDLIB_DIR, ispkg=<span class="hljs-literal">False</span></span>):
    <span class="hljs-keyword">assert</span> pathentry, pathentry
    pathentry = os.path.normpath(pathentry)
    <span class="hljs-keyword">assert</span> os.path.isabs(pathentry)
    <span class="hljs-keyword">if</span> ispkg:
        <span class="hljs-keyword">return</span> os.path.join(pathentry, *modname.split(<span class="hljs-string">&#x27;.&#x27;</span>), <span class="hljs-string">&#x27;__init__.py&#x27;</span>)
    <span class="hljs-keyword">return</span> os.path.join(pathentry, *modname.split(<span class="hljs-string">&#x27;.&#x27;</span>)) + <span class="hljs-string">&#x27;.py&#x27;</span>


<span class="hljs-comment">#######################################</span>
<span class="hljs-comment"># regenerating dependent files</span>

<span class="hljs-keyword">def</span> <span class="hljs-title function_">find_marker</span>(<span class="hljs-params">lines, marker, file</span>):
    <span class="hljs-keyword">for</span> pos, line <span class="hljs-keyword">in</span> <span class="hljs-built_in">enumerate</span>(lines):
        <span class="hljs-keyword">if</span> marker <span class="hljs-keyword">in</span> line:
            <span class="hljs-keyword">return</span> pos
    <span class="hljs-keyword">raise</span> Exception(<span class="hljs-string">f&quot;Can&#x27;t find <span class="hljs-subst">{marker!r}</span> in file <span class="hljs-subst">{file}</span>&quot;</span>)


<span class="hljs-keyword">def</span> <span class="hljs-title function_">replace_block</span>(<span class="hljs-params">lines, start_marker, end_marker, replacements, file</span>):
    start_pos = find_marker(lines, start_marker, file)
    end_pos = find_marker(lines, end_marker, file)
    <span class="hljs-keyword">if</span> end_pos &lt;= start_pos:
        <span class="hljs-keyword">raise</span> Exception(<span class="hljs-string">f&quot;End marker <span class="hljs-subst">{end_marker!r}</span> &quot;</span>
                        <span class="hljs-string">f&quot;occurs before start marker <span class="hljs-subst">{start_marker!r}</span> &quot;</span>
                        <span class="hljs-string">f&quot;in file <span class="hljs-subst">{file}</span>&quot;</span>)
    replacements = [line.rstrip() + <span class="hljs-string">&#x27;\\n&#x27;</span> <span class="hljs-keyword">for</span> line <span class="hljs-keyword">in</span> replacements]
    <span class="hljs-keyword">return</span> lines[:start_pos + <span class="hljs-number">1</span>] + replacements + lines[end_pos:]


<span class="hljs-keyword">class</span> <span class="hljs-title class_">UniqueList</span>(<span class="hljs-title class_ inherited__">list</span>):
    <span class="hljs-keyword">def</span> <span class="hljs-title function_">__init__</span>(<span class="hljs-params">self</span>):
        <span class="hljs-variable language_">self</span>._seen = <span class="hljs-built_in">set</span>()

    <span class="hljs-keyword">def</span> <span class="hljs-title function_">append</span>(<span class="hljs-params">self, item</span>):
        <span class="hljs-keyword">if</span> item <span class="hljs-keyword">in</span> <span class="hljs-variable language_">self</span>._seen:
            <span class="hljs-keyword">return</span>
        <span class="hljs-built_in">super</span>().append(item)
        <span class="hljs-variable language_">self</span>._seen.add(item)


<span class="hljs-keyword">def</span> <span class="hljs-title function_">regen_frozen</span>(<span class="hljs-params">modules</span>):
    headerlines = []
    parentdir = os.path.dirname(FROZEN_FILE)
    <span class="hljs-keyword">for</span> src <span class="hljs-keyword">in</span> _iter_sources(modules):
        <span class="hljs-comment"># Adding a comment to separate sections here doesn&#x27;t add much,</span>
        <span class="hljs-comment"># so we don&#x27;t.</span>
        header = relpath_for_posix_display(src.frozenfile, parentdir)
        headerlines.append(<span class="hljs-string">f&#x27;#include &quot;<span class="hljs-subst">{header}</span>&quot;&#x27;</span>)

    externlines = UniqueList()
    bootstraplines = []
    stdliblines = []
    testlines = []
    aliaslines = []
    indent = <span class="hljs-string">&#x27;    &#x27;</span>
    lastsection = <span class="hljs-literal">None</span>
    <span class="hljs-keyword">for</span> mod <span class="hljs-keyword">in</span> modules:
        <span class="hljs-keyword">if</span> mod.isbootstrap:
            lines = bootstraplines
        <span class="hljs-keyword">elif</span> mod.section == TESTS_SECTION:
            lines = testlines
        <span class="hljs-keyword">else</span>:
            lines = stdliblines
            <span class="hljs-keyword">if</span> mod.section != lastsection:
                <span class="hljs-keyword">if</span> lastsection <span class="hljs-keyword">is</span> <span class="hljs-keyword">not</span> <span class="hljs-literal">None</span>:
                    lines.append(<span class="hljs-string">&#x27;&#x27;</span>)
                lines.append(<span class="hljs-string">f&#x27;/* <span class="hljs-subst">{mod.section}</span> */&#x27;</span>)
            lastsection = mod.section

        pkg = <span class="hljs-string">&#x27;true&#x27;</span> <span class="hljs-keyword">if</span> mod.ispkg <span class="hljs-keyword">else</span> <span class="hljs-string">&#x27;false&#x27;</span>
        size = <span class="hljs-string">f&quot;(int)sizeof(<span class="hljs-subst">{mod.symbol}</span>)&quot;</span>
        line = <span class="hljs-string">f&#x27;{{&quot;<span class="hljs-subst">{mod.name}</span>&quot;, <span class="hljs-subst">{mod.symbol}</span>, <span class="hljs-subst">{size}</span>, <span class="hljs-subst">{pkg}</span>}},&#x27;</span>
        lines.append(line)

        <span class="hljs-keyword">if</span> mod.isalias:
            <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> mod.orig:
                entry = <span class="hljs-string">&#x27;{&quot;%s&quot;, NULL},&#x27;</span> % (mod.name,)
            <span class="hljs-keyword">elif</span> mod.source.ispkg:
                entry = <span class="hljs-string">&#x27;{&quot;%s&quot;, &quot;&lt;%s&quot;},&#x27;</span> % (mod.name, mod.orig)
            <span class="hljs-keyword">else</span>:
                entry = <span class="hljs-string">&#x27;{&quot;%s&quot;, &quot;%s&quot;},&#x27;</span> % (mod.name, mod.orig)
            aliaslines.append(indent + entry)

    <span class="hljs-keyword">for</span> lines <span class="hljs-keyword">in</span> (bootstraplines, stdliblines, testlines):
        <span class="hljs-comment"># <span class="hljs-doctag">TODO:</span> Is this necessary any more?</span>
        <span class="hljs-keyword">if</span> lines <span class="hljs-keyword">and</span> <span class="hljs-keyword">not</span> lines[<span class="hljs-number">0</span>]:
            <span class="hljs-keyword">del</span> lines[<span class="hljs-number">0</span>]
        <span class="hljs-keyword">for</span> i, line <span class="hljs-keyword">in</span> <span class="hljs-built_in">enumerate</span>(lines):
            <span class="hljs-keyword">if</span> line:
                lines[i] = indent + line

    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&#x27;# Updating <span class="hljs-subst">{os.path.relpath(FROZEN_FILE)}</span>&#x27;</span>)
    <span class="hljs-keyword">with</span> updating_file_with_tmpfile(FROZEN_FILE) <span class="hljs-keyword">as</span> (infile, outfile):
        lines = infile.readlines()
        <span class="hljs-comment"># <span class="hljs-doctag">TODO:</span> Use more obvious markers, e.g.</span>
        <span class="hljs-comment"># $START GENERATED FOOBAR$ / $END GENERATED FOOBAR$</span>
        lines = replace_block(
            lines,
            <span class="hljs-string">&quot;/* Includes for frozen modules: */&quot;</span>,
            <span class="hljs-string">&quot;/* End includes */&quot;</span>,
            headerlines,
            FROZEN_FILE,
        )
        lines = replace_block(
            lines,
            <span class="hljs-string">&quot;static const struct _frozen bootstrap_modules[] =&quot;</span>,
            <span class="hljs-string">&quot;/* bootstrap sentinel */&quot;</span>,
            bootstraplines,
            FROZEN_FILE,
        )
        lines = replace_block(
            lines,
            <span class="hljs-string">&quot;static const struct _frozen stdlib_modules[] =&quot;</span>,
            <span class="hljs-string">&quot;/* stdlib sentinel */&quot;</span>,
            stdliblines,
            FROZEN_FILE,
        )
        lines = replace_block(
            lines,
            <span class="hljs-string">&quot;static const struct _frozen test_modules[] =&quot;</span>,
            <span class="hljs-string">&quot;/* test sentinel */&quot;</span>,
            testlines,
            FROZEN_FILE,
        )
        lines = replace_block(
            lines,
            <span class="hljs-string">&quot;const struct _module_alias aliases[] =&quot;</span>,
            <span class="hljs-string">&quot;/* aliases sentinel */&quot;</span>,
            aliaslines,
            FROZEN_FILE,
        )
        outfile.writelines(lines)


<span class="hljs-keyword">def</span> <span class="hljs-title function_">regen_makefile</span>(<span class="hljs-params">modules</span>):
    pyfiles = []
    frozenfiles = []
    rules = [<span class="hljs-string">&#x27;&#x27;</span>]
    <span class="hljs-keyword">for</span> src <span class="hljs-keyword">in</span> _iter_sources(modules):
        frozen_header = relpath_for_posix_display(src.frozenfile, ROOT_DIR)
        frozenfiles.append(<span class="hljs-string">f&#x27;\\t\\t<span class="hljs-subst">{frozen_header}</span> \\\\&#x27;</span>)
        <span class="hljs-comment">#print(frozen_header)</span>
        pyfile = relpath_for_posix_display(src.pyfile, ROOT_DIR)
        pyfiles.append(<span class="hljs-string">f&#x27;\\t\\t<span class="hljs-subst">{pyfile}</span> \\\\&#x27;</span>)

        <span class="hljs-keyword">if</span> src.isbootstrap:
            freezecmd = <span class="hljs-string">&#x27;$(FREEZE_MODULE_BOOTSTRAP)&#x27;</span>
            freezedep = <span class="hljs-string">&#x27;$(FREEZE_MODULE_BOOTSTRAP_DEPS)&#x27;</span>
        <span class="hljs-keyword">else</span>:
            freezecmd = <span class="hljs-string">&#x27;$(FREEZE_MODULE)&#x27;</span>
            freezedep = <span class="hljs-string">&#x27;$(FREEZE_MODULE_DEPS)&#x27;</span>

        freeze = (<span class="hljs-string">f&#x27;<span class="hljs-subst">{freezecmd}</span> <span class="hljs-subst">{src.frozenid}</span> &#x27;</span>
                    <span class="hljs-string">f&#x27;$(srcdir)/<span class="hljs-subst">{pyfile}</span> <span class="hljs-subst">{frozen_header}</span>&#x27;</span>)
        rules.extend([
            <span class="hljs-string">f&#x27;<span class="hljs-subst">{frozen_header}</span>: <span class="hljs-subst">{pyfile}</span> <span class="hljs-subst">{freezedep}</span>&#x27;</span>,
            <span class="hljs-string">f&#x27;\\t<span class="hljs-subst">{freeze}</span>&#x27;</span>,
            <span class="hljs-string">&#x27;&#x27;</span>,
        ])
    pyfiles[-<span class="hljs-number">1</span>] = pyfiles[-<span class="hljs-number">1</span>].rstrip(<span class="hljs-string">&quot; \\\\&quot;</span>)
    frozenfiles[-<span class="hljs-number">1</span>] = frozenfiles[-<span class="hljs-number">1</span>].rstrip(<span class="hljs-string">&quot; \\\\&quot;</span>)

    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&#x27;# Updating <span class="hljs-subst">{os.path.relpath(MAKEFILE)}</span>&#x27;</span>)
    <span class="hljs-keyword">with</span> updating_file_with_tmpfile(MAKEFILE) <span class="hljs-keyword">as</span> (infile, outfile):
        lines = infile.readlines()
        lines = replace_block(
            lines,
            <span class="hljs-string">&quot;FROZEN_FILES_IN =&quot;</span>,
            <span class="hljs-string">&quot;# End FROZEN_FILES_IN&quot;</span>,
            pyfiles,
            MAKEFILE,
        )
        lines = replace_block(
            lines,
            <span class="hljs-string">&quot;FROZEN_FILES_OUT =&quot;</span>,
            <span class="hljs-string">&quot;# End FROZEN_FILES_OUT&quot;</span>,
            frozenfiles,
            MAKEFILE,
        )
        lines = replace_block(
            lines,
            <span class="hljs-string">&quot;# BEGIN: freezing modules&quot;</span>,
            <span class="hljs-string">&quot;# END: freezing modules&quot;</span>,
            rules,
            MAKEFILE,
        )
        outfile.writelines(lines)


<span class="hljs-keyword">def</span> <span class="hljs-title function_">regen_pcbuild</span>(<span class="hljs-params">modules</span>):
    projlines = []
    filterlines = []
    corelines = []
    <span class="hljs-keyword">for</span> src <span class="hljs-keyword">in</span> _iter_sources(modules):
        pyfile = relpath_for_windows_display(src.pyfile, ROOT_DIR)
        header = relpath_for_windows_display(src.frozenfile, ROOT_DIR)
        intfile = ntpath.splitext(ntpath.basename(header))[<span class="hljs-number">0</span>] + <span class="hljs-string">&#x27;.g.h&#x27;</span>
        projlines.append(<span class="hljs-string">f&#x27;    &lt;None Include=&quot;..\\\\<span class="hljs-subst">{pyfile}</span>&quot;&gt;&#x27;</span>)
        projlines.append(<span class="hljs-string">f&#x27;      &lt;ModName&gt;<span class="hljs-subst">{src.frozenid}</span>&lt;/ModName&gt;&#x27;</span>)
        projlines.append(<span class="hljs-string">f&#x27;      &lt;IntFile&gt;$(IntDir)<span class="hljs-subst">{intfile}</span>&lt;/IntFile&gt;&#x27;</span>)
        projlines.append(<span class="hljs-string">f&#x27;      &lt;OutFile&gt;$(GeneratedFrozenModulesDir)<span class="hljs-subst">{header}</span>&lt;/OutFile&gt;&#x27;</span>)
        projlines.append(<span class="hljs-string">f&#x27;    &lt;/None&gt;&#x27;</span>)

        filterlines.append(<span class="hljs-string">f&#x27;    &lt;None Include=&quot;..\\\\<span class="hljs-subst">{pyfile}</span>&quot;&gt;&#x27;</span>)
        filterlines.append(<span class="hljs-string">&#x27;      &lt;Filter&gt;Python Files&lt;/Filter&gt;&#x27;</span>)
        filterlines.append(<span class="hljs-string">&#x27;    &lt;/None&gt;&#x27;</span>)

    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&#x27;# Updating <span class="hljs-subst">{os.path.relpath(PCBUILD_PROJECT)}</span>&#x27;</span>)
    <span class="hljs-keyword">with</span> updating_file_with_tmpfile(PCBUILD_PROJECT) <span class="hljs-keyword">as</span> (infile, outfile):
        lines = infile.readlines()
        lines = replace_block(
            lines,
            <span class="hljs-string">&#x27;&lt;!-- BEGIN frozen modules --&gt;&#x27;</span>,
            <span class="hljs-string">&#x27;&lt;!-- END frozen modules --&gt;&#x27;</span>,
            projlines,
            PCBUILD_PROJECT,
        )
        outfile.writelines(lines)
    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&#x27;# Updating <span class="hljs-subst">{os.path.relpath(PCBUILD_FILTERS)}</span>&#x27;</span>)
    <span class="hljs-keyword">with</span> updating_file_with_tmpfile(PCBUILD_FILTERS) <span class="hljs-keyword">as</span> (infile, outfile):
        lines = infile.readlines()
        lines = replace_block(
            lines,
            <span class="hljs-string">&#x27;&lt;!-- BEGIN frozen modules --&gt;&#x27;</span>,
            <span class="hljs-string">&#x27;&lt;!-- END frozen modules --&gt;&#x27;</span>,
            filterlines,
            PCBUILD_FILTERS,
        )
        outfile.writelines(lines)


<span class="hljs-comment">#######################################</span>
<span class="hljs-comment"># the script</span>

<span class="hljs-keyword">def</span> <span class="hljs-title function_">main</span>():
    parser = argparse.ArgumentParser()
    <span class="hljs-comment">#generate_frozen_files(ROOT_DIR)</span>
    <span class="hljs-comment"># Expand the raw specs, preserving order.</span>
    modules = <span class="hljs-built_in">list</span>(parse_frozen_specs())
    parser.add_argument(<span class="hljs-string">&#x27;--step&#x27;</span>, <span class="hljs-built_in">type</span>=<span class="hljs-built_in">int</span>, default=<span class="hljs-number">0</span>)
    args = parser.parse_args()
    <span class="hljs-keyword">if</span> args.step == <span class="hljs-number">0</span>:
        <span class="hljs-comment"># Freeze the modules.</span>
        generate_frozen_files(ROOT_DIR)
    <span class="hljs-keyword">elif</span> args.step == <span class="hljs-number">1</span>:
        <span class="hljs-comment"># Regen build-related files.</span>
        regen_makefile(modules)
        regen_pcbuild(modules)
        regen_frozen(modules)
    <span class="hljs-comment"># Regen build-related files.</span>
    <span class="hljs-comment">#regen_makefile(modules)</span>
    <span class="hljs-comment">#regen_pcbuild(modules)</span>
    <span class="hljs-comment">#regen_frozen(modules)</span>
    

<span class="hljs-keyword">if</span> __name__ == <span class="hljs-string">&#x27;__main__&#x27;</span>:
    main()
</code></pre></div>
<p>打开<code class="md-code-inline">Tools/build/update_file.py</code></p>
<p>将整个文件内容替换为下面的代码</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">93 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-string">&quot;&quot;&quot;
A script that replaces an old file with a new one, only if the contents
actually changed.  If not, the new file is simply deleted.

This avoids wholesale rebuilds when a code (re)generation phase does not
actually change the in-tree generated code.
&quot;&quot;&quot;</span>

<span class="hljs-keyword">import</span> contextlib
<span class="hljs-keyword">import</span> os
<span class="hljs-keyword">import</span> os.path
<span class="hljs-keyword">import</span> sys


<span class="hljs-meta">@contextlib.contextmanager</span>
<span class="hljs-keyword">def</span> <span class="hljs-title function_">updating_file_with_tmpfile</span>(<span class="hljs-params">filename, tmpfile=<span class="hljs-literal">None</span></span>):
    <span class="hljs-string">&quot;&quot;&quot;A context manager for updating a file via a temp file.

    The context manager provides two open files: the source file open
    for reading, and the temp file, open for writing.

    Upon exiting: both files are closed, and the source file is replaced
    with the temp file.
    &quot;&quot;&quot;</span>
    <span class="hljs-comment"># XXX Optionally use tempfile.TemporaryFile?</span>
    <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> tmpfile:
        tmpfile = filename + <span class="hljs-string">&#x27;.tmp&#x27;</span>
    <span class="hljs-keyword">elif</span> os.path.isdir(tmpfile):
        tmpfile = os.path.join(tmpfile, filename + <span class="hljs-string">&#x27;.tmp&#x27;</span>)

    <span class="hljs-keyword">with</span> <span class="hljs-built_in">open</span>(filename, <span class="hljs-string">&#x27;rb&#x27;</span>) <span class="hljs-keyword">as</span> infile:
        line = infile.readline()

    <span class="hljs-keyword">if</span> line.endswith(<span class="hljs-string">b&#x27;\\r\\n&#x27;</span>):
        newline = <span class="hljs-string">&quot;\\r\\n&quot;</span>
    <span class="hljs-keyword">elif</span> line.endswith(<span class="hljs-string">b&#x27;\\r&#x27;</span>):
        newline = <span class="hljs-string">&quot;\\r&quot;</span>
    <span class="hljs-keyword">elif</span> line.endswith(<span class="hljs-string">b&#x27;\\n&#x27;</span>):
        newline = <span class="hljs-string">&quot;\\n&quot;</span>
    <span class="hljs-keyword">else</span>:
        <span class="hljs-keyword">raise</span> ValueError(<span class="hljs-string">f&quot;unknown end of line: <span class="hljs-subst">{filename}</span>: <span class="hljs-subst">{line!a}</span>&quot;</span>)

    <span class="hljs-keyword">with</span> <span class="hljs-built_in">open</span>(tmpfile, <span class="hljs-string">&#x27;w&#x27;</span>, newline=newline,encoding=<span class="hljs-string">&#x27;utf8&#x27;</span>) <span class="hljs-keyword">as</span> outfile:
        <span class="hljs-keyword">with</span> <span class="hljs-built_in">open</span>(filename,encoding=<span class="hljs-string">&#x27;utf8&#x27;</span>) <span class="hljs-keyword">as</span> infile:
            <span class="hljs-keyword">yield</span> infile, outfile
    update_file_with_tmpfile(filename, tmpfile)


<span class="hljs-keyword">def</span> <span class="hljs-title function_">update_file_with_tmpfile</span>(<span class="hljs-params">filename, tmpfile, *, create=<span class="hljs-literal">False</span></span>):
    <span class="hljs-keyword">try</span>:
        targetfile = <span class="hljs-built_in">open</span>(filename, <span class="hljs-string">&#x27;rb&#x27;</span>)
    <span class="hljs-keyword">except</span> FileNotFoundError:
        <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> create:
            <span class="hljs-keyword">raise</span>  <span class="hljs-comment"># re-raise</span>
        outcome = <span class="hljs-string">&#x27;created&#x27;</span>
        os.replace(tmpfile, filename)
    <span class="hljs-keyword">else</span>:
        <span class="hljs-keyword">with</span> targetfile:
            old_contents = targetfile.read()
        <span class="hljs-keyword">with</span> <span class="hljs-built_in">open</span>(tmpfile, <span class="hljs-string">&#x27;rb&#x27;</span>) <span class="hljs-keyword">as</span> f:
            new_contents = f.read()
        <span class="hljs-comment"># Now compare!</span>
        <span class="hljs-keyword">if</span> old_contents != new_contents:
            outcome = <span class="hljs-string">&#x27;updated&#x27;</span>
            os.replace(tmpfile, filename)
        <span class="hljs-keyword">else</span>:
            outcome = <span class="hljs-string">&#x27;same&#x27;</span>
            os.unlink(tmpfile)
    <span class="hljs-keyword">return</span> outcome


<span class="hljs-keyword">if</span> __name__ == <span class="hljs-string">&#x27;__main__&#x27;</span>:
    <span class="hljs-keyword">import</span> argparse
    parser = argparse.ArgumentParser()
    parser.add_argument(<span class="hljs-string">&#x27;--create&#x27;</span>, action=<span class="hljs-string">&#x27;store_true&#x27;</span>)
    parser.add_argument(<span class="hljs-string">&#x27;--exitcode&#x27;</span>, action=<span class="hljs-string">&#x27;store_true&#x27;</span>)
    parser.add_argument(<span class="hljs-string">&#x27;filename&#x27;</span>, <span class="hljs-built_in">help</span>=<span class="hljs-string">&#x27;path to be updated&#x27;</span>)
    parser.add_argument(<span class="hljs-string">&#x27;tmpfile&#x27;</span>, <span class="hljs-built_in">help</span>=<span class="hljs-string">&#x27;path with new contents&#x27;</span>)
    args = parser.parse_args()
    kwargs = <span class="hljs-built_in">vars</span>(args)
    setexitcode = kwargs.pop(<span class="hljs-string">&#x27;exitcode&#x27;</span>)

    outcome = update_file_with_tmpfile(**kwargs)
    <span class="hljs-keyword">if</span> setexitcode:
        <span class="hljs-keyword">if</span> outcome == <span class="hljs-string">&#x27;same&#x27;</span>:
            sys.exit(<span class="hljs-number">0</span>)
        <span class="hljs-keyword">elif</span> outcome == <span class="hljs-string">&#x27;updated&#x27;</span>:
            sys.exit(<span class="hljs-number">1</span>)
        <span class="hljs-keyword">elif</span> outcome == <span class="hljs-string">&#x27;created&#x27;</span>:
            sys.exit(<span class="hljs-number">2</span>)
        <span class="hljs-keyword">else</span>:
            <span class="hljs-keyword">raise</span> NotImplementedError
</code></pre></div>
<p>在python源代码根目录下打开cmd，依次运行（这里使用python如果报错的话是因为使用了刚编译的python，你可以将其替换为本地的python路径）：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">powershell</span><span class="md-code-meta">3 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-powershell">python ./Tools/build/freeze_modules.py <span class="hljs-literal">--step</span>=<span class="hljs-number">0</span>
python ./Tools/build/freeze_modules.py <span class="hljs-literal">--step</span>=<span class="hljs-number">1</span>
<span class="hljs-string">&quot;PCbuild/amd64/_freeze_module.exe&quot;</span> _pyrepl ./Lib/_pyrepl/__main__.py ./Python/frozen_modules/_pyrepl.h</code></pre></div>
<p>回到VS，选择<code class="md-code-inline">Python</code>项目，右键生成，生成完后会报很多错，不用理会，此时<code class="md-code-inline">amd64</code>文件夹下已经生成可单文件运行的<code class="md-code-inline">python.exe</code>，包含了标准库，如果还需拓展库的话，可以在<code class="md-code-inline">python.exe</code>的同文件夹下防止<code class="md-code-inline">python313.zip</code>，zip中压缩库文件（也可以在运行<code class="md-code-inline">python ./Tools/build/freeze_modules.py --step=0</code>之前将这些库放置到源码的Lib目录下进行freeze）</p>
<p>这里提供一个成品：<a class="md-link" href="/python.exe" data-internal="1">python</a></p>
<div class="md-hr" role="separator"></div>
<p><strong>update：</strong>
这样编译完后每次运行Python会因为找不到环境变量而产生Warning：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">Could not find platform independent libraries &lt;prefix&gt;</code></pre></div>
<p>可以修改<code class="md-code-inline">\\Modules\\getpath.py</code>，删掉其中的<code class="md-code-inline">warn('Could not find platform independent libraries &lt;prefix&gt;')</code></p>
<p>上面给的成品未作修改</p>
<p><code class="md-code-inline">python ./Tools/build/freeze_modules.py --step=0</code>命令将会修改<code class="md-code-inline">Lib</code>文件夹中的部分文件，所以请不要重复运行，如需重新运行请删除<code class="md-code-inline">LIb</code>文件夹并重新解压</p>
<div class="md-hr" role="separator"></div>
<p><strong>编译3.13以前版本时</strong>：</p>
<ul class="md-list md-ul"><li class="md-li"><p>会没有<code class="md-code-inline">_pyrepl</code>库，因此不用修改<code class="md-code-inline">Lib/_pyrepl/__main.py__</code>，并且不用运行<code class="md-code-inline">&quot;PCbuild/amd64/_freeze_module.exe _pyrepl&quot; ./Lib/_pyrepl/__main__.py ./Python/frozen_modules/_pyrepl.h</code></p>
</li>
<li class="md-li"><p>第二次编译静态链接版本时可能会提示找不到getpath.h，你可以在第一次成功编译的<code class="md-code-inline">PCbuild/obj/_freeze_module</code>文件夹中找到<code class="md-code-inline">getpath.g.h</code>，重命名为<code class="md-code-inline">getpath.h</code>后放到<code class="md-code-inline">Python/frozen_modules/</code>文件夹中即可</p>
</li>
<li class="md-li"><p>这里提供一个python3.12成品：<a class="md-link" href="/python-3.12.exe" data-internal="1">python</a></p>
</li>
</ul>
`,toc:[]};export{e as default};