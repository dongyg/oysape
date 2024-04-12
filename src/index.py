#!/usr/bin/env python
# -*- coding: utf-8 -*-

import webview
from helpers import server, consts, apis

if __name__ == '__main__':
    server.start_http_server()
    apis.apiInstances[webview.token] = apis.ApiDesktop(clientId=webview.token, clientUserAgent='OysapeDesktop/2024.0411.2')
    windowObj = apis.loadEntrypointWindow(apiObject=apis.apiInstances[webview.token])
    # Give private_mode=False to save cookies persistently
    webview.start(apis.mainloop, windowObj, debug=consts.IS_DEBUG, private_mode=False, user_agent='OysapeDesktop/2024.0411.2')
    print('Bye.')
