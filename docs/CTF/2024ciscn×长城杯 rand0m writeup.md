---
title: 2024ciscn长城杯_rand0m_writeup
createTime: 2025/03/08 14:24:33
permalink: /article/qnkp71ue/
tags: [pyd]
---
check.pyd丢进ida，查看string，发现可疑数字字符串

![1](.\rand0m_writeup_img\1.png)

查找引用直接找到模块常量初始化函数，模块的所有常量都储存在`off_18000B688`，之后逆向遇到常量时来这里对照：

```c
__int64 sub_180002BD0()
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
```

运行`import rand0m` `dir(rand0m)`发现该模块有两个函数`check`和`rand0m`，`check`接受一个16进制字符串（flag），返回True/False，`random`接受一个16进制字符串（seed），返回一个元组，包含两个伪随机数。



直接在代码段中搜索`Py_TrueStruct`，找到check函数代码段：

```c
__int64 __fastcall sub_180001960(__int64 a1, __int64 a2)
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
      PyErr_Format(PyExc_TypeError, "'%.200s' object is unsliceable", *(const char **)(v41 + 24));
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
```

通过交叉引用找到

![2](.\rand0m_writeup_img\2.png)

向上不远就是rand0m函数地址

![3](.\rand0m_writeup_img\3.png)

先分析rand0m函数：

```c
__int64 __fastcall sub_1800012B0(__int64 a1, _DWORD *a2)
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
```

提取关键运算：

```c
v12
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
```

分析sub_180004360可知该函数为右移函数：

```c
__int64 __fastcall sub_180004360(__int64 a1, __int64 a2, char a3, int a4)
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
```

猜测rand0m函数中v12为16进制字符串所表示的数字，可得到rand0m函数算法：

```python
第一个返回值：((int(n,16)^2654435769)>>11)**65537%4294967293
第二个返回值：((int(n,16)<<4)&4198170623)+((n>>5)>>23)
```

经验证算法正确

![6](.\rand0m_writeup_img\6.png)

接着分析check函数，该函数一定调用了rand0m函数，于是在rand0m函数中调用`PyNumber_Xor`函数处下断点（其中一个参数（ecx）为rand0m接受的参数），输入`rand0m.check("123456789abcdefedcba98765432123456789")`，共断下来4次，查看ecx指向的地址：

```assembly
Py_long(0x12345678):
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

```

可以看出check读取输入的前32位（bug: ，它并没有判断输入长度，所以flag后面加任意数字都可以），每8位为一组调用rand0m函数

同时观察堆栈：
![4](.\rand0m_writeup_img\4.png)

可以找到check函数调用rand0m的地方：

```c
v52 = sub_180004660(v39, &v85[-v51], (unsigned int)(v51 + 1));
```

后面使用该返回值：

```c
v34 = sub_180004790(v52, 1LL, v53, 0LL);
v39 = (int *)sub_180004790(v55, 0LL, v63, 0LL);
```

分析`sub_180004790`可知该函数用来根据索引值取出元素：

```c
int *__fastcall sub_180004790(_QWORD *a1, __int64 a2, __int64 a3, int a4)
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
```

继续分析可知去除两个元素后调用了`PyObject_RichCompare`进行比较，由于我懒得静态分析期待值是什么，可以直接在调用`PyObject_RichCompare`处函数下断点查看内存，由于第二个`PyObject_RichCompare`函数需要第一个`PyObject_RichCompare`函数返回True才会执行，所以可以直接将rcx的指向的地址修改成与rdx一致

![5](.\rand0m_writeup_img\5.png)

之后可以得到rand0m函数的期待值：

```
(0x98D24B3A,0x12287F38)
(0xE0F1DB77,0x4A30F74D)
(0xADF38403,0x23A1268)
(0xD8499BB6,0x88108807)
```

由于用c语言写幂模会溢出不知道怎么处理，所以先用c语言暴力找出满足第二个参数的输入，然后再用python筛选满足第一个参数的输入（只给出第一部分的求解代码）：

```c
#include <stdio.h>
#include <stdint.h>
int main() {
    uint64_t y = 0x12287F38;
    printf("a=[");
    for (uint64_t i = 0; i < 0xffffffff; i++) {
        if (((i << 4) & 4198170623) + ((i >> 5) >> 23) == y) {
            printf("\"%08X\",", i);
        }
    }
    printf("]\n");
    return 0;
}

```

```python
a=["812287F3","812297F3","8122C7F3","8122D7F3","812687F3","812697F3","8126C7F3","8126D7F3","812A87F3","812A97F3","812AC7F3","812AD7F3","812E87F3","812E97F3","812EC7F3","812ED7F3","813287F3","813297F3","8132C7F3","8132D7F3","813687F3","813697F3","8136C7F3","8136D7F3","813A87F3","813A97F3","813AC7F3","813AD7F3","813E87F3","813E97F3","813EC7F3","813ED7F3","816287F3","816297F3","8162C7F3","8162D7F3","816687F3","816697F3","8166C7F3","8166D7F3","816A87F3","816A97F3","816AC7F3","816AD7F3","816E87F3","816E97F3","816EC7F3","816ED7F3","817287F3","817297F3","8172C7F3","8172D7F3","817687F3","817697F3","8176C7F3","8176D7F3","817A87F3","817A97F3","817AC7F3","817AD7F3","817E87F3","817E97F3","817EC7F3","817ED7F3",]

for n in a:
    if(((int(n,16)^2654435769)>>11)**65537%4294967293==0x98D24B3A):
        print(n)

```

最后可得到满足条件的输入：

```
813A97F3D4B34F74802BA12678950880
```

但由于前文所说没有限制长度，所以输入可以是：

```
813A97F3D4B34F74802BA12678950880+任意16进制数字
```

最终flag为

```
flag{813A97F3D4B34F74802BA12678950880}
```

![8](.\rand0m_writeup_img\8.png)
