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

def send_get_request(url, data):
    print('GET', url)
    try:
        data_encoded = urllib.parse.urlencode(data)
        context = ssl._create_unverified_context()
        request = urllib.request.Request(url+'?'+data_encoded, method='GET')
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
            # print(response_text, type(response_text))
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

def callServerApiGet(url, params):
    data = send_get_request(consts.API_HOST + consts.API_ROOT + url, params)
    return data

def callServerApiPost(url, params):
    custom_headers = {'Content-Type': 'application/json'}
    if consts.userToken:
        custom_headers['Authorization'] = 'Bearer ' + consts.userToken
    data = send_post_request(consts.API_HOST + consts.API_ROOT + url, params, custom_headers)
    return data

def callServerApiDelete(url, params):
    custom_headers = {'Content-Type': 'application/json'}
    if consts.userToken:
        custom_headers['Authorization'] = 'Bearer ' + consts.userToken
    data = send_delete_request(consts.API_HOST + consts.API_ROOT + url, params, custom_headers)
    return data

def setItemsToServer(what, items):
    return callServerApiPost('/user/'+what, {what: items})

def delItemOnServer(what, itemKey):
    return callServerApiDelete('/user/'+what, {'key': itemKey})

def switchToTeam(tid):
    return callServerApiPost('/user/team', {'tid': tid})

def getOneTimeCode():
    return callServerApiPost('/user/landing', {})

# send_get_request('http://localhost:8080/oyapi/user/test', {'c': 'test@localhost'})
# send_post_request('http://localhost:8080/oyapi/user/test', {'c': 'test@localhost'})
