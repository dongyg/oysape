#!/usr/bin/env python
# -*- coding: utf-8 -*-

import threading, getpass, socket, traceback, os, datetime
import webbrowser
from bottle import Bottle, run, request, response, static_file
from jinja2 import Template
from . import tools, apis, consts
from .templs import *

app = Bottle()

def processSigninResponse(retval):
    if retval and retval.get('data') and retval.get('data').get('token'):
        # Write token to build-in webview window
        expires_time = datetime.datetime.now(datetime.UTC) + datetime.timedelta(seconds=3600*24*30)
        consts.windowObj.evaluate_js('document.cookie = "token=%s; expires=%s; path=/";'%(retval.get('data').get('token'), expires_time.strftime("%a, %d %b %Y %H:%M:%S UTC")))
        consts.userToken = retval.get('data').get('token')
        # consts.windowObj.load_url(consts.homeEntry) # It will show the loading icon again if this line is uncommented
        apis.apiInstance.reloadUserSession()
        # Return the success page
        rendered_template = Template(template_signin_success).render()
        return rendered_template
    elif retval and retval.get('errinfo'):
        return retval.get('errinfo')
    else:
        return 'Unknown error. Please try again later.'

@app.route('/callback/github')
def githubOauthCallback():
    code = request.query.get('code')
    state = request.query.get('state')
    cid = getpass.getuser()+'@'+socket.gethostname()
    # Send the code to backend to finish the OAuth process and finish the sign in/sign up process
    retval = tools.callServerApiPost('/signin/github', {'c': cid, 'code': code, 'state': state})
    return processSigninResponse(retval)

@app.route('/callback/email')
def githubOauthCallback():
    code = request.query.get('code')
    state = request.query.get('state')
    # Send the code to backend to get the token
    cid = getpass.getuser()+'@'+socket.gethostname()
    retval = tools.callServerApiPost('/signin/email', {'c': cid, 'code': code, 'state': state})
    return processSigninResponse(retval)

@app.route('/<filename:path>')
def serve_static(filename):
    aroot = './public'
    if os.path.exists('./gui'):
        aroot = './gui'
    elif os.path.exists('./../Resources/gui'):
        aroot = './../Resources/gui'
    elif os.path.exists('./../gui'):
        aroot = './../gui'
    elif os.path.exists('./public'):
        aroot = './public'
    return static_file(filename, root=aroot)


def open_http_server():
    run(app, host='127.0.0.1', port=19790)

def start_http_server():
    try:
        # Start a thread with the server
        http_server_thread = threading.Thread(target=open_http_server)
        http_server_thread.daemon = True  # Set as a daemon thread
        http_server_thread.start()
    except:
        traceback.print_exc()

def getSignInState():
    cid = getpass.getuser()+'@'+socket.gethostname()
    retval = tools.callServerApiGet('/user/signin', {'c': cid})
    if retval and retval.get('state'):
        return retval.get('state')
    else:
        return tools.getRandomString(16)

def openEmailOAuthWindow():
    # Open a new system browser window to show sign in page
    email_oauth_url = consts.API_HOST + '/email-oauth?state=%s'%getSignInState()
    webbrowser.open_new(email_oauth_url)

def openGithubOAuthWindow():
    # Open a new system browser window to show sign in page
    github_oauth_url = 'https://github.com/login/oauth/authorize?scope=user:email&client_id=6d627d92ce5a51cda1b1&state=%s'%getSignInState()
    webbrowser.open_new(github_oauth_url)

def openGoogleOAuthWindow():
    # Open a new system browser window to show sign in page
    google_oauth_url = 'https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/userinfo.email&response_type=code&client_id=6950b9c8e7b0c6b&redirect_uri=https://oysape.aifetel.cc/callback/google&state=%s'%getSignInState()
    webbrowser.open_new(google_oauth_url)

def openAccountDashboard(otp):
    landing_url = consts.API_HOST + consts.API_ROOT + '/user/landing?s=%s'%otp
    webbrowser.open_new(landing_url)
