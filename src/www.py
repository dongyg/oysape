#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys, signal
from helpers import server, console, apis

def sig_handler(signum, frame):
    raise SystemExit()

if __name__ == '__main__':
    signal.signal(signal.SIGTERM, sig_handler)
    if sys.argv and sys.argv[0] == 'src/www.py':
        # run in interactive mode
        server.start_http_server('0.0.0.0', len(sys.argv) > 1 and int(sys.argv[1]) or 19790)
        console.embed()
    else:
        # run in server mode
        server.open_http_server('0.0.0.0', len(sys.argv) > 1 and int(sys.argv[1]) or 19790)
    print('Bye.')
