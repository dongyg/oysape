import os
import py2app
import shutil
import cpuinfo

from distutils.core import setup

def tree(src):
    return [(root, map(lambda f: os.path.join(root, f), files))
        for (root, dirs, files) in os.walk(os.path.normpath(src))]

if os.path.exists('build'):
    shutil.rmtree('build')

if os.path.exists('dist/Oysape.app'):
    shutil.rmtree('dist/Oysape.app')

arch = ('-'+cpuinfo.get_cpu_info().get('arch_string_raw')) if cpuinfo.get_cpu_info().get('arch_string_raw') else ''

ENTRY_POINT = ['src/index.py']

DATA_FILES = tree('dist')
OPTIONS = {
    'argv_emulation': False,
    'strip': True,
    'iconfile': 'src/assets/logo.icns',
    'includes': ['WebKit', 'Foundation', 'webview', 'pkg_resources.py2_warn', 'paramiko', 'cffi'],
    'resources': ['gui'],
    'plist': {
        'CFBundleName': 'Oysape',
        'CFBundleShortVersionString':'2024.0411.2',
        'CFBundleVersion': '2024.0411.2',
        'CFBundleIdentifier':'cc.aifetel.oysape',
        'NSHumanReadableCopyright': '@ Aifetel 2024'
    }
}

setup(
    app=ENTRY_POINT,
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)
