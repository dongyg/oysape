#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys, threading, traceback, os, json, hashlib, hmac, time
import logging
from queue import Queue
from bottle import Bottle, request, static_file, abort, response, hook, redirect
from geventwebsocket import WebSocketError
from gevent.pywsgi import WSGIServer
from geventwebsocket.handler import WebSocketHandler
from . import tools, apis, consts, obhs, scheduler
from .templs import template_signin_success_close, template_signin_success_redirect, template_signin_failed_close

KVStore = {}
app = Bottle()

@app.error(404)
def not_found(error):
    return 'Not found'

@app.error(405)
def not_allowed(error):
    return 'not found'

def getClientIdAndToken(req):
    clientIpAddress = req.headers.get('X-Forwarded-For') or req.remote_addr
    if req.headers.get('User-Agent').find('OysapeDesktop') >=0:
        # Use the pywebview token as the clientId for desktop version. It should have a apiObject in apis.apiInstances
        import webview
        clientId = webview.token
    else:
        clientId = req.cookies.get('client_id')
    clientToken = req.cookies.get('client_token')
    return clientIpAddress, clientId, clientToken


################################################################################
@app.route('/websocket')
def handle_websocket():
    wsock = request.environ.get('wsgi.websocket')
    if not wsock:
        abort(400, 'Expected WebSocket request.')
    clientIpAddress, clientId, clientToken = getClientIdAndToken(request)
    try:
        uniqueKey = None
        while True:
            init_message = wsock.receive()
            if not init_message:
                break
            try:
                recvData = json.loads(init_message)
            except Exception as e:
                logging.info(('Socket Error:', clientIpAddress, clientId, init_message))
                break
            # logging.info((recvData))
            action = recvData.get('action')
            uniqueKey = recvData.get('uniqueKey')
            apiObject = apis.apiInstances.get(clientId) if clientId else None
            if apiObject and uniqueKey and clientToken and clientToken == apiObject.userToken:
                if action == 'init':
                    logging.info(('Socket Init', clientIpAddress, clientId, uniqueKey))
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
                logging.info(('Socket Close', clientIpAddress, clientId, uniqueKey))
                del apis.apiInstances[clientId].socketConnections[uniqueKey]
            if uniqueKey == 'workspace':
                logging.info(('Workspace Close', clientIpAddress, clientId, 'terminal:', len(apis.apiInstances[clientId].terminalConnections), 'combined:', len(apis.apiInstances[clientId].combinedConnections)))
                apis.apiInstances[clientId].closeCombConnections()
                apis.apiInstances[clientId].closeAllTerminals()
                if apis.apiInstances[clientId].isDesktopVersion():
                    import webview
                    if clientId != webview.token:
                        logging.info(('Workspace Api Object Remove', clientIpAddress, clientId))
                        del apis.apiInstances[clientId]
                else:
                    del apis.apiInstances[clientId]


@app.route('/callback/oauth')
def oauthCallback():
    code = request.query.get('code')
    state = request.query.get('state')
    clientId = request.query.get('cid')
    if not clientId in apis.apiInstances: return 'Client not found while callback'
    # Send the code to backend to finish the OAuth process and finish the sign in process. Get the token.
    retval = tools.callServerApiPost('/signin/finish', {'code': code, 'state': state, 'cid': clientId}, apis.apiInstances[clientId])
    if not retval: return 'Something wrong'
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
        # cookies 的有效期可以让用户在设置 web host 的时候自行设置. 仅会话有效的话会更安全(token泄露被盗用的可能性更小). 另外用户也可以选择在 web version 使用后自行 sign out. sign out 后 token 已经删除并失效了, 就不存在泄露和被盗用风险了.
        response.set_cookie("client_token", retval.get('data').get('token'), path="/", httponly=True)
        response.set_cookie("client_id", clientId, path="/", httponly=True)
        # response.set_cookie("client_token", retval.get('data').get('token'), path="/", max_age=3600*24*30, httponly=True)
        # response.set_cookie("client_id", clientId, path="/", max_age=3600*24*30, httponly=True)
        rendered_template = template_signin_success_redirect.replace('{url}', apis.apiInstances[clientId].backendHost+'/index.html')
    return rendered_template

@app.route('/signout')
def signout():
    clientIpAddress, clientId, clientToken = getClientIdAndToken(request)
    if clientToken and clientId and clientId in apis.apiInstances and clientToken == apis.apiInstances[clientId].userToken:
        functionName = 'signout'
        if hasattr(apis.apiInstances[clientId], functionName):
            method = getattr(apis.apiInstances[clientId], functionName)
            retval = method(params={}) or {}
            if not retval.get('errinfo'):
                logging(('Client signout', clientIpAddress, clientId))
                response.delete_cookie('client_id')
                response.delete_cookie('client_token')
    return redirect('/index.html')


################################################################################
# For webhost
def checkSignature():
    # Check the signature
    clientIpAddress = request.headers.get('X-Forwarded-For') or request.remote_addr
    nonce = request.query.get('nonce')
    sig = request.query.get('sig')
    ts = request.query.get('ts')
    if not nonce or not sig or not ts or ts < str(int(time.time())-30):
        if not consts.IS_DEBUG and not tools.rate_limit(KVStore, clientIpAddress+request.urlparts.path):
            return json.dumps({"errinfo": "Too many requests1."})
        return {'errinfo': 'Invalid request'}
    webhost_config = os.getenv('WEBHOST_CONFIG')
    if webhost_config and len(webhost_config.split('@'))==2:
        v1, v2 = webhost_config.split('@')
        obhs.keys[v2] = v1
    else:
        if not consts.IS_DEBUG and not tools.rate_limit(KVStore, clientIpAddress+request.urlparts.path):
            return json.dumps({"errinfo": "Too many requests2."})
        return {'errinfo': 'Cannot find the oysape backend host configuration.'}
    secret_key = obhs.keys.get(v2)
    if not secret_key:
        if not consts.IS_DEBUG and not tools.rate_limit(KVStore, clientIpAddress+request.urlparts.path):
            return json.dumps({"errinfo": "Too many requests."})
        return {'errinfo': 'Cannot find the oysape backend host configuration. %s'%v2}
    hmac_result = hmac.new(secret_key.encode('utf-8'), (nonce+ts).encode('utf-8'), hashlib.sha256)
    if not hmac.compare_digest(hmac_result.hexdigest(), sig):
        if not consts.IS_DEBUG and not tools.rate_limit(KVStore, clientIpAddress+request.urlparts.path):
            return json.dumps({"errinfo": "Too many requests3."})
        return {'errinfo': 'Invalid signature'}
    return request.query

@app.route('/callback/webhost')
def checkWebhost():
    # params: nonce, ts, sig
    retval = checkSignature()
    if retval.get('errinfo'):
        return retval
    # Because validation is a necessary step after the webhost container is running. Once validation is passed, the webhost's schedules can be run.
    webhostFile = os.path.join(apis.folder_base, 'webhost.json')
    if os.path.isfile(webhostFile):
        try:
            with open(webhostFile, 'r') as f:
                webhostObject = json.load(f)
            if webhostObject.get('schedules'):
                scheduler.initScheduler(webhostObject.get('obh'), webhostObject.get('schedules'))
        except Exception as e:
            logging(('Error', e))
    return {'data': 'ok'}

@app.route('/schedule/logs')
def getScheduleLogs():
    # params: nonce, ts, sig. tname, obh, sch, page, pageSize
    clientIpAddress = request.headers.get('X-Forwarded-For') or request.remote_addr
    retval = checkSignature()
    if retval.get('errinfo'):
        return retval
    # Call the API
    tname = retval.get('tname')
    if not tname in scheduler.apiSchedulers:
        if not consts.IS_DEBUG and not tools.rate_limit(KVStore, clientIpAddress+request.urlparts.path):
            return json.dumps({"errinfo": "Too many requests4."})
        return {'errinfo': 'Invalid team name.'}
    return scheduler.apiSchedulers[tname].execQueryScheduleLogs(retval)


################################################################################
# For GitHub webhook
@app.route('/webhook/github', method='POST')
def github_webhook():
    # Get the request body
    payload = request.body.read()
    # Get the signature
    signature = request.headers.get('X-Hub-Signature-256')
    if not is_valid_signature(payload, signature):
        response.status = 401  # Unauthorized
        return "Invalid signature"
    # Decode the JSON payload
    data = json.loads(payload.decode('utf-8'))
    # Do something to handle the event
    event_type = request.headers.get('X-GitHub-Event')
    return handle_github_event(event_type, data)

def is_valid_signature(payload, signature):
    # Use the HMAC algorithm and SHA256 hash function
    webhostFile = os.path.join(apis.folder_base, 'webhost.json')
    if os.path.isfile(webhostFile):
        try:
            with open(webhostFile, 'r') as f:
                webhostObject = json.load(f)
            if webhostObject.get('github_hook_secret'):
                SECRET = webhostObject.get('github_hook_secret')
                hash = hmac.new(SECRET, payload, hashlib.sha256)
                expected_signature = 'sha256=' + hash.hexdigest()
                return hmac.compare_digest(expected_signature, signature)
        except Exception as e:
            traceback.print_exc()

def handle_github_event(event_type, data):
    #TODO: 调用用户自定义的 Github Webhook 事件处理函数
    if event_type == 'push':
        print(f"Pushed to {data['repository']['full_name']}")
        print(f"Commit message: {data['head_commit']['message']}")
        print(data)
    elif event_type == 'pull_request':
        print(f"Pull request action: {data['action']}")
        print(f"Pull request title: {data['pull_request']['title']}")


################################################################################
# For API call
@app.route('/<:re:.*>', method='OPTIONS')
def enable_cors_generic_route():
    """
    This route takes priority over all others. So any request with an OPTIONS method will be handled by this function.
    See: https://github.com/bottlepy/bottle/issues/402
    NOTE: This means we won't 404 any invalid path that is an OPTIONS request.
    """
    add_cors_headers()

@hook('after_request')
def enable_cors_after_request_hook():
    """
    This executes after every route. We use it to attach CORS headers when applicable.
    """
    add_cors_headers()

def add_cors_headers():
    if consts.IS_DEBUG:
        response.headers['Access-Control-Allow-Origin'] = 'http://192.168.0.2:19790'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token'
        response.headers['Access-Control-Allow-Credentials'] = 'true'

@app.route('/api/<functionName>', method='POST')
def api(functionName):
    # The http apis are for the web version only
    add_cors_headers()
    data = request.json
    clientIpAddress, clientId, clientToken = getClientIdAndToken(request)
    logging.info(('OverHttp', clientIpAddress, clientId, functionName))
    if functionName in ['signInWithEmail','signInWithGithub','signInWithGoogle']:
        # Request to sign in is limited. These 3 requests have no clientId in the headers
        if not consts.IS_DEBUG and not tools.rate_limit(KVStore, clientIpAddress+request.urlparts.path):
            return json.dumps({"errinfo": "Too many requests."})
        if not clientId:
            # Generate a clientId, it should be different every time
            clientId = hashlib.md5((request.headers.get('User-Agent') + '@' + clientIpAddress + tools.getRandomString(64)).encode('utf-8')).hexdigest()
        if not clientId in apis.apiInstances:
            apis.apiInstances[clientId] = apis.ApiOverHttp(clientId=clientId, clientUserAgent=request.headers.get('User-Agent'))
        data['user-agent'] = request.headers.get('User-Agent')
    elif not clientToken or not clientId:
        # No token. Return empty session. The frontend will show the sign in buttons and stop the loading.
        if not consts.IS_DEBUG and clientToken and not tools.rate_limit(KVStore, clientIpAddress+request.urlparts.path):
            return json.dumps({"errinfo": "Too many requests."})
        return json.dumps({})
    elif functionName == 'reloadUserSession' and clientId and not clientId in apis.apiInstances and clientToken:
        # When a user open a web version page, with a clientId and a clientToken
        apis.apiInstances[clientId] = apis.ApiOverHttp(clientId=clientId, clientUserAgent=request.headers.get('User-Agent'))
        apis.apiInstances[clientId].userToken = clientToken
    if not clientId in apis.apiInstances:
        if not consts.IS_DEBUG and not tools.rate_limit(KVStore, clientIpAddress+request.urlparts.path):
            return json.dumps({"errinfo": "Too many requests."})
        return json.dumps({"errinfo": "Session expired. Please reload or re-open the app."})
    apis.apiInstances[clientId].clientUserAgent = request.headers.get('User-Agent')
    # Get the token, and check the token
    if functionName not in ['signInWithEmail', 'signInWithGithub', 'signInWithGoogle']:
        if not clientToken or clientToken != apis.apiInstances[clientId].userToken:
            if not consts.IS_DEBUG and clientToken and not tools.rate_limit(KVStore, clientIpAddress+request.urlparts.path):
                return json.dumps({"errinfo": "Too many requests."})
            return json.dumps({"errinfo": "Unauthorized."})
    # By reaching here, the request is valid. Call the function
    if hasattr(apis.apiInstances[clientId], functionName):
        method = getattr(apis.apiInstances[clientId], functionName)
        retval = method(params=data) or {}
        if functionName == 'signout' and not retval.get('errinfo'):
            logging.info(('Client signout', clientIpAddress, clientId, retval))
            redirect('/signout')
            response.delete_cookie('client_id')
            response.delete_cookie('client_token')
        return json.dumps(retval)
    else:
        return json.dumps({"errinfo": "Function not found."})


################################################################################
# Home page and static files
@app.route('/')
def serve_root():
    redirect('/index.html')

@app.route('/<filename:path>')
def serve_static(filename):
    try:
        # The directory where the temporary files are created by PyInstaller
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    if os.path.exists(os.path.join(base_path, 'gui')):
        base_path = os.path.join(base_path, 'gui')
    elif os.path.exists(os.path.join(base_path, '..', 'Resources', 'gui')):
        base_path = os.path.join(base_path, '..', 'Resources', 'gui')
    elif os.path.exists(os.path.join(base_path, '..', 'gui')):
        base_path = os.path.join(base_path, '..', 'gui')
    elif os.path.exists(os.path.join(base_path, 'public')):
        base_path = os.path.join(base_path, 'public')
    logging.info('File requested: ' + os.path.join(base_path, filename))
    return static_file(filename, root=base_path)


################################################################################
def open_http_server(host='', port=19790, queue=None):
    # run(app, host='127.0.0.1', port=port)
    try:
        server = WSGIServer((host or "127.0.0.1", port), app, handler_class=WebSocketHandler)
        server.serve_forever()
    except Exception as e:
        logging.info(('Websocket server failed to start on port', port, str(e)))
        result = False
        if queue is not None:
            queue.put(result)

def start_http_server(host='', port=19790):
    # Start a thread with the server
    result_queue = Queue()
    http_server_thread = threading.Thread(target=open_http_server, kwargs={'host': host, 'port': port, 'queue': result_queue})
    http_server_thread.daemon = True  # Set as a daemon thread
    http_server_thread.start()
    # Get the thread's result
    if not result_queue.empty():
        return result_queue.get()
    else:
        logging.info(('Websocket server started on port', port))
        return True

