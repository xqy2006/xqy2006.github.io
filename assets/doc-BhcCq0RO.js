var e={html:`<blockquote class="md-quote"><p>本文以部署QwQ-32B_q4量化为例</p>
</blockquote>
<p><strong>modal每月提供$30的免费额度（现在需要添加支付方式，之前不用）（未添加支付方式只有$5额度）</strong></p>
<p>进入<a class="md-link" href="https://modal.com/" target="_blank" rel="noopener noreferrer">Modal: High-performance AI infrastructure<span class="md-link-ext" aria-hidden="true">↗</span></a>，使用GitHub账号注册</p>
<p>然后本地安装modal库（版本经常更新，可能会更改api，本文使用的版本是0.73.90）</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">pip install modal</code></pre></div>
<p>在Modal网站进入个人设置，在API tokens处生成一个token，并在本地设置token</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">modal token set --token-id xxx --token-secret xxx</code></pre></div>
<p>新建qwq.py：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">121 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> modal <span class="hljs-keyword">import</span> Image, app, method, web_endpoint,App
IMAGE_MODEL_DIR = <span class="hljs-string">&quot;/model&quot;</span>
<span class="hljs-keyword">import</span> modal
<span class="hljs-keyword">from</span> typing <span class="hljs-keyword">import</span> <span class="hljs-type">Dict</span>
<span class="hljs-keyword">def</span> <span class="hljs-title function_">download_model</span>():
    <span class="hljs-keyword">from</span> huggingface_hub <span class="hljs-keyword">import</span> snapshot_download,hf_hub_download
    hf_hub_download(repo_id=<span class="hljs-string">&quot;bartowski/Qwen_QwQ-32B-GGUF&quot;</span>, filename=<span class="hljs-string">&quot;Qwen_QwQ-32B-Q4_K_M.gguf&quot;</span>, local_dir=IMAGE_MODEL_DIR)

cuda_version = <span class="hljs-string">&quot;12.4.0&quot;</span>  <span class="hljs-comment"># should be no greater than host CUDA version</span>
flavor = <span class="hljs-string">&quot;devel&quot;</span>  <span class="hljs-comment">#  includes full CUDA toolkit</span>
operating_sys = <span class="hljs-string">&quot;ubuntu22.04&quot;</span>
tag = <span class="hljs-string">f&quot;<span class="hljs-subst">{cuda_version}</span>-<span class="hljs-subst">{flavor}</span>-<span class="hljs-subst">{operating_sys}</span>&quot;</span>
image = (
    modal.Image.from_registry(<span class="hljs-string">f&quot;nvidia/cuda:<span class="hljs-subst">{tag}</span>&quot;</span>, add_python=<span class="hljs-string">&quot;3.10&quot;</span>)
    .apt_install(<span class="hljs-string">&quot;git&quot;</span>)
    .apt_install(<span class="hljs-string">&quot;gcc&quot;</span>,<span class="hljs-string">&quot;build-essential&quot;</span>,<span class="hljs-string">&quot;cmake&quot;</span>,<span class="hljs-string">&quot;clang&quot;</span>)
    .pip_install(<span class="hljs-string">&quot;https://github.com/abetlen/llama-cpp-python/releases/download/v0.2.77-cu124/llama_cpp_python-0.2.77-cp310-cp310-linux_x86_64.whl&quot;</span>)
    <span class="hljs-comment">#.run_commands(</span>
    <span class="hljs-comment">#    &quot;CMAKE_ARGS=\\&quot;-DGGML_CUDA=on\\&quot; pip install llama-cpp-python&quot;</span>
    <span class="hljs-comment">#)</span>
    .pip_install(
        <span class="hljs-string">&quot;einops==0.6.1&quot;</span>,
        <span class="hljs-string">&quot;hf-transfer~=0.1&quot;</span>,
        <span class="hljs-string">&quot;huggingface_hub==0.14.1&quot;</span>,
        <span class="hljs-string">&quot;accelerate&quot;</span>,
        <span class="hljs-string">&quot;colorama&quot;</span>,
        <span class="hljs-string">&quot;cpm_kernels&quot;</span>,
        <span class="hljs-string">&quot;sentencepiece&quot;</span>,
        <span class="hljs-string">&quot;streamlit&gt;=1.24.0&quot;</span>,
        <span class="hljs-string">&quot;protobuf&quot;</span>,
        <span class="hljs-string">&quot;sse-starlette&quot;</span>,
        <span class="hljs-string">&quot;fastapi&quot;</span>

    )
    <span class="hljs-comment"># Use huggingface&#x27;s hi-perf hf-transfer library to download this large model.</span>
    .env({<span class="hljs-string">&quot;HF_HUB_ENABLE_HF_TRANSFER&quot;</span>: <span class="hljs-string">&quot;1&quot;</span>})
    .run_function(download_model)
)
app = App(name=<span class="hljs-string">&quot;QwQ&quot;</span>, image=image)

<span class="hljs-meta">@app.cls(<span class="hljs-params">gpu=<span class="hljs-string">&quot;L4&quot;</span>,timeout=<span class="hljs-number">1200</span>, scaledown_window=<span class="hljs-number">60</span></span>)</span>
<span class="hljs-keyword">class</span> <span class="hljs-title class_">qwq</span>:
<span class="hljs-meta">    @modal.enter()</span>
    <span class="hljs-keyword">def</span> <span class="hljs-title function_">e</span>(<span class="hljs-params">self</span>):
        <span class="hljs-keyword">from</span> llama_cpp <span class="hljs-keyword">import</span> Llama
        <span class="hljs-variable language_">self</span>.llm = Llama(model_path=IMAGE_MODEL_DIR+<span class="hljs-string">&quot;/Qwen_QwQ-32B-Q4_K_M.gguf&quot;</span>, n_ctx=<span class="hljs-number">8192</span>,seed=-<span class="hljs-number">1</span>,n_gpu_layers=-<span class="hljs-number">1</span>)
        <span class="hljs-comment">#import subprocess</span>
        <span class="hljs-comment">#output = subprocess.check_output([&quot;nvidia-smi&quot;], text=True)</span>
        <span class="hljs-comment">#print(output)</span>
<span class="hljs-meta">    @method()</span>
    <span class="hljs-keyword">def</span> <span class="hljs-title function_">generate</span>(<span class="hljs-params">self, req: <span class="hljs-built_in">str</span></span>):
        <span class="hljs-keyword">global</span> flag,que
        <span class="hljs-keyword">import</span> time
        <span class="hljs-keyword">from</span> threading <span class="hljs-keyword">import</span> Thread
        <span class="hljs-keyword">from</span> queue <span class="hljs-keyword">import</span> Queue
        <span class="hljs-keyword">import</span> json
        <span class="hljs-keyword">import</span> os
        <span class="hljs-keyword">import</span> torch
        <span class="hljs-keyword">import</span> platform
        <span class="hljs-keyword">from</span> colorama <span class="hljs-keyword">import</span> Fore, Style
        <span class="hljs-built_in">print</span>(req)
        messages = json.loads(req)
        <span class="hljs-keyword">def</span> <span class="hljs-title function_">gen</span>():
            <span class="hljs-keyword">global</span> flag,que
            st = time.time()
            <span class="hljs-keyword">for</span> response <span class="hljs-keyword">in</span> <span class="hljs-variable language_">self</span>.llm.create_chat_completion(messages,stop=[<span class="hljs-string">&quot;&lt;/s&gt;&quot;</span>],stream=<span class="hljs-literal">True</span>,max_tokens=-<span class="hljs-number">1</span>):
                <span class="hljs-keyword">if</span> <span class="hljs-string">&quot;content&quot;</span> <span class="hljs-keyword">in</span> response[<span class="hljs-string">&quot;choices&quot;</span>][<span class="hljs-number">0</span>][<span class="hljs-string">&quot;delta&quot;</span>]:
                    <span class="hljs-built_in">print</span>(response[<span class="hljs-string">&quot;choices&quot;</span>][<span class="hljs-number">0</span>][<span class="hljs-string">&quot;delta&quot;</span>][<span class="hljs-string">&quot;content&quot;</span>],end=<span class="hljs-string">&quot;&quot;</span>)
                    <span class="hljs-comment">#import subprocess</span>
                    <span class="hljs-comment">#output = subprocess.check_output([&quot;nvidia-smi&quot;], text=True)</span>
                    <span class="hljs-comment">#print(output)</span>
                    flag = <span class="hljs-number">1</span>
                    que.put(<span class="hljs-string">&quot;data:&quot;</span>+<span class="hljs-built_in">str</span>(response).replace(<span class="hljs-string">&#x27;\\&#x27;&#x27;</span>,<span class="hljs-string">&#x27;\\&quot;&#x27;</span>).replace(<span class="hljs-string">&quot;None&quot;</span>,<span class="hljs-string">&quot;\\&quot;None\\&quot;&quot;</span>)+<span class="hljs-string">&quot;\\n\\n&quot;</span>)
                    <span class="hljs-keyword">if</span> time.time()-st&gt;<span class="hljs-number">1000</span>:
                        <span class="hljs-keyword">break</span>
            que.put(<span class="hljs-literal">None</span>)

        <span class="hljs-keyword">yield</span> <span class="hljs-string">&quot;data:&quot;</span>+<span class="hljs-built_in">str</span>({<span class="hljs-string">&quot;id&quot;</span>:<span class="hljs-string">&quot;chatcmpl-b32f3ee7-358b-4001-bb0a-44447a99c5d3&quot;</span>,<span class="hljs-string">&quot;model&quot;</span>:<span class="hljs-string">&quot;/model/ggml-model-q4_0.bin&quot;</span>,<span class="hljs-string">&quot;created&quot;</span>:<span class="hljs-number">1691553316</span>,<span class="hljs-string">&quot;object&quot;</span>:<span class="hljs-string">&quot;chat.completion.chunk&quot;</span>,<span class="hljs-string">&quot;choices&quot;</span>:[{<span class="hljs-string">&quot;index&quot;</span>:<span class="hljs-number">0</span>,<span class="hljs-string">&quot;delta&quot;</span>:{<span class="hljs-string">&quot;content&quot;</span>:<span class="hljs-string">&quot;&quot;</span>},<span class="hljs-string">&quot;finish_reason&quot;</span>:<span class="hljs-literal">None</span>}]}).replace(<span class="hljs-string">&#x27;\\&#x27;&#x27;</span>,<span class="hljs-string">&#x27;\\&quot;&#x27;</span>).replace(<span class="hljs-string">&quot;None&quot;</span>,<span class="hljs-string">&quot;\\&quot;None\\&quot;&quot;</span>)+<span class="hljs-string">&quot;\\n\\n&quot;</span>
        flag = <span class="hljs-number">0</span>
        que = Queue()
        thread = Thread(target=gen)
        thread.start()
        <span class="hljs-keyword">while</span> flag==<span class="hljs-number">0</span>:
            <span class="hljs-keyword">yield</span> <span class="hljs-string">&quot;data:&quot;</span>+<span class="hljs-built_in">str</span>({<span class="hljs-string">&quot;id&quot;</span>:<span class="hljs-string">&quot;chatcmpl-b32f3ee7-358b-4001-bb0a-44447a99c5d3&quot;</span>,<span class="hljs-string">&quot;model&quot;</span>:<span class="hljs-string">&quot;/model/ggml-model-q4_0.bin&quot;</span>,<span class="hljs-string">&quot;created&quot;</span>:<span class="hljs-number">1691553316</span>,<span class="hljs-string">&quot;object&quot;</span>:<span class="hljs-string">&quot;chat.completion.chunk&quot;</span>,<span class="hljs-string">&quot;choices&quot;</span>:[{<span class="hljs-string">&quot;index&quot;</span>:<span class="hljs-number">0</span>,<span class="hljs-string">&quot;delta&quot;</span>:{<span class="hljs-string">&quot;content&quot;</span>:<span class="hljs-string">&quot;&quot;</span>},<span class="hljs-string">&quot;finish_reason&quot;</span>:<span class="hljs-literal">None</span>}]}).replace(<span class="hljs-string">&#x27;\\&#x27;&#x27;</span>,<span class="hljs-string">&#x27;\\&quot;&#x27;</span>).replace(<span class="hljs-string">&quot;None&quot;</span>,<span class="hljs-string">&quot;\\&quot;None\\&quot;&quot;</span>)+<span class="hljs-string">&quot;\\n\\n&quot;</span>
            time.sleep(<span class="hljs-number">1</span>)
        <span class="hljs-keyword">while</span> <span class="hljs-literal">True</span>:
            <span class="hljs-keyword">try</span>:
                i = que.get()
                <span class="hljs-keyword">if</span> i==<span class="hljs-literal">None</span>:
                    <span class="hljs-keyword">break</span>
                <span class="hljs-keyword">yield</span> i
            <span class="hljs-keyword">except</span>:
                <span class="hljs-keyword">pass</span>
            

        thread.join()
            
        <span class="hljs-keyword">yield</span> <span class="hljs-string">&#x27;data:[DONE]\\n\\n&#x27;</span>
                    



<span class="hljs-meta">@app.local_entrypoint()</span>
<span class="hljs-keyword">def</span> <span class="hljs-title function_">cli</span>():
    question = <span class="hljs-string">&#x27;[{&quot;role&quot;: &quot;user&quot;, &quot;content&quot;: &quot;你好&quot;}]&#x27;</span>
    model = qwq()
    <span class="hljs-keyword">for</span> text <span class="hljs-keyword">in</span> model.generate.remote(question):
        <span class="hljs-built_in">print</span>(text, end=<span class="hljs-string">&quot;&quot;</span>, flush=<span class="hljs-literal">True</span>)


<span class="hljs-meta">@app.function(<span class="hljs-params">timeout=<span class="hljs-number">1200</span></span>)</span>
<span class="hljs-meta">@modal.fastapi_endpoint(<span class="hljs-params">method=<span class="hljs-string">&quot;POST&quot;</span></span>)</span>
<span class="hljs-keyword">def</span> <span class="hljs-title function_">get</span>(<span class="hljs-params">question: <span class="hljs-type">Dict</span></span>):
    <span class="hljs-keyword">from</span> fastapi.responses <span class="hljs-keyword">import</span> StreamingResponse
    <span class="hljs-keyword">from</span> itertools <span class="hljs-keyword">import</span> chain
    <span class="hljs-keyword">from</span> fastapi.responses <span class="hljs-keyword">import</span> JSONResponse
    model = qwq()
    <span class="hljs-keyword">return</span> StreamingResponse(
            model.generate.remote_gen(question[<span class="hljs-string">&quot;messages&quot;</span>]),
        media_type=<span class="hljs-string">&quot;text/event-stream&quot;</span>,
    )</code></pre></div>
<blockquote class="md-quote"><p>32B模型需要L4显卡才能以正常速度运行</p>
<p>可以修改scaledown_window的大小来调整无对话多长时间后关闭容器</p>
<p>因平台限制自写后端，比较繁琐</p>
</blockquote>
<p>然后运行：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">1 line</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">modal deploy qwq.py</code></pre></div>
<p>此时去网站上找调用api的地址，然后可以按照openai的api格式进行调用</p>
<p>这里提供一个我已经搭建好的玩具：<a class="md-link" href="https://chat.xuqinyang.top" target="_blank" rel="noopener noreferrer">QwQ-32B<span class="md-link-ext" aria-hidden="true">↗</span></a></p>
<p>容器冷启动需要时间，所以当第一次对话或是60秒之内无对话需要等待容器启动加载模型</p>
`,toc:[]};export{e as default};