#!/usr/bin/env python
# -*- coding: utf-8 -*-

__all__ = [
    'IS_DEBUG', 'windowObj', 'homeEntry', 'userToken', 'API_HOST', 'API_ROOT',
]

import os

def get_home_entry():
    if os.path.exists(os.path.realpath('../gui/index.html')):
        return os.path.realpath('../gui/index.html')
    if os.path.exists(os.path.realpath('../Resources/gui/index.html')):
        return os.path.realpath('../Resources/gui/index.html')
    if os.path.exists(os.path.realpath('./gui/index.html')):
        return os.path.realpath('./gui/index.html')
    raise Exception('No index.html found')


# Change this to True on development environment
IS_DEBUG = False


# Variables for local app
windowObj = None
homeEntry = 'http://localhost:3000' if IS_DEBUG else get_home_entry()

print(homeEntry)

# Variables for server conmunication
userToken = ''
API_HOST = 'http://localhost:8080' if IS_DEBUG else 'https://oysape.aifetel.cc'
API_ROOT = '/oyapi'

