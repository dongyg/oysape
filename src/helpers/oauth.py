#!/usr/bin/env python
# -*- coding: utf-8 -*-

import threading, getpass, socket, traceback, os
import webbrowser
from datetime import datetime, timedelta
from bottle import Bottle, run, request, response, static_file
from jinja2 import Template
from . import tools
from . import consts
from .templs import *

app = Bottle()

@app.route('/static/<filename:path>')
def serve_static(filename):
    aroot = './public'
    if os.path.exists('./public'):
        aroot = './public'
    elif os.path.exists('./gui'):
        aroot = './gui'
    elif os.path.exists('./../Resources/gui'):
        aroot = './../Resources/gui'
    elif os.path.exists('./../gui'):
        aroot = './../gui'
    return static_file(filename, root=aroot)

@app.route('/entrypoint')
def appEntrypoint():
    # token = request.get_cookie('token')
    rendered_template = Template(template_entrypoint).render()
    return rendered_template

@app.route('/debug')
def pageDebug():
    return Template(template_signin_success).render()

@app.route('/signin')
def signin():
    cid = getpass.getuser()+'@'+socket.gethostname()
    retval = tools.callServerApiGet('/user/signin', {'c': cid})
    params = {
        'title': 'Oysape - Sign in',
        'showGithubSignin': False,
        'showGoogleSignin': False,
        'errinfo': '',
    }
    if not retval:
        params['errinfo'] = 'Network error. Please try again later.'
        params['showTryAgain'] = True
    elif retval.get('errinfo'):
        params['errinfo'] = retval.get('errinfo')
    elif retval.get('state'):
        params['showGithubSignin'] = True
        params['showGoogleSignin'] = True
        params['state'] = retval.get('state')
    rendered_template = Template(template_signin_page).render(**params)
    return rendered_template

@app.route('/callback/github')
def githubOauthCallback():
    code = request.query.get('code')
    state = request.query.get('state')
    cid = getpass.getuser()+'@'+socket.gethostname()
    # Send the code to backend to finish the OAuth process and finish the sign in/sign up process
    retval = tools.callServerApiPost('/user/signin', {'c': cid, 'code': code, 'state': state})
    print(retval)
    if retval and retval.get('errcode')==0 and retval.get('data') and retval.get('data').get('token'):
        # Write token to build-in webview window
        expires_time = datetime.utcnow() + timedelta(seconds=3600*24*30)
        consts.windowObj.evaluate_js('document.cookie = "token=%s; expires=%s; path=/";'%(retval.get('data').get('token'), expires_time.strftime("%a, %d %b %Y %H:%M:%S UTC")))
        consts.windowObj.load_url(consts.homeEntry)
        # Return the success page
        rendered_template = Template(template_signin_success).render()
        return rendered_template
    elif retval and retval.get('errinfo'):
        return retval.get('errinfo')
    else:
        return 'Unknown error. Please try again later.'

@app.route('/set_cookie')
def set_cookie():
    # 设置 cookie
    response.set_cookie('user_id', '12345', path='/', max_age=3600)
    response.set_cookie('username', 'john_doe', path='/', max_age=3600)
    return "Cookie set successfully!"

@app.route('/get_cookie')
def get_cookie():
    # 获取 cookie
    user_id = request.get_cookie('user_id')
    username = request.get_cookie('username')
    if user_id and username:
        return f"User ID: {user_id}, Username: {username}"
    else:
        return "Cookie not found!"

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

def openGithubOAuthWindow(state):
    # Open a new system browser window to show sign in page
    github_oauth_url = 'https://github.com/login/oauth/authorize?scope=user:email&client_id=6d627d92ce5a51cda1b1&state=%s'%state
    webbrowser.open_new(github_oauth_url)

def openGoogleOAuthWindow(state):
    # Open a new system browser window to show sign in page
    google_oauth_url = 'https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/userinfo.email&response_type=code&client_id=6950b9c8e7b0c6b&state=%s'%state
    webbrowser.open_new(google_oauth_url)
