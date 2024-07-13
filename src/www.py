#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys, signal, argparse
import webview
from helpers import server, console, consts, obhs, tools, auth, scheduler, apis

def sig_handler(signum, frame):
    raise SystemExit()

if __name__ == '__main__':
    version = '3.7.12'
    parser = argparse.ArgumentParser(description="Oysape Webhost Entry Point")
    parser.add_argument('--debug', type=bool, help="Debug mode", default=False)
    parser.add_argument('--port', type=int, help="Port", default=19790)
    parser.add_argument('--cid', type=str, help="Client Id", default=webview.token)
    args = parser.parse_args()

    consts.initVariants(args.debug, version)
    if args.cid != webview.token: webview.token = args.cid
    if consts.IS_DEBUG: print(webview.token)

    signal.signal(signal.SIGTERM, sig_handler)
    if sys.argv and sys.argv[0].find('src/www.py')>=0:
        # run in interactive mode
        server.start_http_server('0.0.0.0', int(args.port or 19790))
        console.embed()
    else:
        # run in server mode
        server.open_http_server('0.0.0.0', int(args.port or 19790))
    print('Bye.')
