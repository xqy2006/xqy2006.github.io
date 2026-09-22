var e={html:`<p>《面向结果编程》</p>
<p>请填写cookie以及实验id</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">275 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">import</span> os
<span class="hljs-keyword">import</span> json
<span class="hljs-keyword">import</span> requests
<span class="hljs-keyword">import</span> zipfile
<span class="hljs-keyword">import</span> io
<span class="hljs-keyword">import</span> re
<span class="hljs-keyword">import</span> http.cookies

<span class="hljs-comment"># ===================== 配置区域 - 请根据实际情况修改这些值 =====================</span>

CONTEST_ID =   <span class="hljs-comment"># 比赛ID</span>
COOKIE_STR = <span class="hljs-string">&quot;&quot;</span>

<span class="hljs-comment"># ===========================================================================</span>


USER_AGENT = <span class="hljs-string">&quot;Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0&quot;</span>
REFERER = <span class="hljs-string">f&quot;http://xmuoj.com/contest/<span class="hljs-subst">{CONTEST_ID}</span>/problems&quot;</span>


<span class="hljs-keyword">def</span> <span class="hljs-title function_">parse_cookie</span>(<span class="hljs-params">cookie_str</span>):
    <span class="hljs-string">&quot;&quot;&quot;解析Cookie字符串并提取csrftoken&quot;&quot;&quot;</span>
    cookie = http.cookies.SimpleCookie()
    cookie.load(cookie_str)
    csrftoken = <span class="hljs-literal">None</span>
    
    <span class="hljs-keyword">for</span> key, morsel <span class="hljs-keyword">in</span> cookie.items():
        <span class="hljs-keyword">if</span> key == <span class="hljs-string">&#x27;csrftoken&#x27;</span>:
            csrftoken = morsel.value
            <span class="hljs-keyword">break</span>
    
    <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> csrftoken:
        <span class="hljs-keyword">raise</span> ValueError(<span class="hljs-string">&quot;csrftoken not found in cookie&quot;</span>)
    
    <span class="hljs-keyword">return</span> cookie_str, csrftoken

<span class="hljs-keyword">def</span> <span class="hljs-title function_">sanitize_filename</span>(<span class="hljs-params">title</span>):
    <span class="hljs-string">&quot;&quot;&quot;移除文件名中的非法字符&quot;&quot;&quot;</span>
    <span class="hljs-keyword">return</span> re.sub(<span class="hljs-string">r&#x27;[\\\\/*?:&quot;&lt;&gt;|]&#x27;</span>, <span class="hljs-string">&#x27;_&#x27;</span>, title)

<span class="hljs-keyword">def</span> <span class="hljs-title function_">escape_string</span>(<span class="hljs-params">s</span>):
    <span class="hljs-string">&quot;&quot;&quot;转义字符串中的特殊字符&quot;&quot;&quot;</span>
    <span class="hljs-keyword">return</span> s.replace(<span class="hljs-string">&#x27;\\\\&#x27;</span>, <span class="hljs-string">&#x27;\\\\\\\\&#x27;</span>).replace(<span class="hljs-string">&#x27;&quot;&#x27;</span>, <span class="hljs-string">&#x27;\\\\&quot;&#x27;</span>).replace(<span class="hljs-string">&#x27;\\n&#x27;</span>, <span class="hljs-string">&#x27;\\\\n&#x27;</span>).replace(<span class="hljs-string">&#x27;\\r&#x27;</span>, <span class="hljs-string">&#x27;\\\\r&#x27;</span>)

<span class="hljs-keyword">def</span> <span class="hljs-title function_">generate_minimal_prefixes</span>(<span class="hljs-params">test_cases</span>):
    <span class="hljs-string">&quot;&quot;&quot;
    计算每个测试用例的最小区分前缀
    返回: 前缀字典和最大前缀长度
    &quot;&quot;&quot;</span>
    <span class="hljs-comment"># 初始使用16字节前缀</span>
    min_len = <span class="hljs-number">16</span>
    prefixes = {}
    <span class="hljs-keyword">for</span> i, tc <span class="hljs-keyword">in</span> <span class="hljs-built_in">enumerate</span>(test_cases):
        prefix = tc[<span class="hljs-string">&#x27;input&#x27;</span>][:min_len]
        <span class="hljs-keyword">if</span> prefix <span class="hljs-keyword">not</span> <span class="hljs-keyword">in</span> prefixes:
            prefixes[prefix] = []
        prefixes[prefix].append(i)
    
    <span class="hljs-comment"># 解决前缀冲突</span>
    max_prefix_len = min_len
    <span class="hljs-keyword">for</span> prefix, indices <span class="hljs-keyword">in</span> <span class="hljs-built_in">list</span>(prefixes.items()):
        <span class="hljs-keyword">if</span> <span class="hljs-built_in">len</span>(indices) &gt; <span class="hljs-number">1</span>:
            <span class="hljs-comment"># 对有冲突的测试用例增加前缀长度直到能区分</span>
            <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> indices:
                current_len = min_len
                <span class="hljs-keyword">while</span> <span class="hljs-literal">True</span>:
                    current_len += <span class="hljs-number">1</span>
                    <span class="hljs-keyword">if</span> current_len &gt; <span class="hljs-number">256</span>:  <span class="hljs-comment"># 安全限制，避免无限循环</span>
                        <span class="hljs-keyword">raise</span> RuntimeError(<span class="hljs-string">&quot;无法找到唯一前缀&quot;</span>)
                    
                    new_prefix = test_cases[i][<span class="hljs-string">&#x27;input&#x27;</span>][:current_len]
                    <span class="hljs-keyword">if</span> new_prefix <span class="hljs-keyword">not</span> <span class="hljs-keyword">in</span> prefixes:
                        prefixes[new_prefix] = [i]
                        max_prefix_len = <span class="hljs-built_in">max</span>(max_prefix_len, current_len)
                        <span class="hljs-keyword">break</span>
                    <span class="hljs-keyword">elif</span> <span class="hljs-built_in">len</span>(prefixes[new_prefix]) == <span class="hljs-number">1</span>:
                        prefixes[new_prefix].append(i)
                        max_prefix_len = <span class="hljs-built_in">max</span>(max_prefix_len, current_len)
                        <span class="hljs-keyword">break</span>
            <span class="hljs-keyword">del</span> prefixes[prefix]
    
    <span class="hljs-keyword">return</span> prefixes, max_prefix_len

<span class="hljs-keyword">def</span> <span class="hljs-title function_">generate_py_code</span>(<span class="hljs-params">test_cases, problem_title</span>):
    <span class="hljs-string">&quot;&quot;&quot;生成优化的Python AC代码&quot;&quot;&quot;</span>
    <span class="hljs-comment"># 计算最小区分前缀</span>
    prefixes, max_len = generate_minimal_prefixes(test_cases)
    
    code = <span class="hljs-string">&quot;import sys\\n\\n&quot;</span>
    code += <span class="hljs-string">&quot;test_cases = [\\n&quot;</span>
    
    <span class="hljs-comment"># 存储测试用例数据</span>
    <span class="hljs-keyword">for</span> prefix, indices <span class="hljs-keyword">in</span> prefixes.items():
        idx = indices[<span class="hljs-number">0</span>]
        output = test_cases[idx][<span class="hljs-string">&#x27;output&#x27;</span>].decode(<span class="hljs-string">&#x27;utf-8&#x27;</span>)
        code += <span class="hljs-string">f&quot;    (<span class="hljs-subst">{<span class="hljs-built_in">len</span>(prefix)}</span>, \\&quot;<span class="hljs-subst">{escape_string(prefix.decode(<span class="hljs-string">&#x27;utf-8&#x27;</span>))}</span>\\&quot;, \\&quot;\\&quot;\\&quot;<span class="hljs-subst">{output}</span>\\&quot;\\&quot;\\&quot;),\\n&quot;</span>
    
    code += <span class="hljs-string">&quot;]\\n\\n&quot;</span>
    code += <span class="hljs-string">&quot;&quot;&quot;def main():
    input_data = sys.stdin.read()
    for match_len, prefix, output in test_cases:
        if input_data.startswith(prefix):
            print(output, end=&#x27;&#x27;)
            return
    sys.exit(1)

if __name__ == &#x27;__main__&#x27;:
    main()&quot;&quot;&quot;</span>
    
    filename = <span class="hljs-string">f&quot;ac_codes_<span class="hljs-subst">{CONTEST_ID}</span>/<span class="hljs-subst">{sanitize_filename(problem_title)}</span>.py&quot;</span>
    os.makedirs(os.path.dirname(filename), exist_ok=<span class="hljs-literal">True</span>)
    <span class="hljs-keyword">with</span> <span class="hljs-built_in">open</span>(filename, <span class="hljs-string">&#x27;w&#x27;</span>, encoding=<span class="hljs-string">&#x27;utf-8&#x27;</span>) <span class="hljs-keyword">as</span> f:
        f.write(code)

<span class="hljs-keyword">def</span> <span class="hljs-title function_">generate_cpp_code</span>(<span class="hljs-params">test_cases, problem_title</span>):
    <span class="hljs-string">&quot;&quot;&quot;生成优化的C++ AC代码&quot;&quot;&quot;</span>
    prefixes, max_len = generate_minimal_prefixes(test_cases)
    
    code = <span class="hljs-string">&quot;&quot;&quot;#include &lt;iostream&gt;
#include &lt;vector&gt;
#include &lt;string&gt;

struct TestCase {
    size_t match_len;
    std::string prefix;
    std::string output;
};

std::vector&lt;TestCase&gt; test_cases = {
&quot;&quot;&quot;</span>
    
    <span class="hljs-comment"># 存储测试用例数据</span>
    <span class="hljs-keyword">for</span> prefix, indices <span class="hljs-keyword">in</span> prefixes.items():
        idx = indices[<span class="hljs-number">0</span>]
        output = test_cases[idx][<span class="hljs-string">&#x27;output&#x27;</span>].decode(<span class="hljs-string">&#x27;utf-8&#x27;</span>)
        escaped_prefix = escape_string(prefix.decode(<span class="hljs-string">&#x27;utf-8&#x27;</span>))
        escaped_output = escape_string(output)
        code += <span class="hljs-string">f&quot;    {{<span class="hljs-subst">{<span class="hljs-built_in">len</span>(prefix)}</span>, \\&quot;<span class="hljs-subst">{escaped_prefix}</span>\\&quot;, \\&quot;<span class="hljs-subst">{escaped_output}</span>\\&quot;}},\\n&quot;</span>
    
    code += <span class="hljs-string">&quot;&quot;&quot;};

int main() {
    std::string input_data;
    char ch;
    while (std::cin.get(ch)) {
        input_data += ch;
    }
    
    for (const auto&amp; tc : test_cases) {
        if (input_data.size() &gt;= tc.match_len &amp;&amp; 
            input_data.substr(0, tc.match_len) == tc.prefix) {
            std::cout &lt;&lt; tc.output;
            return 0;
        }
    }
    
    std::cerr &lt;&lt; &quot;No matching test case&quot; &lt;&lt; std::endl;
    return 1;
}&quot;&quot;&quot;</span>
    
    filename = <span class="hljs-string">f&quot;ac_codes_<span class="hljs-subst">{CONTEST_ID}</span>/<span class="hljs-subst">{sanitize_filename(problem_title)}</span>.cpp&quot;</span>
    os.makedirs(os.path.dirname(filename), exist_ok=<span class="hljs-literal">True</span>)
    <span class="hljs-keyword">with</span> <span class="hljs-built_in">open</span>(filename, <span class="hljs-string">&#x27;w&#x27;</span>, encoding=<span class="hljs-string">&#x27;utf-8&#x27;</span>) <span class="hljs-keyword">as</span> f:
        f.write(code)

<span class="hljs-keyword">def</span> <span class="hljs-title function_">download_test_cases</span>(<span class="hljs-params">problem_id, cookie, csrftoken</span>):
    <span class="hljs-string">&quot;&quot;&quot;下载并解析测试用例&quot;&quot;&quot;</span>
    url = <span class="hljs-string">f&quot;http://xmuoj.com/api/dl_test_case?problem_id=<span class="hljs-subst">{problem_id}</span>&quot;</span>
    headers = {
        <span class="hljs-string">&quot;Cookie&quot;</span>: cookie,
        <span class="hljs-string">&quot;X-CSRFToken&quot;</span>: csrftoken,
        <span class="hljs-string">&quot;Referer&quot;</span>: REFERER,
        <span class="hljs-string">&quot;User-Agent&quot;</span>: USER_AGENT
    }
    
    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;  正在下载测试用例 (题目ID: <span class="hljs-subst">{problem_id}</span>)&quot;</span>)
    response = requests.get(url, headers=headers, verify=<span class="hljs-literal">False</span>)
    response.raise_for_status()
    
    <span class="hljs-comment"># 解压测试用例</span>
    test_cases = []
    <span class="hljs-keyword">with</span> zipfile.ZipFile(io.BytesIO(response.content)) <span class="hljs-keyword">as</span> zip_ref:
        files = {name: zip_ref.read(name) <span class="hljs-keyword">for</span> name <span class="hljs-keyword">in</span> zip_ref.namelist()}
        
        <span class="hljs-comment"># 按测试用例编号排序</span>
        indices = <span class="hljs-built_in">sorted</span>(<span class="hljs-built_in">set</span>(<span class="hljs-built_in">int</span>(name.split(<span class="hljs-string">&#x27;.&#x27;</span>)[<span class="hljs-number">0</span>]) <span class="hljs-keyword">for</span> name <span class="hljs-keyword">in</span> files <span class="hljs-keyword">if</span> <span class="hljs-string">&#x27;.&#x27;</span> <span class="hljs-keyword">in</span> name))
        <span class="hljs-keyword">for</span> idx <span class="hljs-keyword">in</span> indices:
            in_file = <span class="hljs-string">f&quot;<span class="hljs-subst">{idx}</span>.in&quot;</span>
            out_file = <span class="hljs-string">f&quot;<span class="hljs-subst">{idx}</span>.out&quot;</span>
            <span class="hljs-keyword">if</span> in_file <span class="hljs-keyword">in</span> files <span class="hljs-keyword">and</span> out_file <span class="hljs-keyword">in</span> files:
                test_cases.append({
                    <span class="hljs-string">&#x27;input&#x27;</span>: files[in_file],
                    <span class="hljs-string">&#x27;output&#x27;</span>: files[out_file]
                })
    
    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;  找到 <span class="hljs-subst">{<span class="hljs-built_in">len</span>(test_cases)}</span> 个测试用例&quot;</span>)
    <span class="hljs-keyword">return</span> test_cases

<span class="hljs-keyword">def</span> <span class="hljs-title function_">get_contest_problems</span>(<span class="hljs-params">cookie, csrftoken</span>):
    <span class="hljs-string">&quot;&quot;&quot;获取比赛题目列表&quot;&quot;&quot;</span>
    url = <span class="hljs-string">f&quot;http://xmuoj.com/api/contest/problem?contest_id=<span class="hljs-subst">{CONTEST_ID}</span>&quot;</span>
    headers = {
        <span class="hljs-string">&quot;Accept&quot;</span>: <span class="hljs-string">&quot;application/json, text/plain, */*&quot;</span>,
        <span class="hljs-string">&quot;Accept-Language&quot;</span>: <span class="hljs-string">&quot;zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6&quot;</span>,
        <span class="hljs-string">&quot;Cache-Control&quot;</span>: <span class="hljs-string">&quot;no-cache&quot;</span>,
        <span class="hljs-string">&quot;Connection&quot;</span>: <span class="hljs-string">&quot;keep-alive&quot;</span>,
        <span class="hljs-string">&quot;Content-Type&quot;</span>: <span class="hljs-string">&quot;application/json;charset=utf-8&quot;</span>,
        <span class="hljs-string">&quot;Pragma&quot;</span>: <span class="hljs-string">&quot;no-cache&quot;</span>,
        <span class="hljs-string">&quot;Referer&quot;</span>: REFERER,
        <span class="hljs-string">&quot;User-Agent&quot;</span>: USER_AGENT,
        <span class="hljs-string">&quot;X-CSRFToken&quot;</span>: csrftoken,
        <span class="hljs-string">&quot;Cookie&quot;</span>: cookie
    }
    
    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;获取比赛 <span class="hljs-subst">{CONTEST_ID}</span> 的题目列表...&quot;</span>)
    response = requests.get(url, headers=headers, verify=<span class="hljs-literal">False</span>)
    response.raise_for_status()
    <span class="hljs-keyword">return</span> response.json()

<span class="hljs-keyword">def</span> <span class="hljs-title function_">main</span>():
    <span class="hljs-comment"># 创建代码存放目录</span>
    os.makedirs(<span class="hljs-string">f&quot;ac_codes_<span class="hljs-subst">{CONTEST_ID}</span>&quot;</span>, exist_ok=<span class="hljs-literal">True</span>)
    
    <span class="hljs-comment"># 解析cookie</span>
    <span class="hljs-keyword">try</span>:
        cookie, csrftoken = parse_cookie(COOKIE_STR)
        <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;成功解析csrftoken: <span class="hljs-subst">{csrftoken}</span>&quot;</span>)
    <span class="hljs-keyword">except</span> Exception <span class="hljs-keyword">as</span> e:
        <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;解析cookie失败: <span class="hljs-subst">{<span class="hljs-built_in">str</span>(e)}</span>&quot;</span>)
        <span class="hljs-keyword">return</span>
    
    <span class="hljs-comment"># 获取题目列表</span>
    <span class="hljs-keyword">try</span>:
        data = get_contest_problems(cookie, csrftoken)
    <span class="hljs-keyword">except</span> Exception <span class="hljs-keyword">as</span> e:
        <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;获取题目列表失败: <span class="hljs-subst">{<span class="hljs-built_in">str</span>(e)}</span>&quot;</span>)
        <span class="hljs-keyword">return</span>
    
    <span class="hljs-keyword">if</span> data.get(<span class="hljs-string">&quot;error&quot;</span>):
        <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;获取题目列表失败: <span class="hljs-subst">{data[<span class="hljs-string">&#x27;error&#x27;</span>]}</span>&quot;</span>)
        <span class="hljs-keyword">return</span>
    
    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;找到 <span class="hljs-subst">{<span class="hljs-built_in">len</span>(data[<span class="hljs-string">&#x27;data&#x27;</span>])}</span> 道题目&quot;</span>)
    
    <span class="hljs-comment"># 处理每个题目</span>
    <span class="hljs-keyword">for</span> i, problem <span class="hljs-keyword">in</span> <span class="hljs-built_in">enumerate</span>(data[<span class="hljs-string">&#x27;data&#x27;</span>]):
        problem_id = problem[<span class="hljs-string">&#x27;id&#x27;</span>]
        problem_title = problem[<span class="hljs-string">&#x27;title&#x27;</span>]
        languages = problem[<span class="hljs-string">&#x27;languages&#x27;</span>]
        
        <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;\\n[<span class="hljs-subst">{i+<span class="hljs-number">1</span>}</span>/<span class="hljs-subst">{<span class="hljs-built_in">len</span>(data[<span class="hljs-string">&#x27;data&#x27;</span>])}</span>] 处理题目: <span class="hljs-subst">{problem_title}</span> (ID: <span class="hljs-subst">{problem_id}</span>)&quot;</span>)
        
        <span class="hljs-keyword">try</span>:
            test_cases = download_test_cases(problem_id, cookie, csrftoken)
            
            <span class="hljs-comment"># 为每种语言生成优化代码</span>
            <span class="hljs-keyword">for</span> lang <span class="hljs-keyword">in</span> languages:
                <span class="hljs-keyword">if</span> lang == <span class="hljs-string">&quot;Python3&quot;</span>:
                    generate_py_code(test_cases, problem_title)
                    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;  已生成Python代码&quot;</span>)
                <span class="hljs-keyword">elif</span> lang == <span class="hljs-string">&quot;C++&quot;</span>:
                    generate_cpp_code(test_cases, problem_title)
                    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;  已生成C++代码&quot;</span>)
                <span class="hljs-keyword">elif</span> lang == <span class="hljs-string">&quot;C&quot;</span>:
                    <span class="hljs-keyword">pass</span>
                    <span class="hljs-comment"># C语言实现类似C++，为简洁起见省略</span>
                    <span class="hljs-comment">#print(f&quot;  跳过C语言实现&quot;)</span>
                    
        <span class="hljs-keyword">except</span> Exception <span class="hljs-keyword">as</span> e:
            <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;  处理题目 <span class="hljs-subst">{problem_title}</span> 时出错: <span class="hljs-subst">{<span class="hljs-built_in">str</span>(e)}</span>&quot;</span>)

    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;\\nAC代码生成完成！请查看ac_codes_<span class="hljs-subst">{CONTEST_ID}</span>目录&quot;</span>)

<span class="hljs-keyword">if</span> __name__ == <span class="hljs-string">&quot;__main__&quot;</span>:
    main()</code></pre></div>
`,toc:[]};export{e as default};