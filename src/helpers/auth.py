#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os, socket, hashlib, hmac, json
import webbrowser
from . import obhs, tools, consts

def signForWebhost(serverHome, value):
    webhost_config = os.getenv('WEBHOST_CONFIG')
    if webhost_config and len(webhost_config.split('@'))==2:
        v1, v2 = webhost_config.split('@')
        obhs.keys[v2] = v1
    secret_key = obhs.keys.get(serverHome)
    if not secret_key:
        return {'errinfo': 'Cannot find the oysape backend host configuration. %s'%serverHome}
    hmac_result = hmac.new(secret_key.encode('utf-8'), value.encode('utf-8'), hashlib.sha256)
    return hmac_result.hexdigest()

def getSignInState(clientId, userAgent, serverHome):
    # Get the secret key for this OYSAPE_BACKEND_HOST from configuration. For desktop version, the secret key is presaved.
    # Then calulate HMAC signature with this secret key
    clientInfo = {'cid': clientId, 'ua': userAgent, 'obh': (serverHome or ''), 'nonce': tools.getRandomString()}
    clientInfo['sig'] = signForWebhost(serverHome, json.dumps(clientInfo, sort_keys=True))
    retval = tools.callServerApiPost('/signin/getready', clientInfo)
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
        return 'https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/userinfo.email&response_type=code&client_id=752692102612-2ii66sjn45ndd7tmou1i9cosjlupqa99.apps.googleusercontent.com&redirect_uri=https://oysape.aifetel.cc/oyapi/callback/google&state=%s'

def openOAuthWindow(oauthAgent, clientId, userAgent, serverHome):
    # oauthAgent: 'github' or 'email' or 'google'
    retval = {'clientId': clientId}
    isDesktopVersion = (userAgent.find('OysapeDesktop') >= 0)
    sdata = getSignInState(clientId, ((socket.gethostname()+' '+userAgent) if isDesktopVersion else userAgent), serverHome)
    if sdata and sdata.get('errinfo'):
        retval['errinfo'] = sdata.get('errinfo')
    elif sdata and sdata.get('state'):
        aurl = getOAuthUrl(oauthAgent)%sdata.get('state')
        if isDesktopVersion:
            webbrowser.open_new(aurl)
        else:
            retval['url'] = aurl
    return retval

def openAccountDashboard(otp, userAgent, serverHome):
    landing_url = consts.OYSAPE_HOST + consts.API_ROOT + '/user/landing?s=%s'%otp
    isDesktopVersion = (userAgent.find('OysapeDesktop') >= 0)
    if isDesktopVersion:
        webbrowser.open_new(landing_url)
        return {}
    else:
        return {'url': landing_url}
