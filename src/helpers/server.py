#!/usr/bin/env python
# -*- coding: utf-8 -*-

import threading, traceback, os, json, hashlib
from bottle import Bottle, request, static_file, abort, response, hook, redirect
from geventwebsocket import WebSocketError
from gevent.pywsgi import WSGIServer
from geventwebsocket.handler import WebSocketHandler
import webview
from . import tools, apis, consts
from .templs import template_signin_success_close, template_signin_success_redirect, template_signin_failed_close

KVStore = {}
app = Bottle()

@app.error(404)
def not_found(error):
    return 'Not found'

@app.error(405)
def not_allowed(error):
    return 'not found'

@app.route('/websocket')
def handle_websocket():
    wsock = request.environ.get('wsgi.websocket')
    if not wsock:
        abort(400, 'Expected WebSocket request.')
    try:
        uniqueKey = None
        clientId = ''
        while True:
            init_message = wsock.receive()
            if not init_message:
                break
            try:
                recvData = json.loads(init_message)
            except Exception as e:
                print('SocketError:', (request.headers.get('X-Forwarded-For') or request.remote_addr), init_message)
                break
            print(recvData)
            clientId = recvData.get('clientId')
            action = recvData.get('action')
            uniqueKey = recvData.get('uniqueKey')
            token = recvData.get('token')
            apiObject = apis.apiInstances.get(clientId) if clientId else None
            if apiObject and uniqueKey and token and token == apiObject.userToken:
                if action == 'init':
                    # print('Init socket', clientId, uniqueKey)
                    apiObject.socketConnections[uniqueKey] = wsock
                elif action == 'resize':
                    apiObject.resizeAllCombChannel(recvData) if uniqueKey == 'workspace' else apiObject.resizeTermChannel(recvData)
                elif action == 'ping':
                    pass
                else:
                    apiObject.sendCombinedInput(recvData) if uniqueKey == 'workspace' else apiObject.sendTerminalInput(recvData)
            else:
                break
    except WebSocketError:
        traceback.print_exc()
    finally:
        wsock.close()
        if clientId and clientId in apis.apiInstances:
            if uniqueKey in apis.apiInstances[clientId].socketConnections:
                # print('Close socket', clientId, uniqueKey)
                del apis.apiInstances[clientId].socketConnections[uniqueKey]
            if uniqueKey == 'workspace':
                # print('Close all terminals', 'workspace:', len(apis.apiInstances[clientId].terminalConnections), 'terminal:', len(apis.apiInstances[clientId].combinedConnections))
                apis.apiInstances[clientId].closeCombConnections()
                apis.apiInstances[clientId].closeAllTerminals()
                if clientId != webview.token:
                    print('Remove API object', clientId)
                    del apis.apiInstances[clientId]


def processSigninResponse(retval):
    # print(retval)
    #TODO: 如果有错误, 暂存起来, 让前端 querySigninResult 能够拿到
    # check clientId
    if not retval: return 'Something wrong'
    clientId = retval.get('clientId')
    if not clientId in apis.apiInstances: return 'Client not found'
    if retval.get('errinfo'):
        apis.apiInstances[clientId].signInMessage = retval.get('errinfo')
        return template_signin_failed_close.replace('{msg}', apis.apiInstances[clientId].signInMessage)
    if not retval.get('data'):
        apis.apiInstances[clientId].signInMessage = 'Invalid response'
        return template_signin_failed_close.replace('{msg}', apis.apiInstances[clientId].signInMessage)
    if not retval.get('data').get('token'):
        apis.apiInstances[clientId].signInMessage = 'Authentication failed'
        return template_signin_failed_close.replace('{msg}', apis.apiInstances[clientId].signInMessage)
    # Set the token to this client. The sign page will get the token and reload the user session
    apis.apiInstances[clientId].userToken = retval.get('data').get('token')
    apis.apiInstances[clientId].signInMessage = ''
    # Return the success page
    if apis.apiInstances[clientId].isDesktopVersion():
        # PS: Cannot save the token into the cookie here. Because the browser is the system default browser, not the webview inside the Oysape.
        rendered_template = template_signin_success_close
    else:
        # In the web version, can set the cookie here
        response.set_cookie("client_token", retval.get('data').get('token'), path="/", max_age=3600*24*30)
        rendered_template = template_signin_success_redirect.replace('{url}', apis.apiInstances[clientId].backendHost+'/index.html')
    return rendered_template

@app.route('/callback/oauth')
def githubOauthCallback():
    code = request.query.get('code')
    state = request.query.get('state')
    cid = request.query.get('cid')
    # Send the code to backend to finish the OAuth process and finish the sign in process. Get the token.
    retval = tools.callServerApiPost('/signin/finish', {'code': code, 'state': state, 'cid': cid})
    return processSigninResponse(retval)

@app.route('/<:re:.*>', method='OPTIONS')
def enable_cors_generic_route():
    """
    This route takes priority over all others. So any request with an OPTIONS
    method will be handled by this function.

    See: https://github.com/bottlepy/bottle/issues/402

    NOTE: This means we won't 404 any invalid path that is an OPTIONS request.
    """
    add_cors_headers()

@hook('after_request')
def enable_cors_after_request_hook():
    """
    This executes after every route. We use it to attach CORS headers when
    applicable.
    """
    if consts.IS_DEBUG:
        add_cors_headers()

def add_cors_headers():
    if consts.IS_DEBUG:
        response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token, Client-Id, Authorization'
        response.headers['Access-Control-Allow-Credentials'] = 'true'

@app.route('/api/<functionName>', method='POST')
def api(functionName):
    if consts.IS_DEBUG:
        add_cors_headers()
    data = request.json
    clientIpAddress = request.headers.get('X-Forwarded-For') or request.remote_addr
    authorization_header = (request.headers.get('Authorization') or '').replace('Bearer', '').strip()
    if functionName in ['signInWithEmail','signInWithGithub','signInWithGoogle']:
        # Request to sign in is limited. These 3 requests have no clientId in the headers
        # if not tools.rate_limit(KVStore, clientIpAddress, {1:1, 10:3, 60:6, 900:10, 3600:15, 86400:20}):
        #     return json.dumps({"errinfo": "Too many requests."})
        if request.headers.get('User-Agent').find('Oysape') >=0:
            # Use the pywebview token as the clientId. It should have a apiObject in apis.apiInstances
            clientId = webview.token
        else:
            # Generate a clientId, it should be different every time
            clientId = hashlib.md5((request.headers.get('User-Agent') + '@' + clientIpAddress + tools.getRandomString(64)).encode('utf-8')).hexdigest()
        if not clientId in apis.apiInstances:
            apis.apiInstances[clientId] = apis.ApiOverHttp(clientId=clientId, clientUserAgent=request.headers.get('User-Agent'))
        data['user-agent'] = request.headers.get('User-Agent')
    elif functionName in ['querySigninResult']:
        # Get the clientId from request headers, Use the correct api object
        clientId = request.headers.get('Client-Id')
    elif not authorization_header:
        return json.dumps({"errinfo": "Unauthorized."})
    elif authorization_header:
        # clientId = hashlib.md5(authorization_header.encode('utf-8')).hexdigest()
        clientId = request.headers.get('Client-Id') or hashlib.md5((request.headers.get('User-Agent') + '@' + clientIpAddress + tools.getRandomString(64)).encode('utf-8')).hexdigest()
        if not clientId in apis.apiInstances:
            apis.apiInstances[clientId] = apis.ApiOverHttp(clientId=clientId, clientUserAgent=request.headers.get('User-Agent'))
            apis.apiInstances[clientId].userToken = authorization_header
    if not clientId in apis.apiInstances:
        return json.dumps({"errinfo": "Client not found."})
    apis.apiInstances[clientId].clientUserAgent = request.headers.get('User-Agent')
    print(functionName, clientId)
    # Get the token, and check the token
    if functionName not in ['signInWithEmail', 'signInWithGithub', 'signInWithGoogle', 'querySigninResult']:
        if not authorization_header or authorization_header != apis.apiInstances[clientId].userToken:
            return json.dumps({"errinfo": "Unauthorized."})
    # By reaching here, the request is valid. Call the function
    if hasattr(apis.apiInstances[clientId], functionName):
        method = getattr(apis.apiInstances[clientId], functionName)
        retval = method(params=data) or {}
        return json.dumps(retval)
    else:
        return json.dumps({"errinfo": "Function not found."})

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


def open_http_server(host=''):
    # run(app, host='127.0.0.1', port=19790)
    server = WSGIServer((host or "127.0.0.1", 19790), app, handler_class=WebSocketHandler)
    server.serve_forever()


def start_http_server(host=''):
    try:
        # Start a thread with the server
        http_server_thread = threading.Thread(target=open_http_server, kwargs={'host': host})
        http_server_thread.daemon = True  # Set as a daemon thread
        http_server_thread.start()
    except:
        traceback.print_exc()

