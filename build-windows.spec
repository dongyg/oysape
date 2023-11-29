# -*- mode: python -*-

import argparse
import cpuinfo

arch = ('-'+cpuinfo.get_cpu_info().get('arch_string_raw')) if cpuinfo.get_cpu_info().get('arch_string_raw') else ''

parser = argparse.ArgumentParser()
parser.add_argument("--standalone", action="store_true")
options = parser.parse_args()

block_cipher = None

added_files = [
    ('.\\gui', 'gui'),
]

a = Analysis(['.\\src\\index.py'],
    pathex=['.\\dist'],
    binaries=None,
    datas=added_files,
    hiddenimports=['clr'],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

if options.standalone:
    exe = EXE(pyz,
        a.scripts,
        a.binaries,
        a.zipfiles,
        a.datas,
        name='Oysape-windows-standalone'+arch,
        debug=False,
        icon='.\\src\\assets\\logo.ico',
        console=False ) # set this to see error output of the executable
else:
    exe = EXE(pyz,
        a.scripts,
        exclude_binaries=True,
        name='Oysape',
        debug=False,
        strip=True,
        icon='.\\src\\assets\\logo.ico',
        upx=True,
        console=False ) # set this to see error output of the executable
    coll = COLLECT(exe,
        a.binaries,
        a.zipfiles,
        a.datas,
        strip=False,
        upx=False,
        name='Oysape-windows-portable'+arch)
