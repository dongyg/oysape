#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os, traceback, json, json, time, base64, fnmatch, platform
from . import auth, tools, consts

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

def loadEntrypointWindow(window=None, apiObject=None):
    import webview
    if not window:
        window = webview.create_window('Oysape', consts.homeEntry, js_api=apiObject, width=1280, height=800, confirm_close=True)
    else:
        window.load_url(consts.homeEntry)
    return window

def mainloop(window):
    window.load_url(consts.homeEntry)


################################################################################
class ApiBase:
    def __init__(self, clientId='', clientUserAgent='', _logging=consts.IS_LOGGING):
        self._logging = _logging
        self.themeType = 'dark'
        self.clientId = clientId
        self.clientUserAgent = clientUserAgent
        self.backendHost = 'http://127.0.0.1:19790'
        self.signInMessage = ''

    def callApi(self, functionName, args=None):
        if self._logging: print('ApiBase.callApi', self.clientId, functionName)
        if hasattr(self, functionName):
            function = getattr(self, functionName)
            if callable(function):
                try:
                    if args != None:
                        return function(args)
                    else:
                        return function()
                except Exception as e:
                    return {'errinfo': "Failed: (%s) %s" % (functionName, str(e))}
        return {'errinfo': "Api not found: %s" % functionName}

    def setTheme(self, params):
        self.themeType = (params or {}).get('type', self.themeType)

    def isDesktopVersion(self):
        return self.clientUserAgent.find('Oysape') >= 0


class ApiOauth(ApiBase):
    userToken = ''
    userSession = {}

    def signInWithEmail(self, params):
        self.backendHost = params.get('obh', self.backendHost)
        return auth.openOAuthWindow('email', self.clientId, self.clientUserAgent, self.backendHost)

    def signInWithGithub(self, params):
        self.backendHost = params.get('obh', self.backendHost)
        return auth.openOAuthWindow('github', self.clientId, self.clientUserAgent, self.backendHost)

    def signInWithGoogle(self, params):
        self.backendHost = params.get('obh', self.backendHost)
        return auth.openOAuthWindow('google', self.clientId, self.clientUserAgent, self.backendHost)

    def signout(self, params={}):
        retval = tools.callServerApiPost('/signout', {}, self)
        if not retval.get('errinfo'):
            self.userToken = ''
            self.userSession = {}
        return retval


class ApiOysape(ApiOauth):
    listFolder = []
    listExclude = []

    def testApi(self, params):
        # print('ApiOysape.testApi', params)
        return {'errinfo': 'test called'}

    def hasPermission(self, params):
        # Return True if the user has permission indicated by params.perm
        perm = params.get('perm') if isinstance(params, dict) else params
        return self.userSession['accesses'].get(perm, False)

    def gotoAccountDashboard(self, params):
        retval = tools.callServerApiPost('/user/landing', {}, self)
        if retval and retval.get('otp'):
            return auth.openAccountDashboard(retval.get('otp'), self.clientUserAgent, self.backendHost)
        elif retval and retval.get('errinfo'):
            return retval

    def reloadUserSession(self, params={}):
        if not self.userToken and params.get('token'):
            self.userToken = params.get('token')
        if self.userToken:
            retval = tools.callServerApiPost('/user/test', {}, self)
            if retval and not retval.get('errinfo'):
                ff = retval.get('folders', []) or []
                ee = retval.get('excludes', []) or consts.defaultExclude
                self.userSession = retval
                self.listFolder = ff
                self.listExclude = ee
                self.userSession['clientId'] = self.clientId
                return self.userSession
            else:
                self.userToken = ''
                return retval
        else:
            # No token. Return empty session. The frontend will show the sign in buttons and stop the loading.
            return {}

    def switchToTeam(self, params):
        if not params.get('tid'): return {"errinfo": "No team"}
        retval = tools.callServerApiPost('/user/team', {'tid': params.get('tid')}, self)
        if retval and not retval.get('errcode'):
            ff = retval.get('folders', []) or []
            ee = retval.get('excludes', []) or consts.defaultExclude
            self.userSession = retval
            self.listFolder = ff
            self.listExclude = ee
            self.userSession['clientId'] = self.clientId
            return self.userSession
        return retval

    def addServer(self, params):
        # Return server list in {'servers': []}
        if params.get('prikey') and not os.path.isfile(os.path.expanduser(params.get('prikey'))):
            return {"errinfo": "Private key file not found: %s" % params.get('prikey')}
        return self.importTo({'what': 'servers', 'items': [params]})

    def deleteServer(self, params):
        # Return server list in {'servers': []}
        if not self.hasPermission('writable'): return {"errinfo": "Writable access denied"}
        retval = tools.callServerApiDelete('/user/servers', {'key': params.get('key')}, self)
        self.userSession['servers'] = retval.get('servers') or []
        return retval

    def getTaskObject(self, taskKey):
        taskObj = [x for x in self.userSession['tasks'] if x.get('name') == taskKey]
        taskObj = taskObj[0] if taskObj else {}
        return taskObj

    def getTaskCommands(self, taskKey):
        taskObj = self.getTaskObject(taskKey)
        if not taskObj: return []
        return json.loads(json.dumps(taskObj.get('cmds') or []))

    def addTask(self, params):
        # Return task list in {'tasks': []}
        retval = self.importTo({'what': 'tasks', 'items': [params]})
        # pipelines may be updated if a updated task is refered in a pipeline
        if retval.get('pipelines'):
            self.userSession['pipelines'] = retval.get('pipelines')
        return retval

    def deleteTask(self, params):
        # Return task list in {'tasks': []}
        if not self.hasPermission('writable'): return {"errinfo": "Writable access denied"}
        retval = tools.callServerApiDelete('/user/tasks', {'key': params.get('key')}, self)
        self.userSession['tasks'] = retval.get('tasks') or []
        return retval

    def getPipelineObject(self, pipeName):
        pipeObj = [x for x in self.userSession['pipelines'] if x.get('name') == pipeName]
        pipeObj = pipeObj[0] if pipeObj else {}
        return pipeObj

    def getPipelineSteps(self, pipeName):
        pipeObject = self.getPipelineObject(pipeName)
        return json.loads(json.dumps(pipeObject.get('steps') or []))

    def addPipeline(self, params):
        # Return pipeline list in {'pipelines': []}
        return self.importTo({'what': 'pipelines', 'items': [params]})

    def deletePipeline(self, params):
        # Return pipeline list in {'pipelines': []}
        if not self.hasPermission('writable'): return {"errinfo": "Writable access denied"}
        retval = tools.callServerApiDelete('/user/pipelines', {'key': params.get('key')}, self)
        self.userSession['pipelines'] = retval.get('pipelines') or []
        return retval

    def importTo(self, params={}):
        # Import servers, tasks, pipelines
        if not self.hasPermission('writable'): return {"errinfo": "Writable access denied"}
        what = params.get('what')
        objs = {
            'servers': self.userSession['servers'],
            'tasks': self.userSession['tasks'],
            'pipelines': self.userSession['pipelines'],
            'folders': self.listFolder,
            'excludes': self.listExclude,
        }
        if what not in objs.keys():
            return {"errinfo": "Invalid operation"}
        try:
            import_list = params.get('items')
            if import_list is None:
                if self.isDesktopVersion():
                    fname = self.choose_file_read()
                    if fname:
                        with open(fname, 'r') as f1:
                            import_list = json.load(f1)
                elif params.get('filename'):
                    fname = params.get('filename')
                    if os.path.isfile(fname):
                        with open(fname, 'r') as f1:
                            import_list = json.load(f1)
                else:
                    return {"errinfo": "Please give a file to import"}
            if isinstance(import_list, list):
                retval = tools.callServerApiPost('/user/'+what, {what: import_list}, self)
                if retval and retval.get('errinfo'):
                    return retval
                return_list = retval.get(what, []) or []
                objs[what].clear()
                objs[what].extend(return_list)
                return retval
            return {}
        except Exception as e:
            traceback.print_exc()
            return {"errinfo": str(e)}

    def exportFrom(self, params={}):
        # Export servers, tasks, pipelines, folders, excludes
        if not self.hasPermission('writable'): return {"errinfo": "Writable access denied"}
        what = params.get('what')
        objs = {
            'servers': self.userSession['servers'],
            'tasks': self.userSession['tasks'],
            'pipelines': self.userSession['pipelines'],
            'folders': self.listFolder,
            'excludes': self.listExclude,
        }
        if what not in objs.keys():
            return {"errinfo": "Invalid operation"}
        try:
            if self.isDesktopVersion():
                fname = self.choose_file_write()
                if fname:
                    with open(fname, 'w') as f1:
                        json.dump(objs[what], f1, indent=4)
            elif params.get('filename'):
                fname = params.get('filename')
                if os.path.isfile(fname):
                    with open(fname, 'w') as f1:
                        json.dump(objs[what], f1, indent=4)
            else:
                return {"errinfo": "Please give a file to export"}
        except Exception as e:
            return {"errinfo": str(e)}

class ApiTerminal(ApiOysape):
    terminalConnections = {}

    def createTermConnection(self, params):
        if not self.hasPermission('terminal'): return {"errinfo": "Terminal access denied"}
        from . import sshutils
        serverKey = params.get('serverKey')
        uniqueKey = params.get('uniqueKey')
        taskKey = params.get('taskKey')
        if not self.userSession.get('servers'):
            return {"errinfo": "Session expired, please re-open the app."}
        slist = [x for x in self.userSession['servers'] if x["key"] == serverKey]
        if len(slist) == 0:
            return {"errinfo": "Server not found"}
        if not uniqueKey in self.terminalConnections:
            if self._logging: print('createTermConnection', slist)
            try:
                conn_str = sshutils.create_ssh_string(slist[0].get("address"), slist[0].get("username"), slist[0].get("port"))
                self.terminalConnections[uniqueKey] = sshutils.TerminalClient(conn_str, private_key=slist[0].get("prikey"), serverKey=serverKey, parentApi=self, uniqueKey=uniqueKey, startup=slist[0].get("tasks"))
                if not self.terminalConnections[uniqueKey].client:
                    self.terminalConnections[uniqueKey].onChannelString(tools.colorizeText(self.terminalConnections[uniqueKey].message,'red'))
                elif taskKey:
                    taskObj = self.getTaskObject(taskKey)
                    taskCmds = self.getTaskCommands(taskKey)
                    self.execTask(taskKey, taskObj, taskCmds, self.terminalConnections[uniqueKey])
            except Exception as e:
                traceback.print_exc()
                print('createTermConnection', e)
                return {"errinfo": str(e)}

    def closeTermConnection(self, params={}):
        uniqueKey = params.get('uniqueKey')
        if self.terminalConnections.get(uniqueKey):
            if self._logging: print('closeTermConnection', uniqueKey)
            self.terminalConnections[uniqueKey].close()
            del self.terminalConnections[uniqueKey]

    def closeAllTerminals(self, params={}):
        v1 = self.terminalConnections.keys()
        for uniqueKey in v1:
            self.closeTermConnection({'uniqueKey':uniqueKey})

    def resizeTermChannel(self, params):
        uniqueKey, width, height = params.get('uniqueKey'), params.get('cols'), params.get('rows')
        if self.terminalConnections.get(uniqueKey):
            self.terminalConnections[uniqueKey].resizeChannel(width, height)

    def sendTerminalInput(self, params):
        uniqueKey = params.get('uniqueKey')
        input = params.get('input')
        if uniqueKey in self.terminalConnections:
            self.terminalConnections[uniqueKey].send_to_channel(input)

    def execTask(self, taskKey, taskObj, taskCmds, client, output=True):
        bgColor = 'gray' if self.themeType == 'dark' else 'white'
        if not taskObj:
            client.onChannelString((CRLF+'No such task defined: %s'%taskKey+CRLF))
        elif taskObj.get('interaction') == 'upload':
            # Upload a file/directory
            if output: client.onChannelString((CRLF+CRLF+tools.colorizeText('Task: %s @%s'%(taskKey, client.serverKey), 'cyan', bgColor)+CRLF))
            if taskObj.get('source') and taskObj.get('destination'):
                retdata = client.upload(taskObj.get('source'), taskObj.get('destination'), taskObj.get('excludes'))
                number, transfered = retdata.get('count', 0), retdata.get('size', 0)
                if output:
                    if retdata.get('errinfo'):
                        client.onChannelString((CRLF+tools.colorizeText(retdata.get('errinfo'), 'red')+CRLF))
                    client.onChannelString(CRLF+'Uploaded %s file(s). %s transfered'%(number, tools.convert_bytes(transfered))+CRLF)
            else:
                client.onChannelString((CRLF+'No source or destination defined: %s'%taskObj.get('name')+CRLF))
        elif taskObj.get('interaction') == 'download':
            # Download a file/directory
            if output: client.onChannelString((CRLF+CRLF+tools.colorizeText('Task: %s @%s'%(taskKey, client.serverKey), 'cyan', bgColor)+CRLF))
            if taskObj.get('source') and taskObj.get('destination'):
                retdat = client.download(taskObj.get('source'), taskObj.get('destination'), taskObj.get('excludes'))
                number, transfered = retdat.get('count', 0), retdat.get('size', 0)
                if output:
                    if retdata.get('errinfo'):
                        client.onChannelString((CRLF+tools.colorizeText(retdata.get('errinfo'), 'red')+CRLF))
                    client.onChannelString(CRLF+'Downloaded %s file(s). %s transfered'%(number, tools.convert_bytes(transfered))+CRLF)
            else:
                client.onChannelString((CRLF+'No source or destination defined: %s'%taskObj.get('name')+CRLF))
        elif not taskCmds:
            client.onChannelString((CRLF+'No commands defined: %s'%taskKey+CRLF))
        else:
            # Execute the task's commands
            runmode = taskObj.get('runmode') or ''
            if output and runmode!='script': client.onChannelString((CRLF+CRLF+tools.colorizeText('Task: %s @%s'%(taskKey, client.serverKey), 'cyan', bgColor)+CRLF))
            if runmode.startswith('batch'):
                # Send commands to the channel once for all
                str_join = '&' if platform.system() == 'Windows' else ' && '
                command = (str_join if runmode.endswith('join') else LF).join(taskCmds)
                if len(taskCmds)>1 and runmode.endswith('escape'):
                    command = es_home + command + es_end
                if self._logging: print('execTask', client.serverKey, json.dumps(command))
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
                    if self._logging: print('execTask', client.serverKey, taskKey)
                    client.client.exec_command(f'chmod +x ~/.oysape/cache/%s'%filename)
                    client.send_to_channel('source ~/.oysape/cache/%s'%filename+LF, human=False)
            else:
                # Send commands to the channel line-by-line
                if self._logging: print('execTask', client.serverKey, json.dumps(taskCmds))
                while taskCmds:
                    data = taskCmds.pop(0)
                    data = data.strip()+LF
                    if data.strip() and not data.startswith('#'):
                        client.send_to_channel(data, human=False)
                        time.sleep(0.01)

class ApiWorkspace(ApiTerminal):
    workspaceWorkingChannel = ''
    combinedConnections = {}

    def createCombConnection(self, serverKey):
        from . import sshutils
        slist = [x for x in self.userSession['servers'] if x["key"] == serverKey]
        if len(slist) == 0:
            return {"errinfo": "Server not found"}
        if not serverKey in self.combinedConnections:
            if self._logging: print('createCombConnection', serverKey)
            try:
                conn_str = sshutils.create_ssh_string(slist[0].get("address"), slist[0].get("username"), slist[0].get("port"))
                self.combinedConnections[serverKey] = sshutils.WorkspaceClient(conn_str, private_key=slist[0].get("prikey"), serverKey=serverKey, parentApi=self, uniqueKey='workspace', startup=slist[0].get("tasks"))
            except Exception as e:
                traceback.print_exc()
                print('createCombConnection', serverKey, e)
                return {'errinfo': str(e)}

    def closeCombConnections(self, params={}):
        for serverKey in self.combinedConnections.keys():
            if self._logging: print('closeCombConnections', serverKey)
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
            self.combinedConnections[serverKey].send_to_channel(input)

    def taskOnServer(self, taskKey, serverKey):
        needNewLine = True
        if not serverKey in self.combinedConnections:
            ret1 = self.createCombConnection(serverKey)
            if ret1 and ret1.get('errinfo'): return ret1
            needNewLine = False
        if self.combinedConnections.get(serverKey) and self.combinedConnections[serverKey].running:
            if needNewLine:
                self.combinedConnections[serverKey].send_to_channel(LF, human=False)
            taskObj = self.getTaskObject(taskKey)
            taskCmds = self.getTaskCommands(taskKey)
            # Set the workspace's current server if want the workspace to be interactive
            if taskObj.get('interaction') in ('interactive', 'terminal'):
                if self.hasPermission('terminal'):
                    self.workspaceWorkingChannel = serverKey
                    self.combinedConnections[serverKey].updateWorkspaceTabTitle(self.workspaceWorkingChannel)
                else:
                    self.combinedConnections[serverKey].onChannelString((CRLF+CRLF+tools.colorizeText('This task is designated as interactive; however, you lack the permission to interact with terminals. It will still execute, but you will be unable to interact with it.', 'yellow') + CRLF+CRLF))
                    self.workspaceWorkingChannel = ''
                    self.combinedConnections[serverKey].updateWorkspaceTabTitle(self.workspaceWorkingChannel)
            else:
                self.workspaceWorkingChannel = ''
                self.combinedConnections[serverKey].updateWorkspaceTabTitle(self.workspaceWorkingChannel)
            self.execTask(taskKey, taskObj, taskCmds, self.combinedConnections[serverKey])
        elif self.combinedConnections[serverKey].message:
            outmsg = tools.colorizeText(serverKey,None,'gray') + ' ' + tools.colorizeText(self.combinedConnections[serverKey].message,'red')
            self.combinedConnections[serverKey].onChannelString(outmsg)

    def testIfTaskCanRunOnServer(self, params):
        taskKey, serverKey = params.get('taskKey'), params.get('serverKey')
        if not serverKey in self.combinedConnections:
            return True
        if not self.combinedConnections[serverKey].areAllTasksDone():
            return False
        return True

    def testIfPipelineCanRun(self, params):
        pipeName = params.get('pipelineName')
        steps = self.getPipelineSteps(pipeName)
        steps = merge_steps(steps)
        for step in steps:
            serverKey = step['target']
            tasks = step['tasks']
            for taskKey in tasks:
                if not self.testIfTaskCanRunOnServer({'taskKey': taskKey, 'serverKey': serverKey}):
                    return False
        return True

    def callTask(self, params):
        taskKey, serverKey = params.get('taskKey'), params.get('serverKey')
        if not self.testIfTaskCanRunOnServer({'taskKey': taskKey, 'serverKey': serverKey}):
            self.combinedConnections[serverKey].onChannelString(tools.colorizeText(LF+'Waiting for tasks to finish...', 'red'))
            return {}
        return self.taskOnServer(taskKey, serverKey)

    def callPipeline(self, params):
        pipeName = params.get('pipelineName')
        steps = self.getPipelineSteps(pipeName)
        steps = merge_steps(steps)
        for step in steps:
            serverKey = step['target']
            tasks = step['tasks']
            for taskKey in tasks:
                if not self.testIfTaskCanRunOnServer({'taskKey': taskKey, 'serverKey': serverKey}):
                    self.combinedConnections[serverKey].onChannelString(tools.colorizeText(LF+'Waiting for tasks to finish...', 'red'))
                    return
        if self._logging: print('execPipeline', pipeName)
        for step in steps:
            serverKey = step['target']
            tasks = step['tasks']
            for taskKey in tasks:
                self.taskOnServer(taskKey, serverKey)
            while True: # Wait for all tasks on current server to finish
                if self.combinedConnections.get(serverKey) and self.combinedConnections[serverKey].areAllTasksDone():
                    break
                time.sleep(0.5)


class ApiSftp(ApiWorkspace):
    def sftpGetFileTree(self, params={}):
        if not self.hasPermission('sftp'): return {'errinfo': 'SFTP access denied'}
        serverKey = params.get('target')
        thisPath = params.get('path') or '/'
        if not serverKey in self.combinedConnections:
            ret1 = self.createCombConnection(serverKey)
            if ret1 and ret1.get('errinfo'): return ret1
        if not serverKey in self.combinedConnections:
            return {'errinfo': 'SSH connection not found'}
        retval = self.combinedConnections[serverKey].getServerFiles(thisPath)
        return retval

    def open_remote_file(self, params={}):
        if not self.hasPermission('sftp'): return {'errinfo': 'SFTP access denied'}
        serverKey = params.get('target')
        thisPath = params.get('path') or '/'
        if not serverKey in self.combinedConnections:
            ret1 = self.createCombConnection(serverKey)
            if ret1 and ret1.get('errinfo'): return ret1
        if not serverKey in self.combinedConnections:
            return {'errinfo': 'SSH connection not found'}
        retval = self.combinedConnections[serverKey].open_remote_file(thisPath)
        return retval

    def save_remote_file(self, params={}):
        if not self.hasPermission('sftp'): return {'errinfo': 'SFTP access denied'}
        serverKey = params.get('target')
        thisPath = params.get('path') or '/'
        content = params.get('content')
        if not serverKey in self.combinedConnections:
            ret1 = self.createCombConnection(serverKey)
            if ret1 and ret1.get('errinfo'): return ret1
        if not serverKey in self.combinedConnections:
            return {'errinfo': 'SSH connection not found'}
        retval = self.combinedConnections[serverKey].save_remote_file(thisPath, content)
        return retval

    def download_remote_file(self, params={}):
        if not self.hasPermission('sftp'): return {'errinfo': 'SFTP access denied'}
        serverKey = params.get('target')
        thisPath = params.get('path')
        if not serverKey in self.combinedConnections:
            ret1 = self.createCombConnection(serverKey)
            if ret1 and ret1.get('errinfo'): return ret1
        if not serverKey in self.combinedConnections:
            return {'errinfo': 'SSH connection not found'}
        if self.isDesktopVersion():
            import webview
            foldername = webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG)
            if foldername and foldername[0]:
                retdata = self.combinedConnections[serverKey].download(thisPath, foldername[0])
                number, transfered = retdata.get('count',0), retdata.get('size',0)
                self.combinedConnections[serverKey].onChannelString(CRLF+'Downloaded %s file(s). %s transfered'%(number, tools.convert_bytes(transfered))+CRLF)
                return retdata
        else:
            retdat = self.open_remote_file(params)
            return retdat

    def upload_remote_file(self, params={}):
        if not self.hasPermission('sftp'): return {'errinfo': 'SFTP access denied'}
        serverKey = params.get('target')
        thisPath = params.get('path')
        if not serverKey in self.combinedConnections:
            ret1 = self.createCombConnection(serverKey)
            if ret1 and ret1.get('errinfo'): return ret1
        if not serverKey in self.combinedConnections:
            return {'errinfo': 'SSH connection not found'}
        if self.isDesktopVersion():
            import webview
            filename = webview.windows[0].create_file_dialog(webview.OPEN_DIALOG)
            if filename and filename[0]:
                retdata = self.combinedConnections[serverKey].upload(filename[0], os.path.join(thisPath, os.path.basename(filename[0])))
                number, transfered = retdata.get('count',0), retdata.get('size',0)
                self.combinedConnections[serverKey].onChannelString(CRLF+'Uploaded %s file(s). %s transfered'%(number, tools.convert_bytes(transfered))+CRLF)
                return retdata
        else:
            filename = params.get('filename')
            if filename:
                return self.save_remote_file({'target': serverKey, 'path': os.path.join(thisPath,filename), 'content': base64.b64decode(params.get('filebody'))})

    def upload_remote_folder(self, params={}):
        if not self.hasPermission('sftp'): return {'errinfo': 'SFTP access denied'}
        serverKey = params.get('target')
        thisPath = params.get('path')
        if not serverKey in self.combinedConnections:
            ret1 = self.createCombConnection(serverKey)
            if ret1 and ret1.get('errinfo'): return ret1
        if not serverKey in self.combinedConnections:
            return {'errinfo': 'SSH connection not found'}
        if self.isDesktopVersion():
            import webview
            foldername = webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG)
            if foldername and foldername[0]:
                retdata = self.combinedConnections[serverKey].upload(foldername[0], thisPath)
                number, transfered = retdata.get('count',0), retdata.get('size',0)
                self.combinedConnections[serverKey].onChannelString(CRLF+'Uploaded %s file(s). %s transfered'%(number, tools.convert_bytes(transfered))+CRLF)
                return retdata
        else:
            return {'errinfo': 'Desktop version only'}


class ApiDockerManager(ApiSftp):
    def dockerGetWholeTree(self, params={}):
        if not self.hasPermission('docker'): return {'errinfo': 'Docker access denied'}
        serverKey = params.get('target')
        if not serverKey in self.combinedConnections:
            ret1 = self.createCombConnection(serverKey)
            if ret1 and ret1.get('errinfo'): return ret1
        if not serverKey in self.combinedConnections:
            return {'errinfo': 'SSH connection not found'}
        return self.combinedConnections[serverKey].dockerGetWholeTree()
    def dockerGetTreeNode(self, params={}):
        if not self.hasPermission('docker'): return {'errinfo': 'Docker access denied'}
        serverKey = params.get('target')
        nodeKey = params.get('nodeKey')
        if not serverKey in self.combinedConnections:
            ret1 = self.createCombConnection(serverKey)
            if ret1 and ret1.get('errinfo'): return ret1
        if not serverKey in self.combinedConnections:
            return {'errinfo': 'SSH connection not found'}
        if nodeKey and nodeKey.endswith('_docker_containers'):
            return self.combinedConnections[serverKey].dockerGetContainers()
        elif nodeKey and nodeKey.endswith('_docker_images'):
            return self.combinedConnections[serverKey].dockerGetImages()
        elif nodeKey and nodeKey.endswith('_docker_composes'):
            return self.combinedConnections[serverKey].dockerGetComposes()
        else:
            return {'errinfo': 'Invalid node'}
    def dockerExecCommand(self, params={}):
        if not self.hasPermission('docker'): return {'errinfo': 'Docker access denied'}
        serverKey = params.get('target')
        command = params.get('command')
        if not serverKey in self.combinedConnections:
            ret1 = self.createCombConnection(serverKey)
            if ret1 and ret1.get('errinfo'): return ret1
        if not serverKey in self.combinedConnections:
            return {'errinfo': 'SSH connection not found'}
        # Build a virtual Task to run the command
        interaction = 'interaction' if self.hasPermission('terminal') else ''
        if interaction:
            self.workspaceWorkingChannel = serverKey
            self.combinedConnections[serverKey].updateWorkspaceTabTitle(self.workspaceWorkingChannel)
        self.execTask('docker', {'interaction':interaction}, [command], self.combinedConnections[serverKey], output=params.get('output', False))
        while not self.combinedConnections[serverKey].areAllTasksDone():
            time.sleep(0.1)
    def dockerSetDockerCommand(self, params={}):
        if not self.hasPermission('docker'): return {'errinfo': 'Docker access denied'}
        serverKey = params.get('target')
        command = params.get('command')
        if not serverKey in self.combinedConnections:
            ret1 = self.createCombConnection(serverKey)
            if ret1 and ret1.get('errinfo'): return ret1
        if not serverKey in self.combinedConnections:
            return {'errinfo': 'SSH connection not found'}
        self.combinedConnections[serverKey].dockerCommandPrefix = command
        #TODO: save the docker command path on the server
    def dockerSetComposeCommand(self, params={}):
        if not self.hasPermission('docker'): return {'errinfo': 'Docker access denied'}
        serverKey = params.get('target')
        command = params.get('command')
        if not serverKey in self.combinedConnections:
            ret1 = self.createCombConnection(serverKey)
            if ret1 and ret1.get('errinfo'): return ret1
        if not serverKey in self.combinedConnections:
            return {'errinfo': 'SSH connection not found'}
        self.combinedConnections[serverKey].dockerComposePrefix = command
        #TODO: save the docker command path on the server


class ApiOverHttp(ApiDockerManager):
    socketConnections = {}


class ApiDesktop(ApiOverHttp):
    def get_token(self):
        import webview
        for c in webview.windows[0].get_cookies():
            if 'client_token' in c:
                apiInstances[webview.token].userToken = c['client_token'].value
                break
        return {'token': apiInstances[webview.token].userToken} if apiInstances[webview.token].userToken else {}

    def querySigninResult(self, params={}):
        outmsg = self.signInMessage
        self.signInMessage = ''
        return {'token': self.userToken, 'errinfo': outmsg}

    def toggle_fullscreen(self):
        import webview
        webview.windows[0].toggle_fullscreen()

    def choose_file_read(self, params={}):
        if self.isDesktopVersion():
            import webview
            filename = webview.windows[0].create_file_dialog(webview.OPEN_DIALOG)
            return filename[0] if filename else ''
        else:
            return ''

    def choose_file_write(self, params={}):
        if self.isDesktopVersion():
            import webview
            filename = webview.windows[0].create_file_dialog(webview.SAVE_DIALOG)
            return filename
        else:
            return ''

    def get_absolute_path(self, params):
        tpath = params.get('path', '')
        if os.path.isfile(tpath):
            return os.path.abspath(tpath)
        elif os.path.isfile(os.path.expanduser(tpath)):
            return os.path.abspath(os.path.expanduser(tpath))
        else:
            folders = [x for x in self.listFolder if x.get('path')]
            for folder in folders:
                apath = os.path.join(os.path.split(folder['path'])[0], tpath)
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
        try:
            with open(path, 'w') as f:
                f.write(content)
            return {}
        except Exception as e:
            return {'errinfo': str(e)}

    def getFolderFiles(self, params={}):
        retval = []
        exclude = [x for x in self.listExclude if x and x.strip()]
        exclude = [patten for item in exclude for patten in item.split(' ') if patten]
        ignore = lambda x,y: any([fnmatch.fnmatch(x, patten) for patten in y])
        folders = [x for x in self.listFolder if x.get('path')]
        folders = [{"root":True, "title":os.path.basename(x['path']), "key":tools.get_key(x['path']), "path":x['path'], "children":get_files(x['path'], True, exclude+(x.get('exclude') or []), ignore)} for x in folders if x.get('path') and not ignore(x['path'],exclude)]
        retval.extend(folders)
        return retval

    def addFolder(self, params={}):
        if self.isDesktopVersion():
            import webview
            foldername = webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG)
            if foldername and foldername[0] and foldername[0] not in [x['path'] for x in self.listFolder]:
                self.listFolder.append({'path':foldername[0]})
                self.importTo({'what': 'folders', 'items': self.listFolder})
            return {'folderFiles':self.getFolderFiles()}
        else:
            return {'errinfo': "Please give a folder to add"}

    def removeFolder(self, params={}):
        path = params.get('path', '')
        self.listFolder = [x for x in self.listFolder if x.get('path') != path]
        self.importTo({'what': 'folders', 'items': self.listFolder})
        return {'folderFiles':self.getFolderFiles()}

    def addExcludeToFolder(self, params={}):
        path = params.get('path', '')
        for item in self.listFolder:
            if path.startswith(item['path']):
                item['exclude'] = item.get('exclude') or []
                item['exclude'].append(os.path.basename(path))
        self.importTo({'what': 'folders', 'items': self.listFolder})
        return {'folderFiles':self.getFolderFiles()}

    def getGlobalExcludes(self, params={}):
        return self.listExclude

    def updateGlobalExcludes(self, params={}):
        self.listExclude = params.get('excludes') or []
        self.importTo({'what': 'excludes', 'items': self.listExclude})
        return {'folderFiles':self.getFolderFiles()}

    def addWebHost(self, params={}):
        obh = params.get('obh')
        retval = tools.callServerApiPost('/user/webhost', {'obh': obh}, self)
        if retval and not retval.get('errinfo'):
            return self.update_session(retval)
        else:
            return retval

    def deleteWebHost(self, params={}):
        obh = params.get('obh')
        retval = tools.callServerApiDelete('/user/webhost', {'obh': obh}, self)
        if retval and not retval.get('errinfo'):
            return self.update_session(retval)
        else:
            return retval

    def uninstallWebHost(self, params={}):
        obh = params.get('obh')
        sobj = [x for x in self.userSession['sites'] if x['obh']==obh]
        if not sobj: return {'errinfo': 'Site not found'}
        if not sobj[0].get('target'): return {'errinfo': 'Target not found'}
        serverKey = sobj[0]['target']
        try:
            if not serverKey in self.combinedConnections:
                ret1 = self.createCombConnection(serverKey)
                if ret1 and ret1.get('errinfo'): return ret1
            if not serverKey in self.combinedConnections:
                return {'errinfo': 'SSH connection not found'}
            # Check the docker environment
            if self.combinedConnections[serverKey].dockerCommandPrefix == None:
                self.combinedConnections[serverKey].onChannelString((CRLF+'Checking docker environment...'+CRLF))
                retval = self.combinedConnections[serverKey].dockerCheckEnv()
                if retval and retval.get('errinfo'): return retval
            self.combinedConnections[serverKey].onChannelString((CRLF+'Removing webhost container...'+CRLF))
            self.combinedConnections[serverKey].execute_command(self.combinedConnections[serverKey].dockerCommandPrefix + 'docker rm -f oysape-webhost')
            self.combinedConnections[serverKey].execute_command(self.combinedConnections[serverKey].dockerCommandPrefix + 'docker rmi -f dongyg/oysape-webhost')
            retval = tools.callServerApiDelete('/user/webhost/verify', {'obh': obh, 'target': serverKey}, self)
            self.combinedConnections[serverKey].onChannelString((CRLF+'Webhost uninstalled'+CRLF))
            return retval
            return {}
        except Exception as e:
            return {'errinfo': str(e)}

    def installWebHost(self, params={}):
        obh = params.get('obh')
        serverKey = params.get('target')
        try:
            # Check the ssh connection
            if not serverKey in self.combinedConnections:
                ret1 = self.createCombConnection(serverKey)
                if ret1 and ret1.get('errinfo'): return ret1
            if not serverKey in self.combinedConnections:
                return {'errinfo': 'SSH connection not found'}
            # Check the docker environment
            if self.combinedConnections[serverKey].dockerCommandPrefix == None:
                self.combinedConnections[serverKey].onChannelString((CRLF+'Checking docker environment...'))
                retval = self.combinedConnections[serverKey].dockerCheckEnv()
                if retval and retval.get('errinfo'): return retval
            # Remove the container and the image first
            self.combinedConnections[serverKey].onChannelString((CRLF+'Removing webhost container...'))
            retcmd = self.combinedConnections[serverKey].execute_command(self.combinedConnections[serverKey].dockerCommandPrefix + 'docker rm -f oysape-webhost')
            self.combinedConnections[serverKey].onChannelString((CRLF+retcmd))
            self.combinedConnections[serverKey].execute_command(self.combinedConnections[serverKey].dockerCommandPrefix + 'docker rmi -f dongyg/oysape-webhost')
            self.combinedConnections[serverKey].onChannelString((CRLF+retcmd))
            # Run the container
            self.combinedConnections[serverKey].onChannelString((CRLF+'Running webhost container...'))
            oneTimeSecret = tools.getRandomString(60)
            cmd1 = self.combinedConnections[serverKey].dockerCommandPrefix + 'docker run --name oysape-webhost -p 19790:19790 -e WEBHOST_CONFIG=' + oneTimeSecret+'@'+obh + ' -v /var/run/docker.sock:/var/run/docker.sock -v ~/.ssh:/root/.ssh -itd dongyg/oysape-webhost'
            # self.dockerExecCommand({'command': cmd1, 'target': serverKey, 'output': True})
            retcmd = self.combinedConnections[serverKey].execute_command(cmd1)
            self.combinedConnections[serverKey].onChannelString((CRLF+retcmd))
            # Config the webhost
            self.combinedConnections[serverKey].onChannelString((CRLF+'Configuring webhost...'))
            cmd2 = self.combinedConnections[serverKey].dockerCommandPrefix + 'docker exec oysape-webhost python src/webhost-setup.py --obh=' + obh
            retcmd = self.combinedConnections[serverKey].execute_command(cmd2)
            self.combinedConnections[serverKey].onChannelString((CRLF+retcmd))
            cmd3 = self.combinedConnections[serverKey].dockerCommandPrefix + 'docker restart oysape-webhost'
            retcmd = self.combinedConnections[serverKey].execute_command(cmd3)
            self.combinedConnections[serverKey].onChannelString((CRLF+retcmd))
            # Save the secret
            retval = tools.callServerApiPost('/user/webhost', {'obh': obh, 'target': serverKey, 'secret': oneTimeSecret}, self)
            self.combinedConnections[serverKey].onChannelString((CRLF+'Webhost installed'+CRLF))
            return retval
        except Exception as e:
            return {'errinfo': str(e)}

    def verifyWebHost(self, params={}):
        obh = params.get('obh')
        retval = tools.callServerApiPost('/user/webhost/verify', {'obh': obh}, self)
        return retval


apiInstances = {}
