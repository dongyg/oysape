#!/usr/bin/env python
# -*- coding: utf-8 -*-

import argparse, logging
import webview
from helpers import server, consts, apis

# HTML 内容作为字符串
html_content = """
<!DOCTYPE html>
<html>
<head>
    <title>Oysape</title>
</head>
<body>
    <div width="100%" height="100%" style="display: flex; align-items: center; justify-content: center;"><h1>Failed to start websocket server.</h1></div>
</body>
</html>
"""

def initialize_app():
    version = '3.8.12'
    # os_info = distro.name(pretty=True) if platform.system() == 'Linux' else platform.platform()
    # Give a user agent including OysapeDesktop, so that the SignIn.jsx in React JS can indicate this is a desktop version.
    # Otherwise, the SignIn.jsx in React JS will execute reloadUserSession because it is not a desktop version as the beginning.
    clientAgent = f'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OysapeDesktop/{version}'
    # clientAgent = f'{os_info} OysapeDesktop/{version}'

    parser = argparse.ArgumentParser(description="Oysape Desktop Entry Point")
    parser.add_argument('--debug', type=bool, help="Debug mode", default=False)
    args = parser.parse_args()

    consts.initVariants(args.debug, version)

    apis.apiInstances[webview.token] = apis.ApiDesktop(clientId=webview.token, clientUserAgent=clientAgent)
    if server.start_http_server():
        windowObj = apis.loadEntrypointWindow(apiObject=apis.apiInstances[webview.token])
        # Give private_mode=False to save cookies persistently
        webview.start(apis.mainloop, windowObj, debug=consts.IS_DEBUG, private_mode=False, user_agent=clientAgent)
    else:
        print("Failed to start websocket server.")
        logging.error("Failed to start websocket server.")
        webview.create_window('Oysape'+(' - Debug' if consts.IS_DEBUG else ''), html=html_content, width=800, height=600, confirm_close=False)
        webview.start()

    print('Bye.')


if __name__ == '__main__':
    initialize_app()
