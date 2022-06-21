# crack
## Typora破解(1.3.6)
<iframe src="https://xqy2006.github.io/dist-pages/license.html?dayRemains=15&amp;index=0&amp;hasActivated=true&amp;email=This_is_my_Email&amp;license=This_is_my_License_Code&amp;lang=zh-Hans&amp;needLicense=false&amp;type=1&amp;os=win" style="
    width: 525px;
    height: 420px;
"></iframe>

#### 1. 抓取解密后js：

```powershell
pip install frida
frida "D:\Program Files\Typora\Typora.exe" -l "./unpack.js"
```

unpack.js:

```javascript
let napi_create_string_utf8 = Module.getExportByName(null, 'napi_create_string_utf8');
var index = 0;
if (napi_create_string_utf8) {
    console.log('绑定成功');
    Interceptor.attach(napi_create_string_utf8, {
        onEnter: function (args) {
            console.log('napi_create_string_utf8', '调用', args[0], args[1].readCString().substring(0, 100), args[2], args[3]);
 
            if (args[2].toInt32() > 100) { // 过滤出大文件
                index += 1;
                var f = new File('export_' + String(index) + '.js', 'wb');
                f.write(args[1].readByteArray(args[2].toInt32()));
                f.flush();
                f.close();
 
            }
        }
    });
} else {
    console.log('绑定失败');
}
```

#### 2. 将解包出来最大的js重命名为Atom.js，找到以下代码替换RSA Public Key的base64，删除renew：

```javascript
T=JSON.parse(Buffer.from("WyItLS0tLUJFR0lOIFBVQkxJQyBLRVktLS0tLSIsIk1JSUJJakFOQmdrcWhraUc5dzBCQVFFRkFBT0NBUThBTUlJQkNnS0NBUUVBek9KOFBXTkxSbkpST3Y1UzhZcFIiLCJ5TVkrMFQwRlZjY2drMEQ1Z3N6YlE3N01WYzlwd2grYmEvenE4aUV4SjdVZ3dsN2FjNHd5MnAvVkJRMms1ZzJqIiwiZVI5TFRoRG9kNXRzWnhmYmppK0lHTGN1SkJCY3J0d3dDeWl6U1JTVTNFbHVoZm1kck9PRHdEUnQvYWxrdFhDaSIsIlQ5Si9JMG03UGcwdTJvaDFXYjY0WndWSDRsVEpaTFByZk8waXhFRjcrSGl1ZytWWi9oMFRnLzZOTjJNaGZJRFciLCIwQk56cUw5dmFZSXhsdUdSaWM2dE5Ra240SGFWZFFGODF2K1hsL1FjRHc2T05MNkFrUEF2TkI1ZGZENm4zb2IyIiwiZjNNMWlySU9PVlZZb3Z0b0ErMXBOTDJLUEsrNE94M3lSSEZWUmlBNms2NXduNlg3anNWNWpDdWdoQ2dyVVhjRiIsIlV3SURBUUFCIiwiLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tIiwiIiwiIl0=","base64").toString("utf8"))

//删除下面的/api/client/renew
const a = await (await k(W + "/api/client/renew", {
										method: "POST",
										cache: "no-cache",
										body: JSON.stringify(n),
										headers: {
											"Content-Type": "application/json",
											"Cache-Control": "no-cache"
										}
									}
```

#### 3. 解包app.asar：

```powershell
npm install asar -g
cd D:\Program Files\Typora\resources
asar extract ./app.asar ./app
```

#### 4. 将刚刚修改好的Atom.js替换“D:\Program Files\Typora\resources\app\”下的同名文件

#### 5. 删除“D:\Program Files\Typora\resources\”下的“app.asar”

#### 6. 编写keygen

RSA公私钥生成：

```javascript
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
 
const keyPair = crypto.generateKeyPairSync('rsa', {
   modulusLength: 2048,
   publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
   },
   privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
   }
});
 
fs.writeFileSync("public_key.pem", keyPair.publicKey);
fs.writeFileSync("private_key.pem", keyPair.privateKey);
```

keygen:

```javascript
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const root = __dirname;
function doEnc(MachineCode, email, license) {
    var mc = JSON.parse(Buffer.from(MachineCode, 'base64').toString());
    var signInfo = { fingerprint: mc.i, email, license, type: '1' };
    return JSON.stringify(signInfo);
}

const privateKey = fs.readFileSync(path.join(root, './private_key.pem')).toString('ascii');
const code = doEnc("eyJ2Ijoid2lufDEuMy42IiwiaSI6IjhqT0VscDBXamsiLCJsIjoiTEFQVE9QLTVBUEZHOTM3IHwgMjYwMTkgfCBXaW5kb3dzIn0=","Crack_By_Xuqinyang","Crack_By_Xuqinyang");
const key = crypto.privateEncrypt(privateKey, Buffer.from(code)).toString('base64');
console.log("+"+key);
```

#### 7. 将keygen生成的注册码输入到离线注册窗口并注册
<iframe src="https://xqy2006.github.io/dist-pages/license.html?dayRemains=15&amp;index=0&amp;hasActivated=true&amp;email=This_is_my_Email&amp;license=This_is_my_License_Code&amp;lang=zh-Hans&amp;needLicense=false&amp;type=1&amp;os=win" style="
    width: 525px;
    height: 420px;
"></iframe>
