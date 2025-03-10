---
title: 利用Modal免费部署LLM
createTime: 2025/03/10 16:59:37
permalink: /article/z7s0wyfc/
tags: [LLM]
---
> 本文以部署QwQ-32B_q4量化为例

**modal每月提供\$30的免费额度（现在需要添加支付方式，之前不用）（未添加支付方式只有\$5额度）**

进入[Modal: High-performance AI infrastructure](https://modal.com/)，使用GitHub账号注册

然后本地安装modal库（版本经常更新，可能会更改api，本文使用的版本是0.73.90）

```
pip install modal
```

在Modal网站进入个人设置，在API tokens处生成一个token，并在本地设置token

```
modal token set --token-id xxx --token-secret xxx
```

新建qwq.py：

```python
from modal import Image, app, method, web_endpoint,App
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
    #    "CMAKE_ARGS=\"-DGGML_CUDA=on\" pip install llama-cpp-python"
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
    # Use huggingface's hi-perf hf-transfer library to download this large model.
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
    .run_function(download_model)
)
app = App(name="QwQ", image=image)

@app.cls(gpu="L4",timeout=1200, scaledown_window=60)
class qwq:
    @modal.enter()
    def e(self):
        from llama_cpp import Llama
        self.llm = Llama(model_path=IMAGE_MODEL_DIR+"/Qwen_QwQ-32B-Q4_K_M.gguf", n_ctx=4096,seed=-1,n_gpu_layers=-1)
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
                    que.put("data:"+str(response).replace('\'','\"').replace("None","\"None\"")+"\n\n")
                    if time.time()-st>1000:
                        break
            que.put(None)

        yield "data:"+str({"id":"chatcmpl-b32f3ee7-358b-4001-bb0a-44447a99c5d3","model":"/model/ggml-model-q4_0.bin","created":1691553316,"object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":""},"finish_reason":None}]}).replace('\'','\"').replace("None","\"None\"")+"\n\n"
        flag = 0
        que = Queue()
        thread = Thread(target=gen)
        thread.start()
        while flag==0:
            yield "data:"+str({"id":"chatcmpl-b32f3ee7-358b-4001-bb0a-44447a99c5d3","model":"/model/ggml-model-q4_0.bin","created":1691553316,"object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":""},"finish_reason":None}]}).replace('\'','\"').replace("None","\"None\"")+"\n\n"
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
            
        yield 'data:[DONE]\n\n'
                    



@app.local_entrypoint()
def cli():
    question = '[{"role": "user", "content": "你好"}]'
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
```

> 32B模型需要L4显卡才能以正常速度运行
>
> 可以修改scaledown_window的大小来调整无对话多长时间后关闭容器
>
> 因平台限制自写后端，比较繁琐

然后运行：

```
modal deploy qwq.py
```

此时去网站上找调用api的地址，然后可以按照openai的api格式进行调用

这里提供一个我已经搭建好的玩具：[QwQ-32B](https://chat.xuqinyang.top)

容器冷启动需要时间，所以当第一次对话或是60秒之内无对话需要等待容器启动加载模型