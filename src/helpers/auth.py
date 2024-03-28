#!/usr/bin/env python
# -*- coding: utf-8 -*-

import socket, hashlib, hmac, json
import webbrowser
from . import tools, consts, webhost


def getSignInState(clientId, userAgent, serverHome):
    # In web version, get the secret key for this OYSAPE_BACKEND_HOST from configuration.
    # Then calulate HMAC signature with this secret key
    pdata = {'cid': clientId, 'ua': (userAgent or socket.gethostname()), 'srh': (serverHome or ''), 'nonce': tools.getRandomString()}
    isDesktopVersion = (userAgent.find('Oysape') >= 0 and serverHome.find('127.0.0.1') >= 0)
    if not isDesktopVersion:
        secret_key = webhost.keys.get(serverHome)
        if not secret_key:
            return {'errinfo': 'Cannot find the web host configuration. %s'%serverHome}
        hmac_result = hmac.new(secret_key.encode('utf-8'), json.dumps(pdata, sort_keys=True).encode('utf-8'), hashlib.sha256)
        pdata['sig'] = hmac_result.hexdigest()
    retval = tools.callServerApiPost('/signin/getready', pdata)
    if retval and retval.get('state'):
        return {'state': retval.get('state')}
    elif retval and retval.get('errinfo'):
        return retval
    return {'errinfo': 'Cannot generate state code.'}

def getOAuthUrl(oauthAgent):
    if oauthAgent == 'email':
        return consts.OYSAPE_HOST + '/email-oauth?state=%s'
    elif oauthAgent == 'github':
        return 'https://github.com/login/oauth/authorize?scope=user:email&client_id=6d627d92ce5a51cda1b1&state=%s'
    elif oauthAgent == 'google':
        return 'https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/userinfo.email&response_type=code&client_id=6950b9c8e7b0c6b&redirect_uri=https://oysape.aifetel.cc/callback/google&state=%s'

def openOAuthWindow(oauthAgent, clientId, userAgent, serverHome):
    # oauthAgent: 'github' or 'email' or 'google'
    retval = {'clientId': clientId}
    isDesktopVersion = (userAgent.find('Oysape') >= 0 and serverHome.find('127.0.0.1') >= 0)
    sdata = getSignInState(clientId, ('' if isDesktopVersion else userAgent), serverHome)
    if sdata and sdata.get('errinfo'):
        retval['errinfo'] = sdata.get('errinfo')
    elif sdata and sdata.get('state'):
        aurl = getOAuthUrl(oauthAgent)%sdata.get('state')
        if isDesktopVersion:
            webbrowser.open_new(aurl)
        else:
            retval['url'] = aurl
    return retval

def openAccountDashboard(otp):
    landing_url = consts.OYSAPE_HOST + consts.API_ROOT + '/user/landing?s=%s'%otp
    webbrowser.open_new(landing_url)
