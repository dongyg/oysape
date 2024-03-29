#!/usr/bin/env python
# -*- coding: utf-8 -*-

__all__ = [
    'IS_DEBUG', 'homeEntry', 'OYSAPE_HOST', 'API_ROOT'
]

import os, json

def get_home_entry():
    if os.path.exists(os.path.realpath('../gui/index.html')):
        return os.path.realpath('../gui/index.html')
    if os.path.exists(os.path.realpath('../Resources/gui/index.html')):
        return os.path.realpath('../Resources/gui/index.html')
    if os.path.exists(os.path.realpath('./gui/index.html')):
        return os.path.realpath('./gui/index.html')
    raise Exception('No index.html found')

# Change this to True on development environment
IS_DEBUG = True


# Variables for local app
# homeEntry = 'http://localhost:3000' if IS_DEBUG else get_home_entry()
homeEntry = 'http://localhost:3000' if IS_DEBUG else 'http://192.168.0.2:19790/index.html'
# homeEntry = 'http://192.168.0.2:19790/index.html'


# Variables for server conmunication
OYSAPE_HOST = 'http://localhost:8080' if IS_DEBUG else 'https://oysape.aifetel.cc'
API_ROOT = '/oyapi'

defaultExclude = [
    ".DS_Store ._* .Spotlight-V100 .Trashes Thumbs.db Desktop.ini",
    "_MTN .bzr .hg .fslckout _FOSSIL_ .fos CVS _darcs .git .svn .osc .gitattributes .gitmodules",
    "*.pyc *.pyo *.class *.a *.obj *.o *.so *.la *.lib *.dylib *.ocx *.dll *.exe *.jar *.zip *.tar *.tar.gz *.tgz *.rpm *.dmg *.pkg *.deb}",
    "*.jpg *.jpeg *.gif *.png *.bmp *.tiff *.tif *.webp *.wav *.mp3 *.ogg *.flac *.avi *.mpg *.mp4 *.mkv *.xcf *.xpm}",
    "node_modules"
]
