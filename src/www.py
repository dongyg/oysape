#!/usr/bin/env python
# -*- coding: utf-8 -*-

import webview

from helpers import server, console, apis

if __name__ == '__main__':
    server.start_http_server('0.0.0.0')
    console.embed()
    print('Bye.')
