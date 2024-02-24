#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os, traceback, json, json, time, getpass, socket, fnmatch, platform
import webview
from . import tools, oauth, consts

BUF_SIZE = 1024
CR = '\r'
LF = '\n'
CRLF = CR + LF
ctrl_c = '\u0003'
ctrl_d = '\u0004'
es_home = '\u001b[200~'
es_end = '\u001b[201~'
folder_base = os.path.expanduser(os.path.join('~', '.oysape'))
folder_cache = os.path.join(folder_base, 'localcache')
# folder_projects = os.path.join(folder_base, 'projects')
filename_settings = os.path.join(folder_base, 'settings.json')
# filename_session = os.path.join(folder_base, 'session.json')
# filename_tasks = os.path.join(folder_base, 'tasks.json')
# filename_servers = os.path.join(folder_base, 'servers.json')
# filename_pipelines = os.path.join(folder_base, 'pipelines.json')
themeType = 'dark'


def get_files(apath, recurse=True, exclude=[], ignore=None):
    if os.path.isdir(apath):
        result = []
        items = os.listdir(apath)
        items.sort()
        dirs = [x for x in items if os.path.isdir(os.path.join(apath, x))]
        files = [x for x in items if os.path.isfile(os.path.join(apath, x))]
        for item in dirs:
            if exclude and ignore and callable(ignore) and not ignore(item,exclude):
                result.append({"title":item, "key":tools.get_key(os.path.join(apath, item)), "path":os.path.join(apath, item), "children":get_files(os.path.join(apath, item), recurse, exclude, ignore) if recurse else []})
        for item in files:
            if exclude and ignore and callable(ignore) and not ignore(item,exclude):
                result.append(get_files(os.path.join(apath, item), recurse, exclude, ignore))
        return result
    elif os.path.isfile(apath):
        return {"title":os.path.basename(apath), "key":tools.get_key(apath), "path":apath, "isLeaf":True}
    else:
        return []

def merge_steps(steps):
    from collections import defaultdict
    merged_data = defaultdict(list)
    for item in steps:
        target = item["target"]
        tasks = item["tasks"]
        merged_data[target].extend(tasks)
    merged_data = [{"target": target, "tasks": tasks} for target, tasks in merged_data.items()]
    return merged_data

def colorizeText(text, fore=None, back=None):
    backgrounds = {
        'gray': '\x1b[40m%s\x1b[0m',  # background
        'red': '\x1b[41m%s\x1b[0m',  # background
        'green': '\x1b[42m%s\x1b[0m',  # background
        'yellow': '\x1b[43m%s\x1b[0m',  # background
        'blue': '\x1b[44m%s\x1b[0m',  # background
        'purple': '\x1b[45m%s\x1b[0m',  # background
        'cyan': '\x1b[46m%s\x1b[0m',  # background
        'white': '\x1b[47m%s\x1b[0m',  # background
    }
    foregrounds = {
        'red': '\x1b[31m%s\x1b[0m',  # text
        'green': '\x1b[32m%s\x1b[0m',  # text
        'yellow': '\x1b[33m%s\x1b[0m',  # text
        'blue': '\x1b[34m%s\x1b[0m',  # text
        'purple': '\x1b[35m%s\x1b[0m',  # text
        'cyan': '\x1b[36m%s\x1b[0m',  # text
        'white': '\x1b[37m%s\x1b[0m',  # text
    }
    if fore and fore in foregrounds:
        text = foregrounds[fore]%text
    if back and back in backgrounds:
        text = backgrounds[back]%text
    return text

def loadEntrypointWindow(window=None):
    url_entrypoint = 'http://127.0.0.1:19790/entrypoint'
    if not window:
        window = webview.create_window('Oysape', url_entrypoint, js_api=apiInstance, width=1280, height=768, confirm_close=True)
    else:
        window.load_url(url_entrypoint)
    return window

def clearCookies(window):
    window.evaluate_js('''document.cookie = `token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;''')

def check_token(window):
    cookies = window.get_cookies()
    if (cookies and cookies[0].get('token') and cookies[0]['token'].value) or consts.userToken:
        consts.userToken = cookies[0]['token'].value if (cookies and cookies[0].get('token') and cookies[0]['token'].value) else consts.userToken
        loadEntrypointWindow(window)
        # time.sleep(1)
        retval = tools.callServerApiPost('/user/test', {'token': consts.userToken})
        if retval and not retval.get('errcode'):
            # Success
            apiInstance.update_session(retval)
            window.load_url(consts.homeEntry)
            return True
        elif retval:
            # Has error
            showSignInPage(window, True, retval.get('errinfo'))
        else:
            # Network error
            showSignInPage(window, False, "Network error. Please try again later.")
            return True

def showSignInPage(window, signout=False, message=None):
    if signout: clearCookies(window)
    window.load_url('http://127.0.0.1:19790/signin')
    if signout: clearCookies(window)
    if message:
        window.evaluate_js('''showError("%s");'''%(message or 'Unknown error.'))
    else:
        window.evaluate_js('''clearError();''')

def mainloop(window):
    if not check_token(window):
        showSignInPage(window)
        while True: # Wait for token
            if check_token(window):
                break
            time.sleep(1)


################################################################################
class ApiBase:
    def __init__(self, _debug=False):
        self._debug = _debug
        # if not os.path.isfile(filename_session):
        #     json.dump({
        #         'client': getpass.getuser()+'@'+socket.gethostname(),
        #     }, open(filename_session, 'w'), indent=4)

    def isDebug(self):
        return self._debug

    def fullscreen(self):
        webview.windows[0].toggle_fullscreen()

    def choose_file(self):
        filename = webview.windows[0].create_file_dialog(webview.OPEN_DIALOG)
        return filename[0] if filename else ''

    def get_absolute_path(self, params):
        path = params.get('path', '')
        if os.path.isfile(path):
            return os.path.abspath(path)
        elif os.path.isfile(os.path.expanduser(path)):
            return os.path.abspath(os.path.expanduser(path))
        else:
            workspaceSettings = {}
            if os.path.isfile(filename_settings):
                with open(filename_settings, 'r') as f:
                    workspaceSettings = json.load(f)
            folders = (workspaceSettings.get('folders') or [])
            for folder in folders:
                apath = folder.get('path')
                if not apath: continue
                apath = os.path.join(os.path.split(apath)[0], path)
                if os.path.isfile(apath):
                    return os.path.abspath(apath)
        return ''

    def read_file(self, params):
        # Read the content of the file: params['path']
        path = params.get('path', '')
        if not os.path.isfile(path):
            return {'errinfo': 'File not found: %s' % path}
        try:
            with open(path, 'r') as f:
                return f.read()
        except Exception as e:
            return {'errinfo': str(e)}

    def save_file(self, params):
        # Save params['content'] to params['path']
        path = params.get('path', '')
        content = params.get('content', '')
        # Check if it's valid JSON if saving settings
        if filename_settings == path:
            try:
                json.loads(content)
            except:
                return {'errinfo': 'Invalid JSON'}
        with open(path, 'w') as f:
            f.write(content)

    def save_content(self, content):
        # Save content to the file given by save dialog
        filename = webview.windows[0].create_file_dialog(webview.SAVE_DIALOG)
        if not filename:
            return
        with open(filename, 'w') as f:
            f.write(content)

    def setTheme(self, params):
        global themeType
        themeType = (params or {}).get('type', themeType)
        # print('theme', themeType)

    def execute(self, functionName, args=None):
        if hasattr(self, functionName):
            function = getattr(self, functionName)
            if callable(function):
                try:
                    if args:
                        return function(args)
                    else:
                        return function()
                except Exception as e:
                    return "Failed: (%s) %s" % (str(function), str(e))
        return "Api not found: %s" % functionName


class ApiOauth(ApiBase):
    def tryToPrepareToSignIn(self):
        consts.windowObj.load_url('http://127.0.0.1:19790/signin')

    def signInWithGithub(self, state):
        oauth.openGithubOAuthWindow(state)

    def signInWithGoogle(self, state):
        oauth.openGoogleOAuthWindow(state)


class ApiOysape(ApiOauth):
    listServer = []
    listTask = []
    listPipeline = []
    userSession = {}
    workspaceSettings = {"exclude": [
        ".DS_Store ._* .Spotlight-V100 .Trashes Thumbs.db Desktop.ini",
        "_MTN .bzr .hg .fslckout _FOSSIL_ .fos CVS _darcs .git .svn .osc .gitattributes .gitmodules",
        "*.pyc *.pyo *.class *.a *.obj *.o *.so *.la *.lib *.dylib *.ocx *.dll *.exe *.jar *.zip *.tar *.tar.gz *.tgz *.rpm *.dmg *.pkg *.deb}",
        "*.jpg *.jpeg *.gif *.png *.bmp *.tiff *.tif *.webp *.wav *.mp3 *.ogg *.flac *.avi *.mpg *.mp4 *.mkv *.xcf *.xpm}",
        "node_modules"
    ]}

    def testApi(self, params):
        print('ApiOysape.testApi', params)
        # print(self.listServer)
        # print(self.listTask)
        # print(self.listPipeline)
        return {'errinfo': 'test called'}

    def signIn(self, params):
        showSignInPage(consts.windowObj, True)

    def reloadUserSession(self, params={}):
        retval = tools.callServerApiPost('/user/test', {'token': consts.userToken})
        if retval and not retval.get('errcode'):
            self.update_session(retval)
            consts.windowObj.evaluate_js('''window.reloadUserSession && window.reloadUserSession(); window.reloadServerList && window.reloadServerList(); window.reloadTaskList && window.reloadTaskList(); window.reloadPipelineList && window.reloadPipelineList();''')

    def update_session(self, sdata):
        tt = sdata.pop('tasks', []) or []
        pp = sdata.pop('pipelines', []) or []
        ss = sdata.pop('servers', []) or []
        self.userSession = sdata
        self.listPipeline = pp
        self.listServer = ss
        self.listTask = tt
        # with open(filename_tasks, 'w') as f:
        #     json.dump(tt, f, indent=4)
        # with open(filename_pipelines, 'w') as f:
        #     json.dump(pp, f, indent=4)
        # with open(filename_servers, 'w') as f:
        #     json.dump(ss, f, indent=4)
        # with open(filename_session, 'w') as f:
        #     json.dump(sdata, f, indent=4)

    def getUserSession(self, params={}):
        # if not self.userSession or params.get('refresh'):
        #     if os.path.isfile(filename_session):
        #         with open(filename_session, 'r') as f:
        #             self.userSession = json.load(f)
        return self.userSession

    def switchToWorkspace(self, params):
        if not params.get('wid'): return {"errinfo": "No workspace"}
        retval = tools.switchToWorkspace(params.get('wid'))
        if retval and not retval.get('errcode'):
            self.update_session(retval)
        return retval

    def getServerList(self, params={}):
        # Return server list as a list
        # if not self.listServer or params.get('refresh'):
        #     if os.path.isfile(filename_servers):
        #         with open(filename_servers, 'r') as f:
        #             self.listServer = json.load(f)
        return self.listServer

    def addServer(self, params):
        # Return server list in {'servers': []}
        if params.get('prikey') and not os.path.isfile(os.path.expanduser(params.get('prikey'))):
            return {"errinfo": "Private key file not found: %s" % params.get('prikey')}
        return self.importTo({'what': 'servers', 'items': [params]})

    def deleteServer(self, params):
        # Return server list in {'servers': []}
        retval = tools.delItemOnServer('servers', params.get('key'))
        self.listServer = retval.get('servers') or []
        # with open(filename_servers, 'w') as f:
        #     json.dump(self.listServer, f, indent=4)
        return retval

    def getTaskObject(self, taskKey):
        if not self.listTask: self.getServerList()
        taskObj = [x for x in self.listTask if x.get('name') == taskKey]
        taskObj = taskObj[0] if taskObj else {}
        return taskObj

    def getTaskCommands(self, taskKey):
        taskObj = self.getTaskObject(taskKey)
        if not taskObj: return []
        return json.loads(json.dumps(taskObj.get('cmds') or []))

    def getTaskList(self, params={}):
        # Return task list as a list
        # if not self.listTask or params.get('refresh'):
        #     if os.path.isfile(filename_tasks):
        #         with open(filename_tasks, 'r') as f:
        #             self.listTask = json.load(f)
        return self.listTask

    def addTask(self, params):
        # Return task list in {'tasks': []}
        retval = self.importTo({'what': 'tasks', 'items': [params]})
        if retval.get('pipelines'):
            self.listPipeline = retval.get('pipelines')
        return retval

    def deleteTask(self, params):
        # Return task list in {'tasks': []}
        retval = tools.delItemOnServer('tasks', params.get('key'))
        self.listTask = retval.get('tasks') or []
        # with open(filename_tasks, 'w') as f:
        #     json.dump(self.listTask, f, indent=4)
        return retval

    def getPipelineObject(self, pipeName):
        pipeObj = [x for x in self.listPipeline if x.get('name') == pipeName]
        pipeObj = pipeObj[0] if pipeObj else {}
        return pipeObj

    def getPipelineSteps(self, pipeName):
        pipeObject = self.getPipelineObject(pipeName)
        return json.loads(json.dumps(pipeObject.get('steps') or []))

    def getPipelineList(self, params={}):
        # Return pipeline list as a list
        # if not self.listPipeline or params.get('refresh'):
        #     if os.path.isfile(filename_pipelines):
        #         with open(filename_pipelines, 'r') as f:
        #             self.listPipeline = json.load(f)
        return self.listPipeline

    def addPipeline(self, params):
        # Return pipeline list in {'pipelines': []}
        return self.importTo({'what': 'pipelines', 'items': [params]})

    def deletePipeline(self, params):
        # Return pipeline list in {'pipelines': []}
        retval = tools.delItemOnServer('pipelines', params.get('key'))
        self.listPipeline = retval.get('pipelines') or []
        # with open(filename_pipelines, 'w') as f:
        #     json.dump(self.listPipeline, f, indent=4)
        return retval

    def getProjectFiles(self, params={}):
        retval = []
        if os.path.exists(filename_settings):
            with open(filename_settings, 'r') as f:
                self.workspaceSettings = json.load(f)
        else:
            if not os.path.exists(folder_base):
                os.makedirs(folder_base)
            with open(filename_settings, 'w') as f:
                json.dump(self.workspaceSettings, f, indent=4)
        exclude = self.workspaceSettings.get('exclude') or []
        exclude = [patten for item in exclude for patten in item.split(' ') if patten]
        ignore = lambda x,y: any([fnmatch.fnmatch(x, patten) for patten in y])
        # items = []
        # if os.path.exists(folder_projects):
        #     items = get_files(folder_projects, True, exclude, ignore)
        # oyfiles = [{"title":"Files", "key":"__files__", "children":items}]
        # retval.extend(oyfiles)
        folders = (self.workspaceSettings.get('folders') or [])
        folders = [{"root":True, "title":os.path.basename(x['path']), "key":tools.get_key(x['path']), "path":x['path'], "children":get_files(x['path'], True, exclude+(x.get('exclude') or []), ignore)} for x in folders if x.get('path') and not ignore(x['path'],exclude)]
        retval.extend(folders)
        return retval

    def addFolderToWorkspace(self, params={}):
        foldername = webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG)
        if foldername and foldername[0]:
            if not self.workspaceSettings.get('folders'):
                self.workspaceSettings['folders'] = []
            self.workspaceSettings['folders'].append({'path':foldername[0]})
            with open(filename_settings, 'w') as f:
                json.dump(self.workspaceSettings, f, indent=4)
        return {'projectFiles':self.getProjectFiles()}

    def removeFolderFromWorkspace(self, params={}):
        path = params.get('path', '')
        self.workspaceSettings['folders'] = [x for x in self.workspaceSettings.get('folders') if x.get('path') != path]
        with open(filename_settings, 'w') as f:
            json.dump(self.workspaceSettings, f, indent=4)
        return {'projectFiles':self.getProjectFiles()}

    def addFolderToExclude(self, params={}):
        path = params.get('path', '')
        for item in self.workspaceSettings['folders']:
            if path.startswith(item['path']):
                item['exclude'] = item.get('exclude') or []
                item['exclude'].append(os.path.basename(path))
        with open(filename_settings, 'w') as f:
            json.dump(self.workspaceSettings, f, indent=4)
        return {'projectFiles':self.getProjectFiles()}

    def importTo(self, params={}):
        # Import servers, tasks, pipelines
        what = params.get('what')
        objs = {
            'servers': self.listServer,
            'tasks': self.listTask,
            'pipelines': self.listPipeline
        }
        # saves = {
        #     'servers': filename_servers,
        #     'tasks': filename_tasks,
        #     'pipelines': filename_pipelines,
        # }
        if what not in objs.keys():
            return {"errinfo": "Invalid operation"}
        try:
            import_list = params.get('items') or []
            if not import_list:
                fname = self.choose_file()
                with open(fname, 'r') as f1:
                    import_list = json.load(f1)
            retval = tools.setItemsToServer(what, import_list)
            if retval and retval.get('errinfo'):
                return retval
            return_list = retval.get(what, []) or []
            objs[what].clear()
            objs[what].extend(return_list)
            # with open(saves[what], 'w') as f2:
            #     json.dump(objs[what], f2, indent=4)
            return retval
        except Exception as e:
            traceback.print_exc()
            return {"errinfo": str(e)}

    def exportFrom(self, params={}):
        # Export servers, tasks, pipelines
        what = params.get('what')
        objs = {
            'servers': self.listServer,
            'tasks': self.listTask,
            'pipelines': self.listPipeline
        }
        if what not in objs.keys():
            return {"errinfo": "Invalid operation"}
        try:
            self.save_content(json.dumps(objs[what], indent=4))
        except Exception as e:
            return {"errinfo": str(e)}


class ApiTerminal(ApiOysape):
    terminalConnections = {}

    def createTermConnection(self, params):
        from . import sshutils
        serverKey = params.get('serverKey')
        uniqueKey = params.get('uniqueKey')
        taskKey = params.get('taskKey')
        slist = [x for x in self.getServerList() if x["key"] == serverKey]
        if len(slist) == 0:
            return
        if not uniqueKey in self.terminalConnections:
            # print('createTermConnection', serverKey, uniqueKey)
            conn_str = sshutils.create_ssh_string(slist[0].get("address"), slist[0].get("username"), slist[0].get("port"))
            self.terminalConnections[uniqueKey] = sshutils.TerminalClient(conn_str, private_key=slist[0].get("prikey"), serverKey=serverKey, startup=slist[0].get("tasks"))
            self.terminalConnections[uniqueKey].uniqueKey = uniqueKey
            if not self.terminalConnections[uniqueKey].client:
                self.terminalConnections[uniqueKey].onChannelString(colorizeText(self.terminalConnections[uniqueKey].message,'red'))
            elif taskKey:
                taskObj = self.getTaskObject(taskKey)
                taskCmds = self.getTaskCommands(taskKey)
                execTask(taskKey, taskObj, taskCmds, self.terminalConnections[uniqueKey])

    def closeTermConnection(self, params={}):
        uniqueKey = params.get('uniqueKey')
        if self.terminalConnections.get(uniqueKey):
            # print('closeTermConnection', uniqueKey)
            self.terminalConnections[uniqueKey].close()
            del self.terminalConnections[uniqueKey]

    def resizeTermChannel(self, params):
        uniqueKey, width, height = params.get('uniqueKey'), params.get('cols'), params.get('rows')
        if self.terminalConnections.get(uniqueKey):
            self.terminalConnections[uniqueKey].resizeChannel(width, height)

    def sendTerminalInput(self, params):
        uniqueKey = params.get('uniqueKey')
        input = params.get('input')
        # print('sendTerminalInput', uniqueKey, input)
        if uniqueKey in self.terminalConnections:
            self.terminalConnections[uniqueKey].send_to_channel(input)

    def getConn(self, params):
        uniqueKey = params.get('uniqueKey')
        if uniqueKey in self.terminalConnections:
            return self.terminalConnections[uniqueKey].channel.exit_status_ready()

class ApiWorkspace(ApiTerminal):
    workspaceWorkingChannel = ''
    combinedConnections = {}

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ApiWorkspace, cls).__new__(cls)
        return cls._instance

    def createCombConnection(self, serverKey):
        from . import sshutils
        slist = [x for x in self.getServerList() if x["key"] == serverKey]
        if len(slist) == 0:
            return
        if not serverKey in self.combinedConnections:
            # print('createCombConnection', serverKey)
            conn_str = sshutils.create_ssh_string(slist[0].get("address"), slist[0].get("username"), slist[0].get("port"))
            self.combinedConnections[serverKey] = sshutils.WorkspaceClient(conn_str, private_key=slist[0].get("prikey"), serverKey=serverKey, startup=slist[0].get("tasks"))
            self.combinedConnections[serverKey].parentApi = self

    def closeCombConnections(self, params={}):
        for serverKey in self.combinedConnections.keys():
            # print('closeCombConnections', serverKey)
            self.combinedConnections[serverKey].close()
        self.combinedConnections = {}

    def resizeCombChannel(self, uniqueKey, width, height):
        if self.combinedConnections.get(uniqueKey):
            self.combinedConnections[uniqueKey].resizeChannel(width, height)

    def resizeAllCombChannel(self, params):
        width, height = params.get('cols'), params.get('rows')
        for uniqueKey in self.combinedConnections:
            self.resizeCombChannel(uniqueKey, width, height)

    def sendCombinedInput(self, params):
        serverKey = self.workspaceWorkingChannel
        if serverKey and serverKey in self.combinedConnections:
            input = params.get('input')
            # print('sendCombinedInput', serverKey, json.dumps(input))
            self.combinedConnections[serverKey].send_to_channel(input)

    def taskOnServer(self, taskKey, serverKey):
        needNewLine = True
        if not serverKey in self.combinedConnections:
            self.createCombConnection(serverKey)
            needNewLine = False
        if self.combinedConnections.get(serverKey) and self.combinedConnections[serverKey].running:
            if needNewLine:
                self.combinedConnections[serverKey].send_to_channel(LF, human=False)
            taskObj = self.getTaskObject(taskKey)
            taskCmds = self.getTaskCommands(taskKey)
            # Set the workspace's current server if want the workspace to be interactive
            if taskObj.get('interaction') == 'interactive':
                self.workspaceWorkingChannel = serverKey
                if len(webview.windows) > 0:
                    webview.windows[0].evaluate_js('window.updateWorkspaceTabTitle && window.updateWorkspaceTabTitle("%s")'%(serverKey))
            else:
                self.workspaceWorkingChannel = ''
                if len(webview.windows) > 0:
                    webview.windows[0].evaluate_js('window.updateWorkspaceTabTitle && window.updateWorkspaceTabTitle("%s")'%(''))
            execTask(taskKey, taskObj, taskCmds, self.combinedConnections[serverKey])
        elif self.combinedConnections[serverKey].message:
            outmsg = colorizeText(serverKey,None,'gray') + ' ' + colorizeText(self.combinedConnections[serverKey].message,'red')
            self.combinedConnections[serverKey].onChannelString(outmsg)

    def callTask(self, params):
        taskKey, serverKey = params.get('taskKey'), params.get('serverKey')
        self.taskOnServer(taskKey, serverKey)

    def callPipeline(self, params):
        pipeName = params.get('pipelineName')
        print('execPipeline', pipeName)
        steps = self.getPipelineSteps(pipeName)
        steps = merge_steps(steps)
        for step in steps:
            serverKey = step['target']
            tasks = step['tasks']
            for taskKey in tasks:
                self.taskOnServer(taskKey, serverKey)
            while True: # Wait for all tasks on current server to finish
                if self.combinedConnections.get(serverKey) and self.combinedConnections[serverKey].areAllTasksDone():
                    break
                time.sleep(0.5)

def execTask(taskKey, taskObj, taskCmds, client, output=True):
    global themeType
    bgColor = 'gray' if themeType == 'dark' else 'white'
    if not taskObj:
        client.onChannelString((CRLF+'No such task defined: %s'%taskKey+CRLF))
    elif taskObj.get('interaction') == 'upload':
        # Upload a file/directory
        if output: client.onChannelString((CRLF+CRLF+colorizeText('Task: %s @%s'%(taskKey, client.serverKey), 'cyan', bgColor)+CRLF))
        if taskObj.get('source') and taskObj.get('destination'):
            number, transfered = client.upload(taskObj.get('source'), taskObj.get('destination'))
            if output: client.onChannelString(CRLF+'Uploaded %s file(s). %s transfered'%(number, tools.convert_bytes(transfered))+CRLF)
        else:
            client.onChannelString((CRLF+'No source or destination defined: %s'%taskObj.get('name')+CRLF))
    elif taskObj.get('interaction') == 'download':
        # Download a file/directory
        if output: client.onChannelString((CRLF+CRLF+colorizeText('Task: %s @%s'%(taskKey, client.serverKey), 'cyan', bgColor)+CRLF))
        if taskObj.get('source') and taskObj.get('destination'):
            number, transfered = client.download(taskObj.get('source'), taskObj.get('destination'))
            if output: client.onChannelString(CRLF+'Downloaded %s file(s). %s transfered'%(number, tools.convert_bytes(transfered))+CRLF)
        else:
            client.onChannelString((CRLF+'No source or destination defined: %s'%taskObj.get('name')+CRLF))
    elif not taskCmds:
        client.onChannelString((CRLF+'No commands defined: %s'%taskKey+CRLF))
    else:
        # Execute the task's commands
        runmode = taskObj.get('runmode') or ''
        if output and runmode!='script': client.onChannelString((CRLF+CRLF+colorizeText('Task: %s @%s'%(taskKey, client.serverKey), 'cyan', bgColor)+CRLF))
        if runmode.startswith('batch'):
            # Send commands to the channel once for all
            str_join = '&' if platform.system() == 'Windows' else ' && '
            command = (str_join if runmode.endswith('join') else LF).join(taskCmds)
            if len(taskCmds)>1 and runmode.endswith('escape'):
                command = es_home + command + es_end
            print('execTask', client.serverKey, json.dumps(command))
            client.send_to_channel(command + LF, human=False)
        elif runmode=='script':
            # Save the commands to a script file, then execute it
            filename = tools.get_key(taskKey)+'.sh'
            filepath = os.path.join(folder_cache, filename)
            content = LF.join(taskCmds)
            if not os.path.exists(folder_cache):
                os.makedirs(folder_cache)
            with open(filepath, 'w') as f:
                f.write(content)
            number, transfered = client.upload_file(filepath, '~/.oysape/cache/%s'%filename)
            if number==1 and transfered>0:
                client.client.exec_command(f'chmod +x ~/.oysape/cache/%s'%filename)
                client.send_to_channel('source ~/.oysape/cache/%s'%filename+LF, human=False)
        else:
            # Send commands to the channel line-by-line
            print('execTask', client.serverKey, json.dumps(taskCmds))
            while taskCmds:
                data = taskCmds.pop(0)
                data = data.strip()+LF
                if data.strip() and not data.startswith('#'):
                    client.send_to_channel(data, human=False)
                    time.sleep(0.01)

apiInstance = ApiWorkspace()
