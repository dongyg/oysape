#!/usr/bin/env python
# -*- coding: utf-8 -*-

import hashlib, traceback, json, random, re
import urllib.request
import urllib.parse
import ssl
import sqlite3
from . import consts

def getRandomString(size=8):
    import string
    return ''.join(random.choice(string.ascii_letters+string.digits) for i in range(size))

def getRandomLowers(size=8):
    import string
    return ''.join(random.choice(string.ascii_lowercase+string.digits) for i in range(size))

def intget(integer, default=None):
    """
    Returns `integer` as an int or `default` if it can't.

        >>> intget('3')
        3
        >>> intget('3a')
        >>> intget('3a', 0)
        0
    """
    try:
        return int(integer)
    except (TypeError, ValueError):
        return default

def n10to62(value):
    stc = '0123456789abcdefghigklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    length = len(stc)
    retval = ''
    intp, remp = divmod(value,length)
    while intp>0:
        retval = stc[remp]+retval
        intp, remp = divmod(intp,length)
    retval = stc[remp]+retval
    return retval

def n62to10(value):
    stc = '0123456789abcdefghigklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    length = len(stc)
    retval = 0
    for x in range(len(value)):
        retval = retval+stc.find(value[x])*length**(len(value)-x-1)
    return retval

def n16to62(value):
    return n10to62(int(value, 16))

def get_sha256(string1):
    return hashlib.sha256((string1 or "").encode('utf8')).hexdigest()

def convert_bytes(size):
    # 1 KB = 1024 B
    # 1 MB = 1024 KB
    # 1 GB = 1024 MB
    units = ["B", "KB", "MB", "GB"]
    unit_index = 0
    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1
    size = round(size, 2)
    return '%d %s'%(int(size), units[unit_index])

def get_key(text):
    return n16to62(hashlib.md5(text.encode('utf-8')).hexdigest())

def colorizeText(text, fore=None, back=None):
    backgrounds = {
        'gray': '\x1b[40m%s\x1b[0m',  # background
        'red': '\x1b[41m%s\x1b[0m',  # background
        'green': '\x1b[42m%s\x1b[0m',  # background
        'yellow': '\x1b[43m%s\x1b[0m',  # background
        'blue': '\x1b[44m%s\x1b[0m',  # background
        'purple': '\x1b[45m%s\x1b[0m',  # background
        'cyan': '\x1b[46m%s\x1b[0m',  # background
        'white': '\x1b[47m%s\x1b[0m',  # background
    }
    foregrounds = {
        'red': '\x1b[31m%s\x1b[0m',  # text
        'green': '\x1b[32m%s\x1b[0m',  # text
        'yellow': '\x1b[33m%s\x1b[0m',  # text
        'blue': '\x1b[34m%s\x1b[0m',  # text
        'purple': '\x1b[35m%s\x1b[0m',  # text
        'cyan': '\x1b[36m%s\x1b[0m',  # text
        'white': '\x1b[37m%s\x1b[0m',  # text
    }
    if fore and fore in foregrounds:
        text = foregrounds[fore]%text
    if back and back in backgrounds:
        text = backgrounds[back]%text
    return text

def decolorizeText(text):
    ansi_escape = re.compile(r'\x1b\[[0-9;]+m')
    return ansi_escape.sub('', text)

def rate_limit(kvobj, ip, limits={}):
    limits[1] = 2 if not limits.get(1) else limits.get(1)
    limits[5] = 10 if not limits.get(5) else limits.get(5)
    limits[60] = 15 if not limits.get(60) else limits.get(60)
    limits[900] = 25 if not limits.get(900) else limits.get(900)
    limits[3600] = 30 if not limits.get(3600) else limits.get(3600)
    limits[86400] = 60 if not limits.get(86400) else limits.get(86400)
    for period, max_requests in limits.items():
        key = f"{ip}:{period}"
        requests = kvobj.get(key)
        if requests is None or int(requests) < max_requests:
            # 更新计数器
            kvobj[key] = str(int(kvobj.get(key, 0)) + 1)
            return True
        else:
            return False

def getDatetimeStrFromTimestamp(t=None):
    # timestamp to yyyy-mm-dd hh:mm:ss
    import time
    retval = int(t) if t else int(time.time())
    if str(retval).isdigit():
        try:
            retval = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(float(retval)))
        except Exception as e:
            pass
    return retval


################################################################################
def get_custom_user_agent(version='3.9.22'):
    import platform
    system = platform.system()
    release = platform.release()
    machine = platform.machine()
    if system == "Darwin":
        os_name = f"Macintosh; Intel Mac OS X {release.replace('.', '_')}; {machine}"
    elif system == "Windows":
        os_name = f"Windows NT {release}; {machine}"
    elif system == "Linux":
        # 在 VMware 中运行的 Ubuntu 64-bit Arm 22.04.3 中, User Agent 存在问题, 会造成 CodeiumEditor 无法鼠标点任意地方. 并且发现是 () 中的操作系统信息部分影响 CodeiumEditor
        # Firefox   得到的是 Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0  试了不行
        # pywebview 得到的是 Mozilla/5.0 (X11; Ubuntu; Linux aarch64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15  试了不行
        # os_name = f"Linux {release}; {machine}"  试了不行
        # 使用与 Windows 相同的 os_name 生成方法  试了不行
        # 写死 (Windows NT 10; AMD64) 试了不行. 但是 VMware 中运行的 Windows 系统就是这个. 里面运行时 CodeiumEditor 是正常的
        # 使用与 Darwin 相同的操作系统信息就可以. 但是这样的话 CodeiumEditor 的 Command Palette 的快捷键就不是 Ctrl 而是 Command 了, 一些快捷键会无法匹配
        os_name = f"Macintosh; Intel Mac OS X {release.replace('.', '_')}; {machine}"
    else:
        os_name = f"{system} {release}; {machine}"
    user_agent = f"Mozilla/5.0 ({os_name}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OysapeDesktop/{version}"
    return user_agent


################################################################################
def send_get_request(url, data, headers=None):
    if consts.IS_DEBUG: print('GET', url)
    try:
        data_encoded = urllib.parse.urlencode(data)
        headers = headers if headers else {}
        headers['Content-Type'] = 'application/json'
        context = ssl._create_unverified_context()
        request = urllib.request.Request(url+'?'+data_encoded, headers=headers, method='GET')
        with urllib.request.urlopen(request, context=context, timeout=10) as response:
            response_data = response.read()
            response_text = response_data.decode('utf-8')
            if consts.IS_DEBUG: print(response_text, type(response_text))
            json_data = json.loads(response_text)
            return json_data
    except:
        traceback.print_exc()
        return None

def send_post_request(url, data, headers=None):
    if consts.IS_DEBUG: print('POST',url)
    try:
        json_data = json.dumps(data).encode('utf-8')
        headers = headers if headers else {}
        headers['Content-Type'] = 'application/json'
        context = ssl._create_unverified_context()
        request = urllib.request.Request(url, data=json_data, headers=headers, method='POST')
        with urllib.request.urlopen(request, context=context, timeout=10) as response:
            response_data = response.read()
            response_text = response_data.decode('utf-8')
            # if consts.IS_DEBUG: print(response_text, type(response_text))
            json_data = json.loads(response_text)
            return json_data
    except:
        traceback.print_exc()
        return None

def send_delete_request(url, data, headers=None):
    if consts.IS_DEBUG: print('DELETE', url)
    try:
        data_encoded = urllib.parse.urlencode(data)
        headers = headers if headers else {}
        headers['Content-Type'] = 'application/json'
        context = ssl._create_unverified_context()
        request = urllib.request.Request(url+'?'+data_encoded, headers=headers, method='DELETE')
        with urllib.request.urlopen(request, context=context, timeout=10) as response:
            response_data = response.read()
            response_text = response_data.decode('utf-8')
            # if consts.IS_DEBUG: print(response_text, type(response_text))
            json_data = json.loads(response_text)
            return json_data
    except:
        traceback.print_exc()
        return None

def callServerApiGet(url, params, localApiObj=None):
    custom_headers = {}
    if localApiObj and localApiObj.userToken:
        custom_headers['Authorization'] = 'Bearer ' + localApiObj.userToken
    if localApiObj and localApiObj.clientUserAgent:
        custom_headers['User-Agent'] = localApiObj.clientUserAgent
    data = send_get_request(consts.OYSAPE_HOST + consts.API_ROOT + url, params, )
    return data

def callServerApiPost(url, params, localApiObj=None):
    custom_headers = {}
    if localApiObj and localApiObj.userToken:
        custom_headers['Authorization'] = 'Bearer ' + localApiObj.userToken
    if localApiObj and localApiObj.clientUserAgent:
        custom_headers['User-Agent'] = localApiObj.clientUserAgent
    data = send_post_request(consts.OYSAPE_HOST + consts.API_ROOT + url, params, custom_headers)
    return data

def callServerApiDelete(url, params, localApiObj=None):
    custom_headers = {}
    if localApiObj and localApiObj.userToken:
        custom_headers['Authorization'] = 'Bearer ' + localApiObj.userToken
    if localApiObj and localApiObj.clientUserAgent:
        custom_headers['User-Agent'] = localApiObj.clientUserAgent
    data = send_delete_request(consts.OYSAPE_HOST + consts.API_ROOT + url, params, custom_headers)
    return data


class SQLiteDB:
    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()

    def query(self, query, params=None):
        if params is None:
            self.cursor.execute(query)
        else:
            self.cursor.execute(query, params)
        return [dict(row) for row in self.cursor.fetchall()]

    def insert(self, query, params):
        self.cursor.execute(query, params)
        self.conn.commit()
        return self.cursor.lastrowid

    def update(self, query, params):
        self.cursor.execute(query, params)
        self.conn.commit()
        return self.cursor.rowcount

    def delete(self, query, params):
        self.cursor.execute(query, params)
        self.conn.commit()
        return self.cursor.rowcount

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cursor.close()
        self.conn.close()
