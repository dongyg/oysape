#!/usr/bin/env python
# -*- coding: utf-8 -*-

from helpers import server, consts, apis, console

import eel

if __name__ == '__main__':
    eel.init('gui')
    eel.start('index.html', host='127.0.0.1', port=19790, app=server.app)
