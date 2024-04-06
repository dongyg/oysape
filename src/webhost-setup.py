#!/usr/bin/env python
# -*- coding: utf-8 -*-

import argparse
import random
import string
import re

def modify_index_html(address):
    pattern = re.compile(r'<script>window.OYSAPE_BACKEND_HOST = ".*?"</script>')
    with open('./gui/index.html', 'r', encoding='utf-8') as file:
        content = file.read()
    replacement_script = f'<script>window.OYSAPE_BACKEND_HOST = "{address}"</script>'
    content = re.sub(pattern, replacement_script, content)
    with open('./gui/index.html', 'w', encoding='utf-8') as file:
        file.write(content)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Setup script for modifying project files.")
    parser.add_argument('--obh', type=str, help="The actual web host address")

    args = parser.parse_args()

    modify_index_html(args.obh)
