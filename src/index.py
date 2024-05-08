#!/usr/bin/env python
# -*- coding: utf-8 -*-

import argparse, platform, distro, logging
import webview
from helpers import server, consts, apis

def initialize_app():
    version = '2024.0507.1'
    os_info = distro.name(pretty=True) if platform.system() == 'Linux' else platform.platform()
    clientAgent = f'{os_info} OysapeDesktop/{version}'

    parser = argparse.ArgumentParser(description="Oysape Desktop Entry Point")
    parser.add_argument('--debug', type=bool, help="Debug mode", default=False)
    args = parser.parse_args()

    consts.initVariants(args.debug, version)

    if server.start_http_server():
        apis.apiInstances[webview.token] = apis.ApiDesktop(clientId=webview.token, clientUserAgent=clientAgent)
        windowObj = apis.loadEntrypointWindow(apiObject=apis.apiInstances[webview.token])
        # Give private_mode=False to save cookies persistently
        webview.start(apis.mainloop, windowObj, debug=consts.IS_DEBUG, private_mode=False, user_agent=clientAgent)
        print('Bye.')
    else:
        logging.error("Failed to start websocket server.")


if __name__ == '__main__':
    initialize_app()
