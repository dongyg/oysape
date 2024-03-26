#!/usr/bin/env python
# -*- coding: utf-8 -*-

import socket
import webbrowser
from . import tools, consts


def getSignInState(clientId):
    cid = clientId+'@'+socket.gethostname()
    retval = tools.callServerApiGet('/user/signin', {'c': cid})
    if retval and retval.get('state'):
        return retval.get('state')
    else:
        return tools.getRandomString(16)

def openEmailOAuthWindow(clientId, userAgent):
    # Open a new system browser window to show sign in page
    email_oauth_url = consts.API_HOST + '/email-oauth?state=%s'%getSignInState(clientId)
    retval = {'clientId': clientId}
    if userAgent.find('Oysape') >= 0:
        webbrowser.open_new(email_oauth_url)
    else:
        retval['url'] = email_oauth_url
    return retval

def openGithubOAuthWindow(clientId, userAgent):
    # Open a new system browser window to show sign in page
    github_oauth_url = 'https://github.com/login/oauth/authorize?scope=user:email&client_id=6d627d92ce5a51cda1b1&state=%s'%getSignInState(clientId)
    retval = {'clientId': clientId}
    if userAgent.find('Oysape') >= 0:
        webbrowser.open_new(github_oauth_url)
    else:
        retval['url'] = github_oauth_url
    return retval

def openGoogleOAuthWindow(clientId, userAgent):
    # Open a new system browser window to show sign in page
    google_oauth_url = 'https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/userinfo.email&response_type=code&client_id=6950b9c8e7b0c6b&redirect_uri=https://oysape.aifetel.cc/callback/google&state=%s'%getSignInState(clientId)
    retval = {'clientId': clientId}
    if userAgent.find('Oysape') >= 0:
        webbrowser.open_new(google_oauth_url)
    else:
        retval['url'] = google_oauth_url
    return retval

def openAccountDashboard(otp):
    landing_url = consts.API_HOST + consts.API_ROOT + '/user/landing?s=%s'%otp
    webbrowser.open_new(landing_url)
