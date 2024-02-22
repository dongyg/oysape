#!/usr/bin/env python
# -*- coding: utf-8 -*-

__all__ = [
    'IS_DEBUG', 'windowObj', 'homeEntry', 'userToken', 'API_HOST', 'API_ROOT',
]

import os

def get_home_entry():
    if os.path.exists('../gui/index.html'): # unfrozen development
        return '../gui/index.html'
    if os.path.exists('../Resources/gui/index.html'): # frozen py2app
        return '../Resources/gui/index.html'
    if os.path.exists('./gui/index.html'):
        return './gui/index.html'
    raise Exception('No index.html found')


# Change this to True on development environment
IS_DEBUG = True


# Variables for local app
windowObj = None
homeEntry = 'http://localhost:3000' if IS_DEBUG else get_home_entry()


# Variables for server conmunication
userToken = ''
API_HOST = 'http://localhost:8080' if IS_DEBUG else 'https://oysape.aifetel.cc'
API_ROOT = '/oyapi'

