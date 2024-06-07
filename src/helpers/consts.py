#!/usr/bin/env python
# -*- coding: utf-8 -*-

__all__ = [
    'IS_DEBUG', 'IS_LOGGING', 'HOME_ENTRY', 'OYSAPE_HOST', 'API_ROOT', 'DEFAULT_EXCLUDE', 'initVariants',
]

# def get_home_entry():
#     import os
#     if os.path.exists(os.path.realpath('../gui/index.html')):
#         return os.path.realpath('../gui/index.html')
#     if os.path.exists(os.path.realpath('../Resources/gui/index.html')):
#         return os.path.realpath('../Resources/gui/index.html')
#     if os.path.exists(os.path.realpath('./gui/index.html')):
#         return os.path.realpath('./gui/index.html')
#     raise Exception('No index.html found')

# Change this to True on development environment
IS_DEBUG = False
IS_LOGGING = True
API_ROOT = '/oyapi'

# Variables for local app
# HOME_ENTRY = 'http://localhost:3000'
HOME_ENTRY = 'http://127.0.0.1:19790/index.html?v=2.5.28'


# Variables for server conmunication
# OYSAPE_HOST = 'http://localhost:8080'
OYSAPE_HOST = 'https://oysape.aifetel.cc'


DEFAULT_EXCLUDE = [
    ".DS_Store ._* .Spotlight-V100 .Trashes Thumbs.db Desktop.ini",
    "_MTN .bzr .hg .fslckout _FOSSIL_ .fos CVS _darcs .git .svn .osc .gitattributes .gitmodules",
    "*.pyc *.pyo *.class *.a *.obj *.o *.so *.la *.lib *.dylib *.ocx *.dll *.exe *.jar *.zip *.tar *.tar.gz *.tgz *.rpm *.dmg *.pkg *.deb}",
    "*.jpg *.jpeg *.gif *.png *.bmp *.tiff *.tif *.webp *.wav *.mp3 *.ogg *.flac *.avi *.mpg *.mp4 *.mkv *.xcf *.xpm}",
    "node_modules"
]

def initVariants(is_debug, version):
    import datetime, os, logging
    logging.basicConfig(filename=os.path.expanduser(os.path.join('~', 'oysape.log')), level=(logging.INFO if is_debug else logging.WARNING), format='%(asctime)s - %(filename)s:%(lineno)d - %(levelname)s - %(message)s')
    global IS_DEBUG, HOME_ENTRY, OYSAPE_HOST
    IS_DEBUG = is_debug
    if is_debug:
        # HOME_ENTRY  = 'http://127.0.0.1:19790/index.html?v=%s&r=%s' % (version, datetime.datetime.now().strftime('%Y.%m%d.%H%M%S'))
        # OYSAPE_HOST = 'https://oysape.aifetel.cc'
        HOME_ENTRY  = 'http://localhost:3000'
        OYSAPE_HOST = 'http://localhost:8080'
    else:
        HOME_ENTRY  = 'http://127.0.0.1:19790/index.html?v=%s&r=%s' % (version, datetime.datetime.now().strftime('%Y.%m%d.%H%M%S'))
        OYSAPE_HOST = 'https://oysape.aifetel.cc'
