#!/usr/bin/env python
# -*- coding: utf-8 -*-

import hashlib, traceback, json, random
import urllib.request
import urllib.parse
import ssl
from . import consts

def getRandomString(size=8):
    import string
    return ''.join(random.choice(string.ascii_letters+string.digits) for i in range(size))

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


################################################################################
def send_get_request(url, data, headers=None):
    print('GET', url)
    try:
        data_encoded = urllib.parse.urlencode(data)
        headers = headers if headers else {}
        headers['Content-Type'] = 'application/json'
        context = ssl._create_unverified_context()
        request = urllib.request.Request(url+'?'+data_encoded, headers=headers, method='GET')
        with urllib.request.urlopen(request, context=context) as response:
            response_data = response.read()
            response_text = response_data.decode('utf-8')
            # print(response_text, type(response_text))
            json_data = json.loads(response_text)
            return json_data
    except:
        traceback.print_exc()
        return None

def send_post_request(url, data, headers=None):
    print('POST',url)
    try:
        json_data = json.dumps(data).encode('utf-8')
        headers = headers if headers else {}
        headers['Content-Type'] = 'application/json'
        context = ssl._create_unverified_context()
        request = urllib.request.Request(url, data=json_data, headers=headers, method='POST')
        with urllib.request.urlopen(request, context=context) as response:
            response_data = response.read()
            response_text = response_data.decode('utf-8')
            json_data = json.loads(response_text)
            return json_data
    except:
        traceback.print_exc()
        return None

def send_delete_request(url, data, headers=None):
    print('DELETE', url)
    try:
        data_encoded = urllib.parse.urlencode(data)
        headers = headers if headers else {}
        headers['Content-Type'] = 'application/json'
        context = ssl._create_unverified_context()
        request = urllib.request.Request(url+'?'+data_encoded, headers=headers, method='DELETE')
        with urllib.request.urlopen(request, context=context) as response:
            response_data = response.read()
            response_text = response_data.decode('utf-8')
            # print(response_text, type(response_text))
            json_data = json.loads(response_text)
            return json_data
    except:
        traceback.print_exc()
        return None

def callServerApiGet(url, params, token=''):
    custom_headers = {}
    if token:
        custom_headers['Authorization'] = 'Bearer ' + token
    data = send_get_request(consts.OYSAPE_HOST + consts.API_ROOT + url, params, )
    return data

def callServerApiPost(url, params, token=''):
    custom_headers = {}
    if token:
        custom_headers['Authorization'] = 'Bearer ' + token
    data = send_post_request(consts.OYSAPE_HOST + consts.API_ROOT + url, params, custom_headers)
    return data

def callServerApiDelete(url, params, token=''):
    custom_headers = {}
    if token:
        custom_headers['Authorization'] = 'Bearer ' + token
    data = send_delete_request(consts.OYSAPE_HOST + consts.API_ROOT + url, params, custom_headers)
    return data

def setItemsToServer(what, items, token=''):
    return callServerApiPost('/user/'+what, {what: items}, token)

def delItemOnServer(what, itemKey, token=''):
    return callServerApiDelete('/user/'+what, {'key': itemKey}, token)

def switchToTeam(tid, token=''):
    return callServerApiPost('/user/team', {'tid': tid}, token)

def getOneTimeCode(token=''):
    return callServerApiPost('/user/landing', {}, token)

# send_get_request('http://localhost:8080/oyapi/user/test', {'c': 'test@localhost'})
# send_post_request('http://localhost:8080/oyapi/user/test', {'c': 'test@localhost'})
