#!/usr/bin/env python
# -*- coding: utf-8 -*-

import threading, traceback, os, json, hashlib
from bottle import Bottle, request, static_file, abort, response, hook, redirect
from geventwebsocket import WebSocketError
from gevent.pywsgi import WSGIServer
from geventwebsocket.handler import WebSocketHandler
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
    if request.headers.get('User-Agent').find('Oysape') >=0:
        # Use the pywebview token as the clientId for desktop version. It should have a apiObject in apis.apiInstances
        import webview
        clientId = webview.token
    else:
        clientId = request.cookies.get('client_id')
    clientToken = request.cookies.get('client_token')
    if not wsock:
        abort(400, 'Expected WebSocket request.')
    try:
        uniqueKey = None
        while True:
            init_message = wsock.receive()
            if not init_message:
                break
            try:
                recvData = json.loads(init_message)
            except Exception as e:
                print('SocketError:', (request.headers.get('X-Forwarded-For') or request.remote_addr), init_message)
                break
            # print(recvData)
            action = recvData.get('action')
            uniqueKey = recvData.get('uniqueKey')
            apiObject = apis.apiInstances.get(clientId) if clientId else None
            if apiObject and uniqueKey and clientToken and clientToken == apiObject.userToken:
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
                if apis.apiInstances[clientId].isDesktopVersion():
                    import webview
                    if clientId != webview.token:
                        # print('Remove API object', clientId)
                        del apis.apiInstances[clientId]
                else:
                    del apis.apiInstances[clientId]


def processSigninResponse(retval):
    # check clientId
    if not retval: return 'Something wrong'
    clientId = retval.get('clientId')
    if not clientId in apis.apiInstances: return 'Client not found while callback'
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
        # In the web version, can set the cookie here. The cookies are only available for this session.
        #TODO: cookies 的有效期可以让用户在设置 web host 的时候自行设置. 仅会话有效的话会更安全(token泄露被盗用的可能性更小). 另外用户也可以选择在 web version 使用后自行 sign out. sign out 后 token 已经删除并失效了, 就不存在泄露和被盗用风险了.
        response.set_cookie("client_token", retval.get('data').get('token'), path="/", httponly=True)
        response.set_cookie("client_id", clientId, path="/", httponly=True)
        # response.set_cookie("client_token", retval.get('data').get('token'), path="/", max_age=3600*24*30, httponly=True)
        # response.set_cookie("client_id", clientId, path="/", max_age=3600*24*30, httponly=True)
        rendered_template = template_signin_success_redirect.replace('{url}', apis.apiInstances[clientId].backendHost+'/index.html')
    return rendered_template

@app.route('/callback/oauth')
def githubOauthCallback():
    code = request.query.get('code')
    state = request.query.get('state')
    cid = request.query.get('cid')
    if not cid in apis.apiInstances: return 'Client not found while callback'
    # Send the code to backend to finish the OAuth process and finish the sign in process. Get the token.
    retval = tools.callServerApiPost('/signin/finish', {'code': code, 'state': state, 'cid': cid}, apis.apiInstances[cid])
    return processSigninResponse(retval)

@app.route('/signout')
def signout():
    if request.headers.get('User-Agent').find('Oysape') >=0:
        # Use the pywebview token as the clientId for desktop version. It should have a apiObject in apis.apiInstances
        import webview
        clientId = webview.token
    else:
        clientId = request.cookies.get('client_id')
    clientToken = request.cookies.get('client_token')
    if clientToken and clientId and clientToken == apis.apiInstances[clientId].userToken:
        functionName = 'signout'
        if hasattr(apis.apiInstances[clientId], functionName):
            method = getattr(apis.apiInstances[clientId], functionName)
            retval = method(params={}) or {}
            if not retval.get('errinfo'):
                print('Client signout', clientId)
                response.delete_cookie('client_id')
                response.delete_cookie('client_token')
    return redirect('/index.html')

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
        response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token'
        response.headers['Access-Control-Allow-Credentials'] = 'true'

@app.route('/api/<functionName>', method='POST')
def api(functionName):
    # The http apis are for the web version only
    if consts.IS_DEBUG:
        add_cors_headers()
    data = request.json
    clientIpAddress = request.headers.get('X-Forwarded-For') or request.remote_addr
    if request.headers.get('User-Agent').find('Oysape') >=0:
        # Use the pywebview token as the clientId for desktop version. It should have a apiObject in apis.apiInstances
        import webview
        clientId = webview.token
    else:
        clientId = request.cookies.get('client_id')
    clientToken = request.cookies.get('client_token')
    print('OverHttp', clientId, functionName)
    if functionName in ['signInWithEmail','signInWithGithub','signInWithGoogle']:
        # Request to sign in is limited. These 3 requests have no clientId in the headers
        if not consts.IS_DEBUG and not tools.rate_limit(KVStore, clientIpAddress, {1:1, 10:3, 60:6, 900:10, 3600:15, 86400:20}):
            return json.dumps({"errinfo": "Too many requests."})
        if not clientId:
            # Generate a clientId, it should be different every time
            clientId = hashlib.md5((request.headers.get('User-Agent') + '@' + clientIpAddress + tools.getRandomString(64)).encode('utf-8')).hexdigest()
        if not clientId in apis.apiInstances:
            apis.apiInstances[clientId] = apis.ApiOverHttp(clientId=clientId, clientUserAgent=request.headers.get('User-Agent'))
        data['user-agent'] = request.headers.get('User-Agent')
    elif not clientToken or not clientId:
        # No token. Return empty session. The frontend will show the sign in buttons and stop the loading.
        if not consts.IS_DEBUG and not tools.rate_limit(KVStore, clientIpAddress, {1:1, 10:3, 60:6, 900:10, 3600:15, 86400:20}):
            return json.dumps({"errinfo": "Too many requests."})
        return json.dumps({})
    elif functionName == 'reloadUserSession' and not clientId in apis.apiInstances:
        # When a user open a web version page, with a clientId and a clientToken
        apis.apiInstances[clientId] = apis.ApiOverHttp(clientId=clientId, clientUserAgent=request.headers.get('User-Agent'))
        apis.apiInstances[clientId].userToken = clientToken
    if not clientId in apis.apiInstances:
        if not consts.IS_DEBUG and not tools.rate_limit(KVStore, clientIpAddress, {1:1, 10:3, 60:6, 900:10, 3600:15, 86400:20}):
            return json.dumps({"errinfo": "Too many requests."})
        return json.dumps({"errinfo": "Client not found."})
    apis.apiInstances[clientId].clientUserAgent = request.headers.get('User-Agent')
    # Get the token, and check the token
    if functionName not in ['signInWithEmail', 'signInWithGithub', 'signInWithGoogle']:
        if not clientToken or clientToken != apis.apiInstances[clientId].userToken:
            if not consts.IS_DEBUG and not tools.rate_limit(KVStore, clientIpAddress, {1:1, 10:3, 60:6, 900:10, 3600:15, 86400:20}):
                return json.dumps({"errinfo": "Too many requests."})
            return json.dumps({"errinfo": "Unauthorized."})
    # By reaching here, the request is valid. Call the function
    if hasattr(apis.apiInstances[clientId], functionName):
        method = getattr(apis.apiInstances[clientId], functionName)
        retval = method(params=data) or {}
        if functionName == 'signout' and not retval.get('errinfo'):
            print('Client signout', clientId, retval)
            redirect('/signout')
            response.delete_cookie('client_id')
            response.delete_cookie('client_token')
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

