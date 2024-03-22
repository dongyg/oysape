#!/usr/bin/env python
# -*- coding: utf-8 -*-

import webview

from helpers import consts, apis, oauth

if __name__ == '__main__':
    oauth.start_http_server()
    consts.windowObj = apis.loadEntrypointWindow()
    print(webview.token)
    # Give private_mode=False to save cookies persistently
    webview.start(apis.mainloop, consts.windowObj, debug=consts.IS_DEBUG, private_mode=False, user_agent='Oysape/0.1.0')
    print('Bye.')
