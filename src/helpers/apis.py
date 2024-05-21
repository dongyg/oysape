#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os, traceback, json, json, time, base64, fnmatch, platform, hmac, hashlib, logging
from . import auth, tools, consts, obhs

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
        window = webview.create_window('Oysape', consts.HOME_ENTRY, js_api=apiObject, width=1280, height=800, confirm_close=True)
    else:
        window.load_url(consts.HOME_ENTRY)
    return window

def mainloop(window):
    window.load_url(consts.HOME_ENTRY)


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
        logging.info((f'{self.__class__.__name__}.callApi', self.clientId, functionName))
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
        return self.clientUserAgent.find('OysapeDesktop') >= 0


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
        return (self.userSession.get('accesses',{}) or {}).get(perm, False)

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
                ee = retval.get('excludes', []) or consts.DEFAULT_EXCLUDE
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
            ee = retval.get('excludes', []) or consts.DEFAULT_EXCLUDE
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
                # If current user has webhost set, and those webhosts are verified, and the target is in servers. Save servers/tasks/pipelines to webhost target
                for site in (self.userSession.get('sites') or []):
                    serverKey = site.get('target')
                    if serverKey and site.get('verified') and site.get('target') in [x.get('key') for x in objs['servers']]:
                        filename = tools.get_key(self.userSession.get('tname'))+'.json'
                        self.save_remote_file({'target': serverKey, 'path': os.path.join('.oysape','teams',filename), 'content': json.dumps(objs)})
                        tools.callServerApiPost('/user/webhost/verify', {'obh': site.get('obh')}, self)
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
            return {"errinfo": "Session expired, please reload or re-open the app."}
        slist = [x for x in self.userSession['servers'] if x["key"] == serverKey]
        if len(slist) == 0:
            return {"errinfo": "Server not found"}
        if not uniqueKey in self.terminalConnections:
            logging.info(('createTermConnection', slist))
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
                logging.error(('createTermConnection', e))
                return {"errinfo": str(e)}

    def closeTermConnection(self, params={}):
        uniqueKey = params.get('uniqueKey')
        if self.terminalConnections.get(uniqueKey):
            logging.info(('closeTermConnection', uniqueKey))
            conn = self.terminalConnections.pop(uniqueKey)
            conn.close()

    def closeAllTerminals(self, params={}):
        while self.terminalConnections:
            uniqueKey, conn = self.terminalConnections.popitem()
            conn.close()

    def resizeTermChannel(self, params):
        uniqueKey, width, height = params.get('uniqueKey'), params.get('cols'), params.get('rows')
        if self.terminalConnections.get(uniqueKey):
            self.terminalConnections[uniqueKey].resizeChannel(width, height)

    def sendTerminalInput(self, params):
        uniqueKey = params.get('uniqueKey')
        input = params.get('input')
        if uniqueKey in self.terminalConnections:
            self.terminalConnections[uniqueKey].send_to_channel(input)

    def execTask(self, taskKey, taskObj, taskCmds, client, output=True, isSchedulerCall=False):
        bgColor = 'gray' if self.themeType == 'dark' else 'white'
        retval = ''
        def callOutput(message):
            nonlocal retval
            retval = retval + message
            client.onChannelString(message)
        if not taskObj:
            callOutput(CRLF+'No such task defined: %s'%taskKey+CRLF)
        elif taskObj.get('interaction') == 'upload':
            # Upload a file/directory
            if output: callOutput(CRLF+CRLF+tools.colorizeText('Task: %s @%s'%(taskKey, client.serverKey), 'cyan', bgColor)+CRLF)
            if taskObj.get('source') and taskObj.get('destination'):
                retdata = client.upload(taskObj.get('source'), taskObj.get('destination'), taskObj.get('excludes'))
                number, transfered = retdata.get('count', 0), retdata.get('size', 0)
                if output:
                    if retdata.get('errinfo'):
                        callOutput(CRLF+tools.colorizeText(retdata.get('errinfo'), 'red')+CRLF)
                    callOutput(CRLF+'Uploaded %s file(s). %s transfered'%(number, tools.convert_bytes(transfered))+CRLF)
            else:
                callOutput(CRLF+'No source or destination defined: %s'%taskObj.get('name')+CRLF)
        elif taskObj.get('interaction') == 'download':
            # Download a file/directory
            if output: callOutput(CRLF+CRLF+tools.colorizeText('Task: %s @%s'%(taskKey, client.serverKey), 'cyan', bgColor)+CRLF)
            if taskObj.get('source') and taskObj.get('destination'):
                retdat = client.download(taskObj.get('source'), taskObj.get('destination'), taskObj.get('excludes'))
                number, transfered = retdat.get('count', 0), retdat.get('size', 0)
                if output:
                    if retdata.get('errinfo'):
                        callOutput(CRLF+tools.colorizeText(retdata.get('errinfo'), 'red')+CRLF)
                    callOutput(CRLF+'Downloaded %s file(s). %s transfered'%(number, tools.convert_bytes(transfered))+CRLF)
            else:
                callOutput(CRLF+'No source or destination defined: %s'%taskObj.get('name')+CRLF)
        elif not taskCmds:
            callOutput(CRLF+'No commands defined: %s'%taskKey+CRLF)
        else:
            # Execute the task's commands
            runmode = taskObj.get('runmode') or ''
            if output and runmode!='script': callOutput(CRLF+CRLF+tools.colorizeText('Task: %s @%s'%(taskKey, client.serverKey), 'cyan', bgColor)+CRLF)
            if runmode.startswith('batch'):
                # Send commands to the channel once for all
                str_join = '&' if platform.system() == 'Windows' else ' && '
                command = (str_join if runmode.endswith('join') else LF).join(taskCmds)
                if len(taskCmds)>1 and runmode.endswith('escape'):
                    command = es_home + command + es_end
                logging.info(('execTask', client.serverKey, json.dumps(command)))
                if False: # isSchedulerCall:
                    callOutput(client.execute_command(command))
                else:
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
                    logging.info(('execTask', client.serverKey, taskKey))
                    client.client.exec_command(f'chmod +x ~/.oysape/cache/%s'%filename)
                    command = 'source ~/.oysape/cache/%s'%filename
                    if False: # isSchedulerCall:
                        callOutput(client.execute_command(command))
                    else:
                        client.send_to_channel(command + LF, human=False)
            else:
                # Send commands to the channel line-by-line
                logging.info(('execTask', client.serverKey, json.dumps(taskCmds)))
                while taskCmds:
                    command = taskCmds.pop(0)
                    command = command.strip()+LF
                    if command.strip() and not command.startswith('#'):
                        if False: # isSchedulerCall:
                            callOutput(client.execute_command(command))
                        else:
                            client.send_to_channel(command, human=False)
                            time.sleep(0.01)
        return retval

class ApiWorkspace(ApiTerminal):
    workspaceWorkingChannel = ''
    combinedConnections = {}

    def createCombConnection(self, serverKey):
        from . import sshutils
        slist = [x for x in self.userSession['servers'] if x["key"] == serverKey]
        if len(slist) == 0:
            return {"errinfo": "Server not found"}
        if not serverKey in self.combinedConnections:
            logging.info(('createCombConnection', serverKey))
            try:
                conn_str = sshutils.create_ssh_string(slist[0].get("address"), slist[0].get("username"), slist[0].get("port"))
                self.combinedConnections[serverKey] = sshutils.WorkspaceClient(conn_str, private_key=slist[0].get("prikey"), serverKey=serverKey, parentApi=self, uniqueKey='workspace', startup=slist[0].get("tasks"))
            except Exception as e:
                traceback.print_exc()
                logging.error(('createCombConnection', serverKey, e))
                return {'errinfo': str(e)}

    def closeCombConnections(self, params={}):
        for serverKey in self.combinedConnections.keys():
            logging.info(('closeCombConnections', serverKey))
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

    def taskOnServer(self, taskKey, serverKey, isSchedulerCall=False):
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
                    self.combinedConnections[serverKey].onChannelString(CRLF+CRLF+tools.colorizeText('This task is designated as interactive; however, you lack the permission to interact with terminals. It will still execute, but you will be unable to interact with it.', 'yellow') + CRLF+CRLF)
                    self.workspaceWorkingChannel = ''
                    self.combinedConnections[serverKey].updateWorkspaceTabTitle(self.workspaceWorkingChannel)
            else:
                self.workspaceWorkingChannel = ''
                self.combinedConnections[serverKey].updateWorkspaceTabTitle(self.workspaceWorkingChannel)
            return self.execTask(taskKey, taskObj, taskCmds, self.combinedConnections[serverKey], True, isSchedulerCall)
        elif self.combinedConnections[serverKey].message:
            self.combinedConnections[serverKey].onChannelString(tools.colorizeText(serverKey,None,'gray') + ' ' + tools.colorizeText(self.combinedConnections[serverKey].message,'red'))

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
        isSchedulerCall = params.get('obh') and params.get('sch')
        if not self.testIfTaskCanRunOnServer({'taskKey': taskKey, 'serverKey': serverKey}):
            if serverKey in self.combinedConnections:
                self.combinedConnections[serverKey].onChannelString(tools.colorizeText(LF+'Other tasks are currently running.', 'red'))
            return {}
        return self.taskOnServer(taskKey, serverKey, isSchedulerCall)

    def callPipeline(self, params):
        pipeName = params.get('pipelineName')
        steps = self.getPipelineSteps(pipeName)
        steps = merge_steps(steps)
        isSchedulerCall = params.get('obh') and params.get('sch')
        for step in steps:
            serverKey = step['target']
            tasks = step['tasks']
            for taskKey in tasks:
                if not self.testIfTaskCanRunOnServer({'taskKey': taskKey, 'serverKey': serverKey}):
                    if serverKey in self.combinedConnections:
                        self.combinedConnections[serverKey].onChannelString(tools.colorizeText(LF+'Other tasks are currently running.', 'red'))
                    return
        logging.info((time.time(), 'execPipeline', pipeName))
        retval = ''
        for step in steps:
            serverKey = step['target']
            tasks = step['tasks']
            for taskKey in tasks:
                retval += self.taskOnServer(taskKey, serverKey, isSchedulerCall)
            while True: # Wait for all tasks on current server to finish
                if serverKey in self.combinedConnections and self.combinedConnections[serverKey].areAllTasksDone():
                    break
                time.sleep(0.5)
        return retval

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


class ApiScheduler(ApiDockerManager):
    # This is for the web version scheduler
    teamName = ''

    def reloadUserSession(self, params={}):
        # Override the method reloadUserSession, load servers/tasks/pipelines from disk
        retval = {}
        filename = os.path.join(folder_base, 'teams', tools.get_key(self.teamName)+'.json')
        if os.path.isfile(filename):
            with open(filename, 'r') as f:
                retval = json.load(f)
        ff = retval.get('folders', []) or []
        ee = retval.get('excludes', []) or consts.DEFAULT_EXCLUDE
        self.userSession = retval
        self.listFolder = ff
        self.listExclude = ee
        self.userSession['clientId'] = self.clientId
        return self.userSession

    def createCombConnection(self, serverKey):
        # Override the method createCombConnection, use sshutils.SchedulerClient replace sshutils.WorkspaceClient
        # So all the tasks and pipelines output will be sent to another place.
        from . import sshutils
        slist = [x for x in self.userSession['servers'] if x["key"] == serverKey]
        if len(slist) == 0:
            return {"errinfo": "Server not found"}
        if not serverKey in self.combinedConnections:
            logging.info(('createCombConnection', serverKey))
            try:
                conn_str = sshutils.create_ssh_string(slist[0].get("address"), slist[0].get("username"), slist[0].get("port"))
                self.combinedConnections[serverKey] = sshutils.SchedulerClient(conn_str, private_key=slist[0].get("prikey"), serverKey=serverKey, parentApi=self, uniqueKey='workspace', startup=slist[0].get("tasks"))
            except Exception as e:
                traceback.print_exc()
                logging.info(('createCombConnection', serverKey, e))
                return {'errinfo': str(e)}

    def execQueryScheduleLogs(self, params={}):
        # params: obh, sch, page, pageSize
        # Execute query schedule logs
        obh = params.get('obh')
        sch = params.get('sch')
        page = tools.intget(params.get('page') or 1, 1)
        pageSize = tools.intget(params.get('pageSize') or 10, 10)
        # logging.info(('execQueryScheduleLogs', obh, sch, page, pageSize))
        dbpath = os.path.expanduser(os.path.join('~', '.oysape', 'scheduler.db'))
        logdb = tools.SQLiteDB(dbpath)
        # count
        sql_str = "SELECT COUNT(id) AS total FROM schedule_logs WHERE obh = ?"
        arg_arr = [obh]
        if sch:
            sql_str += " AND sch = ?"
            arg_arr.append(sch)
        total = logdb.query(sql_str, arg_arr)
        total = total[0].get('total')
        # query
        sql_str = "SELECT * FROM schedule_logs WHERE obh = ?"
        arg_arr = [obh]
        if sch:
            sql_str += " AND sch = ?"
            arg_arr.append(sch)
        sql_str += " ORDER BY id DESC LIMIT ? OFFSET ?"
        arg_arr.extend([pageSize, (page-1)*pageSize])
        retdat = logdb.query(sql_str, arg_arr)
        retdat = [{'key': x.get('id'), **x} for x in retdat]
        return {'list': retdat, 'total': total}

    def sendNotification(self, params={}):
        recipients = params.get('recipients')
        message = params.get('message')
        webhost_config = os.getenv('WEBHOST_CONFIG')
        if webhost_config and len(webhost_config.split('@'))==2:
            v1, v2 = webhost_config.split('@')
            obhs.keys[v2] = v1
        secret_key = obhs.keys.get(v2)
        if secret_key and recipients and message:
            ts = str(int(time.time()))
            nonce = tools.getRandomString(size=8)
            hmac_result = hmac.new(secret_key.encode('utf-8'), (nonce+ts).encode('utf-8'), hashlib.sha256)
            signature = hmac_result.hexdigest()
            custom_headers = {'nonce': nonce, 'timestamp': ts, 'signature': signature, 'obh': v2}
            params = {'recipients': recipients, 'title': params.get('title', ''), 'message': message, 'mid': params.get('mid', '')}
            return tools.send_post_request(consts.OYSAPE_HOST + consts.API_ROOT + '/notification', params, custom_headers)


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

    def update_session(self, params):
        self.userSession.update(params)
        return self.userSession

    def addWebHost(self, params={}):
        obh = params.get('obh')
        retval = tools.callServerApiPost('/user/webhosts', {'obh': obh}, self)
        if retval and not retval.get('errinfo'):
            return self.update_session(retval)
        else:
            return retval

    def deleteWebHost(self, params={}):
        obh = params.get('obh')
        retval = tools.callServerApiDelete('/user/webhosts', {'obh': obh}, self)
        if retval and not retval.get('errinfo'):
            return self.update_session(retval)
        else:
            return retval

    def uninstallWebHost(self, params={}):
        obh = params.get('obh')
        containerName = params.get('containerName') or 'oyhost'
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
                self.combinedConnections[serverKey].onChannelString((CRLF+'Checking docker environment...'))
                retval = self.combinedConnections[serverKey].dockerCheckEnv()
                if retval and retval.get('errinfo'): return retval
            retval = tools.callServerApiDelete('/user/webhost/verify', {'obh': obh, 'target': serverKey}, self)
            if retval and retval.get('errinfo'): return retval
            self.combinedConnections[serverKey].onChannelString((CRLF+'Removing webhost container...'))
            retcmd = self.combinedConnections[serverKey].execute_command(self.combinedConnections[serverKey].dockerCommandPrefix + 'docker ps --filter "name=^/'+containerName+'$" --format \'{{.Names}}\' | grep -qw '+containerName+' && ' + self.combinedConnections[serverKey].dockerCommandPrefix + 'docker stop '+containerName)
            self.combinedConnections[serverKey].onChannelString((CRLF+retcmd))
            retcmd = self.combinedConnections[serverKey].execute_command(self.combinedConnections[serverKey].dockerCommandPrefix + 'docker rmi -f oysape/webhost')
            self.combinedConnections[serverKey].onChannelString((CRLF+retcmd))
            self.combinedConnections[serverKey].onChannelString((CRLF+'Webhost stoped'+CRLF))
            if retval and not retval.get('errinfo'):
                return self.update_session(retval)
            else:
                return retval
        except Exception as e:
            return {'errinfo': str(e)}

    def installWebHost(self, params={}):
        obh = params.get('obh')
        initScript = params.get('initScript')
        serverKey = params.get('target')
        containerName = params.get('containerName') or 'oyhost'
        portMapping = params.get('port') or '19790:19790'
        volumes = ' '.join((['-v '+x.get('volume') for x in (params.get('volumes') or []) if x.get('volume')] or []) + ['-v ~/.oysape:/root/.oysape'])
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
            # No need to remove the container
            self.combinedConnections[serverKey].execute_command(self.combinedConnections[serverKey].dockerCommandPrefix + 'docker rm -f '+containerName)
            self.combinedConnections[serverKey].execute_command(self.combinedConnections[serverKey].dockerCommandPrefix + 'docker rmi -f oysape/webhost')
            # Pull the latest image first
            self.combinedConnections[serverKey].onChannelString((CRLF+'Pull the latest image...'))
            self.combinedConnections[serverKey].execute_command(self.combinedConnections[serverKey].dockerCommandPrefix + 'docker pull oysape/webhost')
            # Run the container
            self.combinedConnections[serverKey].execute_command(self.combinedConnections[serverKey].dockerCommandPrefix + 'docker ps --filter "name=^/'+containerName+'$" --format \'{{.Names}}\' | grep -qw '+containerName+' && ' + self.combinedConnections[serverKey].dockerCommandPrefix + 'docker stop '+containerName)
            self.combinedConnections[serverKey].onChannelString((CRLF+'Running webhost container...'))
            oneTimeSecret = tools.getRandomString(60)
            # cmd1 = self.combinedConnections[serverKey].dockerCommandPrefix + f'docker run --rm --name {containerName} -p {portMapping} -e WEBHOST_CONFIG=' + oneTimeSecret+'@'+obh + f' {volumes} -itd oysape/webhost'
            cmd1 = self.combinedConnections[serverKey].dockerCommandPrefix + f'docker run --name {containerName} -p {portMapping} -e WEBHOST_CONFIG=' + oneTimeSecret+'@'+obh + f' {volumes} -itd oysape/webhost'
            # self.dockerExecCommand({'command': cmd1, 'target': serverKey, 'output': True})
            retcmd = self.combinedConnections[serverKey].execute_command(cmd1)
            self.combinedConnections[serverKey].onChannelString((CRLF+retcmd))
            # Config the webhost
            self.combinedConnections[serverKey].onChannelString((CRLF+'Configuring webhost...'))
            cmd2 = self.combinedConnections[serverKey].dockerCommandPrefix + 'docker exec '+containerName+' python src/webhost-setup.py --obh=' + obh
            if params.get('title'): cmd2 += ' --title="' + params.get('title') + '"'
            retcmd = self.combinedConnections[serverKey].execute_command(cmd2)
            self.combinedConnections[serverKey].onChannelString((CRLF+retcmd))
            cmd3 = self.combinedConnections[serverKey].dockerCommandPrefix + 'docker restart '+containerName
            retcmd = self.combinedConnections[serverKey].execute_command(cmd3)
            self.combinedConnections[serverKey].onChannelString((CRLF+retcmd))
            # Run the init script
            if initScript:
                for x in initScript.split('\n'):
                    cmdText = self.combinedConnections[serverKey].dockerCommandPrefix + 'docker exec '+containerName+" bash -c '"+x+"'"
                    retcmd = self.combinedConnections[serverKey].execute_command(cmdText)
            # Save the secret and others fields
            adata = {'obh': obh, 'target': serverKey, 'secret': oneTimeSecret, 'title': params.get('title'), 'containerName': containerName, 'port': portMapping, 'volumes': (params.get('volumes') or []), 'initScript': initScript}
            if params.get('title'): adata['title'] = params.get('title')
            retval = tools.callServerApiPost('/user/webhosts', adata, self)
            self.combinedConnections[serverKey].onChannelString((CRLF+'Webhost started'+CRLF))
            if retval and not retval.get('errinfo'):
                return self.update_session(retval)
            else:
                return retval
        except Exception as e:
            return {'errinfo': str(e)}

    def verifyWebHost(self, params={}):
        # If current user has webhost set, and those webhosts are verified, and the target is in servers. Save servers/tasks/pipelines to webhost target.
        # This needs to be done before verify webhost, because once verified, the webhost will need servers/tasks/pipelines data.
        objs = {
            'servers': self.userSession['servers'],
            'tasks': self.userSession['tasks'],
            'pipelines': self.userSession['pipelines'],
            'folders': self.listFolder,
            'excludes': self.listExclude,
        }
        for site in (self.userSession.get('sites') or []):
            serverKey = site.get('target')
            if serverKey and site.get('verified') and site.get('target') in [x.get('key') for x in objs['servers']]:
                filename = tools.get_key(self.userSession.get('tname'))+'.json'
                self.save_remote_file({'target': serverKey, 'path': os.path.join('.oysape','teams',filename), 'content': json.dumps(objs)})
        # Verify webhost
        obh = params.get('obh')
        retval = tools.callServerApiPost('/user/webhost/verify', {'obh': obh}, self)
        if retval and not retval.get('errinfo'):
            return self.update_session(retval)
        else:
            return retval

    def applyToTeams(self, params={}):
        obh = params.get('obh')
        teams = params.get('teams')
        retval = tools.callServerApiPost('/user/webhost/apply', {'obh': obh, 'teams': teams}, self)
        if retval and not retval.get('errinfo'):
            return self.update_session(retval)
        else:
            return retval

    def openWebHost(self, params={}):
        import webbrowser
        obh = params.get('obh')
        webbrowser.open_new(obh)

    def setSchedule(self, params={}):
        # If current user has webhost set, and those webhosts are verified, and the target is in servers. Save servers/tasks/pipelines to webhost target.
        # This needs to be done before verify webhost, because once verified, the webhost will need servers/tasks/pipelines data.
        objs = {
            'servers': self.userSession['servers'],
            'tasks': self.userSession['tasks'],
            'pipelines': self.userSession['pipelines'],
            'folders': self.listFolder,
            'excludes': self.listExclude,
        }
        for site in (self.userSession.get('sites') or []):
            serverKey = site.get('target')
            if serverKey and site.get('verified') and site.get('target') in [x.get('key') for x in objs['servers']]:
                filename = tools.get_key(self.userSession.get('tname'))+'.json'
                self.save_remote_file({'target': serverKey, 'path': os.path.join('.oysape','teams',filename), 'content': json.dumps(objs)})
        # Create or update webhost's schedule
        obh = params.get('obh')
        retval = tools.callServerApiPost('/user/webhost/schedule', {'obh': obh, 'schedule': params.get('schedule')}, self)
        if retval and not retval.get('errinfo'):
            # Update webhost's webhost.json
            for site in (retval.get('sites') or []):
                serverKey = site.get('target')
                if obh == site.get('obh'):
                    self.save_remote_file({'target': serverKey, 'path': os.path.join('.oysape','webhost.json'), 'content': json.dumps(site)})
            # After the webhost's scheduled tasks are modified, perform a webhost validation. Once the validation is passed, the webhost will recreate the scheduler.
            tools.callServerApiPost('/user/webhost/verify', {'obh': obh}, self)
            # Return
            return self.update_session(retval)
        else:
            return retval

    def deleteSchedule(self, params={}):
        obh = params.get('obh')
        retval = tools.callServerApiDelete('/user/webhost/schedule', {'obh': obh, 'title': params.get('title')}, self)
        if retval and not retval.get('errinfo'):
            # Update webhost's webhost.json
            for site in (retval.get('sites') or []):
                serverKey = site.get('target')
                if obh == site.get('obh'):
                    self.save_remote_file({'target': serverKey, 'path': os.path.join('.oysape','webhost.json'), 'content': json.dumps(site)})
            # After the webhost's scheduled tasks are modified, perform a webhost validation. Once the validation is passed, the webhost will recreate the scheduler.
            tools.callServerApiPost('/user/webhost/verify', {'obh': obh}, self)
            # Return
            return self.update_session(retval)
        else:
            return retval

    def callFetchScheduleLogs(self, params={}):
        # params: tname, obh, sch, page, pageSize
        # Send http request to webhost to query schedule logs. Need signature.
        obh = params.get('obh')
        secret_key = None
        for site in self.userSession.get('sites'):
            if site.get('obh') == obh:
                secret_key = site.get('secret_key')
                break
        if not secret_key:
            return {'list': [], 'total': 0}
        ts = int(time.time())
        nonce = tools.getRandomLowers(32)
        sdata = nonce + str(ts)
        onesig = hmac.new(secret_key.encode('utf-8'), sdata.encode('utf-8'), hashlib.sha256).hexdigest()
        params['sig'] = onesig
        params['ts'] = ts
        params['nonce'] = nonce
        # Send http request, will call execQueryScheduleLogs
        retval = tools.send_get_request(obh+'/schedule/logs', params, {'Content-Type': 'application/json'})
        return retval or {'list': [], 'total': 0}


apiInstances = {}
