#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys, signal, argparse
from helpers import server, console, consts, obhs, tools, auth, scheduler, apis

def sig_handler(signum, frame):
    raise SystemExit()

if __name__ == '__main__':
    version = '2.5.22'
    parser = argparse.ArgumentParser(description="Oysape Webhost Entry Point")
    parser.add_argument('--debug', type=bool, help="Debug mode", default=False)
    parser.add_argument('--port', type=int, help="Port", default=19790)
    args = parser.parse_args()

    consts.initVariants(args.debug, version)

    signal.signal(signal.SIGTERM, sig_handler)
    if sys.argv and sys.argv[0] == 'src/www.py':
        # run in interactive mode
        server.start_http_server('0.0.0.0', int(args.port or 19790))
        console.embed()
    else:
        # run in server mode
        server.open_http_server('0.0.0.0', int(args.port or 19790))
    print('Bye.')
