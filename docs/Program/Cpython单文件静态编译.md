---
title: Cpython单文件静态编译
createTime: 2025/03/08 23:00:35
permalink: /article/424j6n5w/
tags: [python]
---
> 本文依据python3.13.2+编写

前往[python/cpython: The Python programming language](https://github.com/python/cpython)下载python源码，解压

进入PCbuild文件夹，运行`get_externals.bat`下载依赖（可能需要魔法）

下载完依赖后使用VS打开`pcbuild.sln`，将配置由`Debug`改为`Release`（确保此时是x64 Release），在解决方案资源管理器中选中`Python`，右键生成

此时`PCbuild`文件夹下生成`amd64`文件夹

在解决方案资源管理器中找到`pythoncore`，右键属性，配置选择Release，平台选择x64，配置属性-->常规-->配置类型由动态库(.dll)改为静态库(.lib)

C/C++-->预处理器-->预处理器定义点击编辑，取消继承，并修改定义为

```
_Py_HAVE_ZLIB
_USRDLL
Py_BUILD_CORE
Py_BUILD_CORE_BUILTIN
Py_NO_ENABLE_SHARED
MS_DLL_ID="$(SysWinVer)"
WIN32
$(_Py3NamePreprocessorDefinition)
$(_PlatformPreprocessorDefinition)$(_DebugPreprocessorDefinition)$(_PydPreprocessorDefinition)_WINDLL
```

C/C++-->代码生成-->运行库修改为多线程（/MT）

应用上述`pythoncore`的修改

在解决方案资源管理器中找到`Python`，右键属性，配置选择Release，平台选择x64，

C/C++-->预处理器-->预处理器定义点击编辑，不要取消继承，并修改定义为

```
Py_BUILD_CORE
_CONSOLE
Py_NO_ENABLE_SHARED
```

C/C++-->代码生成-->运行库修改为多线程（/MT）

链接器-->输入-->附加依赖项添加

```
bcrypt.lib
version.lib
ws2_32.lib
pathcch.lib
```

应用上述`python`的修改

打开`Lib/site.py`，寻找`sys.winver.replace('.', '')`修改为`"3.13".replace('.', '')`（3.13修改为你编译的python版本）

打开`Lib/_pyrepl/__main.py__`，在文件的开头加上

```python
__package__ = '_pyrepl'
__path__ = [__name__]
```

打开`Tools/build/freeze_modules.py`

将整个文件内容替换为下面的代码

```python
"""Freeze modules and regen related files (e.g. Python/frozen.c).

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
FrozenModule1 = namedtuple('FrozenModule', [
    'fullname',      # 完整模块名（如"encodings.utf_8"）
    'py_path',       # 源文件路径（如"Lib/encodings/utf_8.py"）
    'h_path',        # 生成的头文件路径（如"Python/frozen_modules/encodings/utf_8.h"）
    'c_path',        # 生成的C文件路径（如"Python/frozen_modules/encodings/utf_8.c"）
    'is_package'     # 是否为包目录
])
def find_python_modules(root_dir):
    """
    递归查找所有Python模块
    返回生成器：FrozenModule对象
    """
    lib_dir = os.path.join(root_dir, 'Lib')
    frozen_dir = os.path.join(root_dir, 'Python', 'frozen_modules')

    for root, dirs, files in os.walk(lib_dir):
        # 计算模块相对路径（相对于Lib目录）
        rel_path = os.path.relpath(root, lib_dir)
        if rel_path == ".":
            namespace_parts = []
        else:
            namespace_parts = rel_path.split(os.sep)

        # 处理包目录（包含__init__.py）
        if '__init__.py' in files:
            pkg_name = ".".join(namespace_parts) if namespace_parts else ""
            
            # 生成包自身的模块信息（不要__init__.h）
            yield FrozenModule1(
                fullname=pkg_name,
                py_path=os.path.join(root, '__init__.py'),
                h_path=os.path.join(frozen_dir, f"{pkg_name}.h") if pkg_name else "",
                c_path=os.path.join(frozen_dir, f"{pkg_name}.c") if pkg_name else "",
                is_package=True
            )

            # 处理包内所有子模块
            for f in files:
                if f.endswith('.py') and f != '__init__.py':
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
                if f.endswith('.py'):
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
    
    for root, dirs, files in os.walk(os.path.join(ROOT_DIR, 'Python', 'frozen_modules')):
        for file in files:
            if file.endswith('.h'):
                # 分离文件名和扩展名
                name_without_ext = os.path.splitext(file)[0]
                filenames.append(name_without_ext)
    print(filenames)
    return filenames


ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
ROOT_DIR = os.path.abspath(ROOT_DIR)
FROZEN_ONLY = os.path.join(ROOT_DIR, 'Tools', 'freeze', 'flag.py')

STDLIB_DIR = os.path.join(ROOT_DIR, 'Lib')
# If FROZEN_MODULES_DIR or DEEPFROZEN_MODULES_DIR is changed then the
# .gitattributes and .gitignore files needs to be updated.
FROZEN_MODULES_DIR = os.path.join(ROOT_DIR, 'Python', 'frozen_modules')

FROZEN_FILE = os.path.join(ROOT_DIR, 'Python', 'frozen.c')
MAKEFILE = os.path.join(ROOT_DIR, 'Makefile.pre.in')
PCBUILD_PROJECT = os.path.join(ROOT_DIR, 'PCbuild', '_freeze_module.vcxproj')
PCBUILD_FILTERS = os.path.join(ROOT_DIR, 'PCbuild', '_freeze_module.vcxproj.filters')
PCBUILD_PYTHONCORE = os.path.join(ROOT_DIR, 'PCbuild', 'pythoncore.vcxproj')


FREEZE_MODULE_EXE = os.path.join(ROOT_DIR, 'PCbuild', 'amd64', '_freeze_module.exe')

OS_PATH = 'ntpath' if os.name == 'nt' else 'posixpath'

# These are modules that get frozen.
# If you're debugging new bytecode instructions,
# you can delete all sections except 'import system'.
# This also speeds up building somewhat.
TESTS_SECTION = 'Test module'
FROZEN = [
    # See parse_frozen_spec() for the format.
    # In cases where the frozenid is duplicated, the first one is re-used.
    ('import system', [
        *load_auto_frozen(),
        # These frozen modules are necessary for bootstrapping
        # the import system.
        'importlib._bootstrap : _frozen_importlib',
        'importlib._bootstrap_external : _frozen_importlib_external',
        # This module is important because some Python builds rely
        # on a builtin zip file instead of a filesystem.
        'zipimport',
        ]),
    # (You can delete entries from here down to the end of the list.)
    ('stdlib - startup, without site (python -S)', [
        'abc',
        'codecs',
        # For now we do not freeze the encodings, due # to the noise all
        # those extra modules add to the text printed during the build.
        # (See https://github.com/python/cpython/pull/28398#pullrequestreview-756856469.)
        #'<encodings.*>',
        'io',
        ]),
    ('stdlib - startup, with site', [
        '_collections_abc',
        '_sitebuiltins',
        'genericpath',
        'ntpath',
        'posixpath',
        # We must explicitly mark os.path as a frozen module
        # even though it will never be imported.
        f'{OS_PATH} : os.path',
        'os',
        'site',
        'stat',
        ]),
    ('runpy - run module with -m', [
        "importlib.util",
        "importlib.machinery",
        "runpy",
    ]),
    (TESTS_SECTION, [
        
        '__hello__',
        '__hello__ : __hello_alias__',
        '__hello__ : <__phello_alias__>',
        '__hello__ : __phello_alias__.spam',
        ]),
    # (End of stuff you could delete.)
]
BOOTSTRAP = {
    'importlib._bootstrap',
    'importlib._bootstrap_external',
    'zipimport',
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
    frozen_dir = os.path.join(root_dir, 'Python', 'frozen_modules')
    if os.path.exists(frozen_dir):
        shutil.rmtree(frozen_dir)
    
    # 创建冻结工具路径
    freeze_tool = os.path.join(root_dir, 'PCbuild', 'amd64', '_freeze_module.exe')
    
    # 遍历所有模块
    for module in find_python_modules(root_dir):
        if(module.fullname.startswith('test')==False):
            # 创建目标目录
            os.makedirs(os.path.dirname(module.h_path), exist_ok=True)
            
            # 构建命令行参数
            cmd = [
                freeze_tool,
                module.fullname,
                module.py_path,
                module.h_path,
            ]
            
            print(f"冻结命令: {' '.join(cmd)}")
            # 执行冻结命令
            try:
                if(module.is_package):
                    with open(module.py_path, 'rb') as f:
                        content = f.read()
                    
                    bom = b''
                    newline = b'\n'  # 默认换行符
                    insert_pos = 0
                    
                    # 处理 BOM（UTF-8 文件头）
                    if content.startswith(b'\xef\xbb\xbf'):
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
                            if line.endswith(b'\r\n'):
                                newline = b'\r\n'
                            elif line.endswith(b'\n'):
                                newline = b'\n'
                            break
                    
                    # 生成要插入的字节内容
                    new_lines = [
                        f"__package__ = '{module.fullname}'\n".encode('utf-8') + newline,
                        "__path__ = [__name__]\n".encode('utf-8') + newline
                    ]
                    
                    # 判断插入位置
                    if first_non_empty_idx is not None:
                        target_line = lines[first_non_empty_idx]
                        # 检查是否以 from __future__ 开头（允许前导空格）
                        if target_line.lstrip().startswith(b'from __future__'):
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
                    new_content = bom + b''.join(lines)
                    
                    # 写回文件
                    with open(module.py_path, 'wb') as f:
                        f.write(new_content)
                    #with open(module.py_path, 'rb+') as f:
                    #    old = f.read()
                    #    f.seek(0)
                    #    f.write(old)
                    #    f.write(f"__package__ = '{module.fullname}'\n".encode("utf-8"))
                    #    f.write("__path__ = [__name__]\n".encode("utf-8"))
                        
                result = subprocess.run(
                    cmd,
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding='utf-8',
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

    Angle brackets around a frozenid (e.g. '<encodings>") indicate
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
    frozenid, _, remainder = spec.partition(':')
    modname, _, pyfile = remainder.partition('=')
    frozenid = frozenid.strip()
    modname = modname.strip()
    pyfile = pyfile.strip()

    submodules = None
    if modname.startswith('<') and modname.endswith('>'):
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

class FrozenSource(namedtuple('FrozenSource', 'id pyfile frozenfile')):

    @classmethod
    def from_id(cls, frozenid, pyfile=None):
        if not pyfile:
            pyfile = os.path.join(STDLIB_DIR, *frozenid.split('.')) + '.py'
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
        name = self.frozenid.replace('.', '_')
        return '_Py_M__' + name

    @property
    def ispkg(self):
        if not self.pyfile:
            return False
        elif self.frozenid.endswith('.__init__'):
            return False
        else:
            return os.path.basename(self.pyfile) == '__init__.py'

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
            raise ValueError(f'unsupported frozenid {frozenid!r}')
    # We use a consistent naming convention for all frozen modules.
    frozenfile = f'{frozenid}.h'
    if not destdir:
        return frozenfile
    return os.path.join(destdir, frozenfile)


#######################################
# frozen modules

class FrozenModule(namedtuple('FrozenModule', 'name ispkg section source')):

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
            source = f'<{source}>'
        else:
            source = relpath_for_posix_display(self.pyfile, ROOT_DIR)
        return {
            'module': self.name,
            'ispkg': self.ispkg,
            'source': source,
            'frozen': os.path.basename(self.frozenfile),
            'checksum': _get_checksum(self.frozenfile),
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
            pyfile = os.path.join(pyfile, '__init__.py')
    
    ispkg = False
    # 检查是否为包
    if os.path.basename(pyfile) == '__init__.py':
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
    yield pkgname, os.path.join(pkgdir, '__init__.py'), True
    
    for root, dirs, files in os.walk(pkgdir):
        rel_path = os.path.relpath(root, pkgdir).replace(os.sep, '.')
        if rel_path == '.':
            rel_path = ''
        
        for f in files:
            if f.endswith('.py') and f != '__init__.py':
                modname = f'{pkgname}.{rel_path}.{f[:-3]}' if rel_path else f'{pkgname}.{f[:-3]}'
                yield modname, os.path.join(root, f), False
        
        for d in dirs:
            subdir = os.path.join(root, d)
            if os.path.exists(os.path.join(subdir, '__init__.py')):
                submod = f'{pkgname}.{rel_path}.{d}' if rel_path else f'{pkgname}.{d}'
                yield from _find_package_modules(submod, subdir)

def check_modname(modname):
    print(modname)
    return all(n.isidentifier() for n in modname.split('.'))


def iter_submodules(pkgname, pkgdir=None, match='*'):
    if not pkgdir:
        pkgdir = os.path.join(STDLIB_DIR, *pkgname.split('.'))
    if not match:
        match = '**.*'
    match_modname = _resolve_modname_matcher(match, pkgdir)

    def _iter_submodules(pkgname, pkgdir):
        for entry in sorted(os.scandir(pkgdir), key=lambda e: e.name):
            matched, recursive = match_modname(entry.name)
            if not matched:
                continue
            modname = f'{pkgname}.{entry.name}'
            if modname.endswith('.py'):
                yield modname[:-3], entry.path, False
            elif entry.is_dir():
                pyfile = os.path.join(entry.path, '__init__.py')
                # We ignore namespace packages.
                if os.path.exists(pyfile):
                    yield modname, pyfile, True
                    if recursive:
                        yield from _iter_submodules(modname, entry.path)

    return _iter_submodules(pkgname, pkgdir)


def _resolve_modname_matcher(match, rootdir=None):
    if isinstance(match, str):
        if match.startswith('**.'):
            recursive = True
            pat = match[3:]
            assert match
        else:
            recursive = False
            pat = match

        if pat == '*':
            def match_modname(modname):
                return True, recursive
        else:
            raise NotImplementedError(match)
    elif callable(match):
        match_modname = match(rootdir)
    else:
        raise ValueError(f'unsupported matcher {match!r}')
    return match_modname


def _resolve_module(modname, pathentry=STDLIB_DIR, ispkg=False):
    assert pathentry, pathentry
    pathentry = os.path.normpath(pathentry)
    assert os.path.isabs(pathentry)
    if ispkg:
        return os.path.join(pathentry, *modname.split('.'), '__init__.py')
    return os.path.join(pathentry, *modname.split('.')) + '.py'


#######################################
# regenerating dependent files

def find_marker(lines, marker, file):
    for pos, line in enumerate(lines):
        if marker in line:
            return pos
    raise Exception(f"Can't find {marker!r} in file {file}")


def replace_block(lines, start_marker, end_marker, replacements, file):
    start_pos = find_marker(lines, start_marker, file)
    end_pos = find_marker(lines, end_marker, file)
    if end_pos <= start_pos:
        raise Exception(f"End marker {end_marker!r} "
                        f"occurs before start marker {start_marker!r} "
                        f"in file {file}")
    replacements = [line.rstrip() + '\n' for line in replacements]
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
        # Adding a comment to separate sections here doesn't add much,
        # so we don't.
        header = relpath_for_posix_display(src.frozenfile, parentdir)
        headerlines.append(f'#include "{header}"')

    externlines = UniqueList()
    bootstraplines = []
    stdliblines = []
    testlines = []
    aliaslines = []
    indent = '    '
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
                    lines.append('')
                lines.append(f'/* {mod.section} */')
            lastsection = mod.section

        pkg = 'true' if mod.ispkg else 'false'
        size = f"(int)sizeof({mod.symbol})"
        line = f'{{"{mod.name}", {mod.symbol}, {size}, {pkg}}},'
        lines.append(line)

        if mod.isalias:
            if not mod.orig:
                entry = '{"%s", NULL},' % (mod.name,)
            elif mod.source.ispkg:
                entry = '{"%s", "<%s"},' % (mod.name, mod.orig)
            else:
                entry = '{"%s", "%s"},' % (mod.name, mod.orig)
            aliaslines.append(indent + entry)

    for lines in (bootstraplines, stdliblines, testlines):
        # TODO: Is this necessary any more?
        if lines and not lines[0]:
            del lines[0]
        for i, line in enumerate(lines):
            if line:
                lines[i] = indent + line

    print(f'# Updating {os.path.relpath(FROZEN_FILE)}')
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
    rules = ['']
    for src in _iter_sources(modules):
        frozen_header = relpath_for_posix_display(src.frozenfile, ROOT_DIR)
        frozenfiles.append(f'\t\t{frozen_header} \\')
        #print(frozen_header)
        pyfile = relpath_for_posix_display(src.pyfile, ROOT_DIR)
        pyfiles.append(f'\t\t{pyfile} \\')

        if src.isbootstrap:
            freezecmd = '$(FREEZE_MODULE_BOOTSTRAP)'
            freezedep = '$(FREEZE_MODULE_BOOTSTRAP_DEPS)'
        else:
            freezecmd = '$(FREEZE_MODULE)'
            freezedep = '$(FREEZE_MODULE_DEPS)'

        freeze = (f'{freezecmd} {src.frozenid} '
                    f'$(srcdir)/{pyfile} {frozen_header}')
        rules.extend([
            f'{frozen_header}: {pyfile} {freezedep}',
            f'\t{freeze}',
            '',
        ])
    pyfiles[-1] = pyfiles[-1].rstrip(" \\")
    frozenfiles[-1] = frozenfiles[-1].rstrip(" \\")

    print(f'# Updating {os.path.relpath(MAKEFILE)}')
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
        intfile = ntpath.splitext(ntpath.basename(header))[0] + '.g.h'
        projlines.append(f'    <None Include="..\\{pyfile}">')
        projlines.append(f'      <ModName>{src.frozenid}</ModName>')
        projlines.append(f'      <IntFile>$(IntDir){intfile}</IntFile>')
        projlines.append(f'      <OutFile>$(GeneratedFrozenModulesDir){header}</OutFile>')
        projlines.append(f'    </None>')

        filterlines.append(f'    <None Include="..\\{pyfile}">')
        filterlines.append('      <Filter>Python Files</Filter>')
        filterlines.append('    </None>')

    print(f'# Updating {os.path.relpath(PCBUILD_PROJECT)}')
    with updating_file_with_tmpfile(PCBUILD_PROJECT) as (infile, outfile):
        lines = infile.readlines()
        lines = replace_block(
            lines,
            '<!-- BEGIN frozen modules -->',
            '<!-- END frozen modules -->',
            projlines,
            PCBUILD_PROJECT,
        )
        outfile.writelines(lines)
    print(f'# Updating {os.path.relpath(PCBUILD_FILTERS)}')
    with updating_file_with_tmpfile(PCBUILD_FILTERS) as (infile, outfile):
        lines = infile.readlines()
        lines = replace_block(
            lines,
            '<!-- BEGIN frozen modules -->',
            '<!-- END frozen modules -->',
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
    parser.add_argument('--step', type=int, default=0)
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
    

if __name__ == '__main__':
    main()

```

打开`Tools/build/update_file.py`

将整个文件内容替换为下面的代码

```python
"""
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
        tmpfile = filename + '.tmp'
    elif os.path.isdir(tmpfile):
        tmpfile = os.path.join(tmpfile, filename + '.tmp')

    with open(filename, 'rb') as infile:
        line = infile.readline()

    if line.endswith(b'\r\n'):
        newline = "\r\n"
    elif line.endswith(b'\r'):
        newline = "\r"
    elif line.endswith(b'\n'):
        newline = "\n"
    else:
        raise ValueError(f"unknown end of line: {filename}: {line!a}")

    with open(tmpfile, 'w', newline=newline,encoding='utf8') as outfile:
        with open(filename,encoding='utf8') as infile:
            yield infile, outfile
    update_file_with_tmpfile(filename, tmpfile)


def update_file_with_tmpfile(filename, tmpfile, *, create=False):
    try:
        targetfile = open(filename, 'rb')
    except FileNotFoundError:
        if not create:
            raise  # re-raise
        outcome = 'created'
        os.replace(tmpfile, filename)
    else:
        with targetfile:
            old_contents = targetfile.read()
        with open(tmpfile, 'rb') as f:
            new_contents = f.read()
        # Now compare!
        if old_contents != new_contents:
            outcome = 'updated'
            os.replace(tmpfile, filename)
        else:
            outcome = 'same'
            os.unlink(tmpfile)
    return outcome


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--create', action='store_true')
    parser.add_argument('--exitcode', action='store_true')
    parser.add_argument('filename', help='path to be updated')
    parser.add_argument('tmpfile', help='path with new contents')
    args = parser.parse_args()
    kwargs = vars(args)
    setexitcode = kwargs.pop('exitcode')

    outcome = update_file_with_tmpfile(**kwargs)
    if setexitcode:
        if outcome == 'same':
            sys.exit(0)
        elif outcome == 'updated':
            sys.exit(1)
        elif outcome == 'created':
            sys.exit(2)
        else:
            raise NotImplementedError

```

在python源代码根目录下打开cmd，依次运行（这里使用python如果报错的话是因为使用了刚编译的python，你可以将其替换为本地的python路径）：

```powershell
python ./Tools/build/freeze_modules.py --step=0
python ./Tools/build/freeze_modules.py --step=1
"PCbuild/amd64/_freeze_module.exe" _pyrepl ./Lib/_pyrepl/__main__.py ./Python/frozen_modules/_pyrepl.h
```

回到VS，选择`Python`项目，右键生成，生成完后会报很多错，不用理会，此时`amd64`文件夹下已经生成可单文件运行的`python.exe`，包含了标准库，如果还需拓展库的话，可以在`python.exe`的同文件夹下防止`python313.zip`，zip中压缩库文件（也可以在运行`python ./Tools/build/freeze_modules.py --step=0`之前将这些库放置到源码的Lib目录下进行freeze）

这里提供一个成品：[python](/python.exe)

------

**update：**
这样编译完后每次运行Python会因为找不到环境变量而产生Warning：

```
Could not find platform independent libraries <prefix>
```

可以修改`\Modules\getpath.py`，删掉其中的`warn('Could not find platform independent libraries <prefix>')`

上面给的成品未作修改

`python ./Tools/build/freeze_modules.py --step=0`命令将会修改`Lib`文件夹中的部分文件，所以请不要重复运行，如需重新运行请删除`LIb`文件夹并重新解压

------

**编译3.13以前版本时**：

- 会没有`_pyrepl`库，因此不用修改`Lib/_pyrepl/__main.py__`，并且不用运行`"PCbuild/amd64/_freeze_module.exe _pyrepl" ./Lib/_pyrepl/__main__.py ./Python/frozen_modules/_pyrepl.h`

- 第二次编译静态链接版本时可能会提示找不到getpath.h，你可以在第一次成功编译的`PCbuild/obj/_freeze_module`文件夹中找到`getpath.g.h`，重命名为`getpath.h`后放到`Python/frozen_modules/`文件夹中即可
- 这里提供一个python3.12成品：[python](/python-3.12.exe)