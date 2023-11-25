#!/usr/bin/env python
# -*- coding: utf-8 -*-

import webview
import paramiko
import os, base64, traceback, json, hashlib, re, json, _thread, time, getpass, fnmatch

BUF_SIZE = 1024
CR = '\r'
LF = '\n'
CRLF = CR + LF
ctrl_c = '\u0003'
ctrl_d = '\u0004'
es_home = '\u001b[200~'
es_end = '\u001b[201~'
folder_base = os.path.expanduser(os.path.join('~', '.oysape'))
folder_projects = os.path.join(folder_base, 'projects')
filename_settings = os.path.join(folder_base, 'workspace.json')
filename_tasks = os.path.join(folder_base, 'tasks.json')
filename_servers = os.path.join(folder_base, 'servers.json')
filename_pipelines = os.path.join(folder_base, 'pipelines.json')

def get_paramiko_key_from_data(data):
    if "BEGIN RSA PRIVATE KEY" in data:
        # RSA
        key = paramiko.RSAKey(data=data)
    elif "BEGIN DSA PRIVATE KEY" in data:
        # DSA
        key = paramiko.DSSKey(data=data)
    elif "BEGIN EC PRIVATE KEY" in data:
        # ECDSA
        key = paramiko.ECDSAKey(data=data)
    elif "BEGIN OPENSSH PRIVATE KEY" in data:
        # OpenSSH
        key = paramiko.Ed25519Key(data=data)
    else:
        raise ValueError("Unsupported key type")
    return key

def get_paramiko_key_from_file(key_file, passphrase=None):
    with open(key_file, "r") as f:
        key_data = f.read()
    if "BEGIN RSA PRIVATE KEY" in key_data:
        # RSA
        key = paramiko.RSAKey.from_private_key_file(key_file, password=passphrase)
    elif "BEGIN DSA PRIVATE KEY" in key_data:
        # DSA
        key = paramiko.DSSKey.from_private_key_file(key_file, password=passphrase)
    elif "BEGIN EC PRIVATE KEY" in key_data:
        # ECDSA
        key = paramiko.ECDSAKey.from_private_key_file(key_file, password=passphrase)
    elif "BEGIN OPENSSH PRIVATE KEY" in key_data:
        # OpenSSH
        key = paramiko.Ed25519Key.from_private_key_file(key_file, password=passphrase)
    else:
        raise ValueError("Unsupported key type")
    return key

def create_ssh_connection(hostname, username=None, port=22, password=None, private_key=None, passphrase=None):
    try:
        port = int(port)
    except Exception:
        port = 22
    username = username or getpass.getuser()
    if not password and not private_key:
        raise ValueError("No password or private key provided")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    if password:
        client.connect(hostname, port=port, username=username, password=password)
    elif private_key:
        private_key = get_paramiko_key_from_file(private_key, passphrase)
        client.connect(hostname, port=port, username=username, pkey=private_key)
    return client

def create_ssh_connection_string(hostname, username=None, port=22):
    return 'ssh://%s@%s:%s'%(username or getpass.getuser(), hostname, (port or 22))

def parse_ssh_connection_string(connection_string):
    if not connection_string.startswith('ssh://'):
        raise ValueError('Invalid SSH connection string')
    parts = connection_string[6:].split('@')
    if len(parts) == 2:
        username, hostport = parts
    else:
        hostport = parts[0]
        username = getpass.getuser()
    if ':' in hostport:
        hostname, port = hostport.split(':')
        port = int(port)
    else:
        hostname = hostport
        port = 22
    return hostname, port, username

def n10to62(value):
    stc = '0123456789abcdefghigklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    length = len(stc)
    retval = ''
    intp, remp = divmod(value,length)
    while intp>0:
        retval = stc[remp]+retval
        intp, remp = divmod(intp,length)
    retval = stc[remp]+retval
    return retval

def n62to10(value):
    stc = '0123456789abcdefghigklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    length = len(stc)
    retval = 0
    for x in range(len(value)):
        retval = retval+stc.find(value[x])*length**(len(value)-x-1)
    return retval

def n16to62(value):
    return n10to62(int(value, 16))

def convert_bytes(size):
    # 1 KB = 1024 B
    # 1 MB = 1024 KB
    # 1 GB = 1024 MB
    units = ["B", "KB", "MB", "GB"]
    unit_index = 0
    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1
    size = round(size, 2)
    return '%d %s'%(int(size), units[unit_index])

def get_key(text):
    return n16to62(hashlib.md5(text.encode('utf-8')).hexdigest())

def get_files(apath, recurse=True, exclude=[], ignore=None):
    if os.path.isdir(apath):
        result = []
        items = os.listdir(apath)
        items.sort()
        dirs = [x for x in items if os.path.isdir(os.path.join(apath, x))]
        files = [x for x in items if os.path.isfile(os.path.join(apath, x))]
        for item in dirs:
            if exclude and ignore and callable(ignore) and not ignore(item,exclude):
                result.append({"title":item, "key":get_key(os.path.join(apath, item)), "path":os.path.join(apath, item), "children":get_files(os.path.join(apath, item), recurse, exclude, ignore) if recurse else []})
        for item in files:
            if exclude and ignore and callable(ignore) and not ignore(item,exclude):
                result.append(get_files(os.path.join(apath, item), recurse, exclude, ignore))
        return result
    elif os.path.isfile(apath):
        return {"title":os.path.basename(apath), "key":get_key(apath), "path":apath, "isLeaf":True}
    else:
        return []

def get_task_object(taskKey, listTask=None):
    taskObj = [x for x in (listTask or get_task_list()) if x.get('name') == taskKey]
    taskObj = taskObj[0] if taskObj else {}
    return taskObj

def get_task_commands(taskKey, listTask=None):
    taskObj = get_task_object(taskKey, listTask)
    if not taskObj: return []
    return json.loads(json.dumps(taskObj.get('cmds') or []))

def get_task_list():
    retval = []
    if os.path.isfile(filename_tasks):
        with open(filename_tasks, 'r') as f:
            retval = json.load(f)
    return retval

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

def remove_ansi_color_codes(text):
    import re
    ansi_escape = re.compile(r'\x1B\[[0-?]*[ -/]*[@-~]')
    return ansi_escape.sub('', text)

def get_prompt_endchar(channel, debug=False):
    import json
    while not channel.recv_ready(): pass
    output = ''
    while channel.recv_ready():
        chunk = channel.recv(BUF_SIZE)
        output += chunk.decode()
        time.sleep(0.1)
    if debug: print(json.dumps(output))
    output = remove_ansi_color_codes(output).strip()
    if debug: print(json.dumps(output))
    if output:
        return output[-1]
    else:
        return None

def get_tty_number(channel, debug=False):
    import re, json
    channel.send('tty\n')
    while not channel.recv_ready(): pass
    output = ''
    while channel.recv_ready():
        chunk = channel.recv(BUF_SIZE)
        output += chunk.decode()
        time.sleep(0.1)
    if debug: print(json.dumps(output))
    output = remove_ansi_color_codes(output).strip()
    if debug: print(json.dumps(output))
    if output:
        pattern = r"/dev/(\S+)"
        matches = re.findall(pattern, output)
        return matches[0] if matches else None
    else:
        return None

def get_ps(sshconn, tty_number, debug=False):
    try:
        # stdin, stdout, stderr = sshconn.client.exec_command("ps -t %s"%tty_number)
        stdin, stdout, stderr = sshconn.client.exec_command("ps -ef | grep %s | grep -v grep"%tty_number)
        output = stdout.read().decode()
    except ConnectionResetError as e:
        sshconn.reconnect()
        stdin, stdout, stderr = sshconn.client.exec_command("ps -ef | grep %s | grep -v grep"%tty_number)
        output = stdout.read().decode()
    if debug: print(json.dumps(output))
    return [x for x in output.split('\n') if x and not x.strip().endswith((' sudo', ' sudo su', ' su', ' sh', ' bash'))]

class SSHClient:
    def __init__(self, ssh_connection_string, password=None, private_key=None, passphrase=None, serverKey=None, startup=None):
        self.hostname, self.port, self.username = parse_ssh_connection_string(ssh_connection_string)
        self.password = password
        self.private_key = private_key
        if not password and not private_key:
            if os.path.isfile(os.path.expanduser('~/.ssh/id_rsa')):
                self.private_key = os.path.expanduser('~/.ssh/id_rsa')
            elif os.path.isfile(os.path.expanduser('~/.ssh/id_dsa')):
                self.private_key = os.path.expanduser('~/.ssh/id_dsa')
            elif os.path.isfile(os.path.expanduser('~/.ssh/id_ecdsa')):
                self.private_key = os.path.expanduser('~/.ssh/id_ecdsa')
            elif os.path.isfile(os.path.expanduser('~/.ssh/id_ed25519')):
                self.private_key = os.path.expanduser('~/.ssh/id_ed25519')
        self.passphrase = passphrase
        self.serverKey = serverKey
        self.startup = startup
        self.reconnect()

    def reconnect(self):
        self.client = None
        self.channel = None
        self.transport = None
        self.running = False
        self.shellCacheAuto = []
        self.shellCacheHuman = []
        self.message = ''
        self.sentChannelCloseEvent = True
        self.prompt_endchar = None
        self.tty_number = None
        self.ps_list = []
        self.output = ''
        self.channel_available = False
        self.check_ps_source = ''
        self.check_ps_time = time.time()
        self.data1 = ''
        self.data2 = ''
        try:
            self.client = create_ssh_connection(self.hostname, self.username, self.port, self.password, self.private_key, self.passphrase)
            self.transport = self.client.get_transport()
            self.openChannel()
            self.running = True
            _thread.start_new_thread(self.mainloop,())
        except Exception as e:
            traceback.print_exc()
            self.message = str(e)

    def openChannel(self):
        if not self.isChannelActive():
            if self.channel: self.channel.close()
            try:
                self.channel = self.client.invoke_shell(term='xterm')
                # self.channel.setblocking(0)
                time.sleep(0.3) # wait for a while to get the prompt correctly
                self.prompt_endchar = get_prompt_endchar(self.channel)
                time.sleep(0.2) # wait for a while to get the tty number correctly
                self.tty_number = get_tty_number(self.channel)
                self.ps_list = get_ps(self, self.tty_number)
                self.sentChannelCloseEvent = False
                self.channel_available = True
                self.send_to_channel(LF, human=False)
                if self.startup:
                    print('startup',self.startup)
                    for taskKey in self.startup:
                        taskObj = get_task_object(taskKey)
                        taskCmds = get_task_commands(taskKey)
                        execTask(taskKey, taskObj, taskCmds, self, output=False)
            except:
                pass
        return self.channel

    def isChannelActive(self):
        # Check if the channel is active. If not, needs to create a new channel
        return self.channel and not self.channel.closed

    def isChannelIdle(self):
        # Check if the channel is idle. If so, can send data to the channel
        return self.channel and not self.channel.closed and self.channel.send_ready() and not self.channel.recv_ready()

    def updateChannelStatus(self, source):
        # time1 = time.time()
        # print(time1, source, 'update channel status', end="")
        if self.tty_number:
            ps_current = get_ps(self, self.tty_number)
            if len(ps_current) > len(self.ps_list):
                # If the number of processes on the current tty is greater than the original number of processes, then there are some processes still running on the channel
                self.channel_available = False
            else:
                self.channel_available = True
        elif self.prompt_endchar:
            if self.output and self.output.strip().endswith(self.prompt_endchar):
                # If the output ends with the prompt end character, then the channel is idle
                self.channel_available = True
        else:
            self.channel_available = True
        # print(' done', time.time() - time1, self.channel_available)
        self.output = ''
        self.check_ps_source = source
        self.check_ps_time = time.time()

    def areAllTasksDone(self):
        return len(self.shellCacheAuto) == 0 and len(self.shellCacheHuman) == 0 and self.channel_available and self.isChannelIdle()

    def onChannelString(self, string):
        self.onChannelData(string.encode())

    def onChannelData(self, bdata):
        pass

    def onChannelClose(self):
        self.sentChannelCloseEvent = True
        pass

    def mainloop(self):
        while self.running and (self.client or self.channel):
            time.sleep(0.01)
            pattern = r"[\r\n]"
            if self.channel and self.onChannelData and callable(self.onChannelData):
                while self.channel.recv_ready():
                    bdata = self.channel.recv(BUF_SIZE)
                    self.onChannelData(bdata)
                    try:
                        self.output += bdata.decode()
                    except:
                        pass
                    # time.sleep(0.01)
                if self.output and (re.findall(pattern, self.output) or (self.prompt_endchar and self.output.strip().endswith(self.prompt_endchar))):
                    self.updateChannelStatus('recv')
            if self.shellCacheAuto or self.shellCacheHuman:
                if not self.isChannelActive(): self.openChannel()
                while self.channel and self.isChannelIdle():
                    self.data1, self.data2 = '', ''
                    if self.channel_available and self.shellCacheAuto:
                        self.data1 = self.shellCacheAuto.pop(0)
                        self.channel.send(self.data1)
                        self.output = ''
                    if self.shellCacheHuman:
                        self.data2 = self.shellCacheHuman.pop(0)
                        self.channel.send(self.data2)
                        self.output = ''
                    # time.sleep(0.01)
                    if (self.data1 and re.findall(pattern, self.data1)):
                        self.updateChannelStatus('send')
            if self.channel and not self.sentChannelCloseEvent and self.channel.exit_status_ready():
                self.onChannelClose()

    def close(self):
        self.running = False
        self.prompt_endchar = None
        self.tty_number = None
        self.ps_list = []
        if self.channel is not None:
            self.channel.close()
        if self.client is not None:
            self.client.close()

    def execute_command(self, command):
        if self.client is None: return None
        if not (self.client and self.transport.is_alive()): return None
        stdin, stdout, stderr = self.client.exec_command(command)
        self.command_result = stdout.read().decode() or stderr.read().decode()
        return self.command_result

    def get_command_result(self):
        return self.command_result

    def send_to_channel(self, data, human=True):
        if human:
            self.shellCacheHuman.append(data)
        else:
            self.shellCacheAuto.append(data)

    def resizeChannel(self, width, height):
        if self.isChannelActive():
            self.channel.resize_pty(width, height)

    def upload_file(self, local_path, remote_path, callback=None):
        try:
            sftp = self.client.open_sftp()
            (callback or print)(' '.join([local_path, '->', remote_path]))
            sftp.put(local_path, remote_path)
            sftp.close()
            (callback or print)(' Done.'+CRLF)
            return 1, os.path.getsize(local_path)
        except Exception as e:
            traceback.print_exc()
            (callback or print)(str(e)+CRLF)

    def download_file(self, remote_path, local_path, callback=None):
        try:
            sftp = self.client.open_sftp()
            (callback or print)(' '.join([remote_path, '->', local_path]))
            sftp.get(remote_path, local_path)
            sftp.close()
            (callback or print)(' Done.'+CRLF)
            return 1, os.path.getsize(local_path)
        except Exception as e:
            traceback.print_exc()
            (callback or print)(str(e)+CRLF)

    def upload_directory(self, local_path, remote_path, callback=None):
        exclude = ['__pycache__', 'node_modules', '.svn', '.git', '.gitignore', '.DS_Store', '.Trashes', 'Thumbs.db', 'Desktop.ini']
        sftp = self.client.open_sftp()
        remote_path = os.path.join(remote_path, os.path.basename(local_path))
        try:
            sftp.stat(remote_path)
        except FileNotFoundError:
            sftp.mkdir(remote_path)
        ret1, ret2 = 0, 0
        def recurse(spath, dpath, ret1, ret2):
            items = os.listdir(spath)
            items.sort()
            dirs = [x for x in items if os.path.isdir(os.path.join(spath, x)) and x not in exclude]
            files = [x for x in items if os.path.isfile(os.path.join(spath, x)) and x not in exclude]
            for dir in dirs:
                (callback or print)(' '.join([os.path.join(spath, dir), '->', os.path.join(dpath, dir)])+CRLF)
                try:
                    sftp.stat(os.path.join(dpath, dir))
                except Exception as e:
                    sftp.mkdir(os.path.join(dpath, dir))
                ret1, ret2 = recurse(os.path.join(spath, dir), os.path.join(dpath, dir), ret1, ret2)
            for file in files:
                local_file_path = os.path.join(spath, file)
                remote_file_path = os.path.join(dpath, file)
                (callback or print)(' '.join([local_file_path, '->', remote_file_path]))
                try:
                    sftp.put(local_file_path, remote_file_path)
                    ret1 += 1
                    ret2 += os.path.getsize(local_file_path)
                    (callback or print)(' Done.'+CRLF)
                except Exception as e:
                    traceback.print_exc()
                    (callback or print)(str(e)+CRLF)
            return ret1, ret2
        ret1, ret2 = recurse(local_path, remote_path, ret1, ret2)
        sftp.close()
        return ret1, ret2

    def download_directory(self, remote_path, local_path, callback=None):
        import stat
        exclude = ['__pycache__', 'node_modules', '.svn', '.git', '.gitignore', '.DS_Store', '.Trashes', 'Thumbs.db', 'Desktop.ini']
        sftp = self.client.open_sftp()
        os.makedirs(local_path, exist_ok=True)
        local_path = os.path.join(local_path, os.path.basename(remote_path))
        os.makedirs(local_path, exist_ok=True)
        ret1, ret2 = 0, 0
        def recurse(spath, dpath, ret1, ret2):
            for entry in sftp.listdir(spath):
                if entry in exclude: continue
                remote_file_path = os.path.join(spath, entry)
                local_file_path = os.path.join(dpath, entry)
                (callback or print)(' '.join([remote_file_path, '->', local_file_path]))
                try:
                    file_attr = sftp.stat(remote_file_path)
                except Exception as e:
                    traceback.print_exc()
                    (callback or print)(CRLF+str(e)+CRLF)
                    continue
                if stat.S_ISDIR(file_attr.st_mode):
                    os.makedirs(local_file_path, exist_ok=True)
                    (callback or print)(CRLF)
                    ret1, ret2 = recurse(remote_file_path, local_file_path, ret1, ret2)
                else:
                    try:
                        sftp.get(remote_file_path, local_file_path)
                        ret1 += 1
                        ret2 += os.path.getsize(local_file_path)
                        (callback or print)(' Done.'+CRLF)
                    except Exception as e:
                        traceback.print_exc()
                        (callback or print)(str(e)+CRLF)
            return ret1, ret2
        ret1, ret2 = recurse(remote_path, local_path, ret1, ret2)
        sftp.close()
        return ret1, ret2

    def upload(self, local_path, remote_path):
        if os.path.isdir(local_path):
            return self.upload_directory(local_path, remote_path, self.onChannelString)
        else:
            return self.upload_file(local_path, remote_path, self.onChannelString)

    def download(self, remote_path, local_path):
        import stat
        sftp = self.client.open_sftp()
        file_attr = sftp.stat(remote_path)
        if stat.S_ISDIR(file_attr.st_mode):
            return self.download_directory(remote_path, local_path, self.onChannelString)
        else:
            return self.download_file(remote_path, local_path, self.onChannelString)


class TerminalClient(SSHClient):
    def onChannelData(self, bdata):
        # print('out:',bdata)
        data1 = base64.b64encode(bdata).decode()
        if len(webview.windows) > 0:
            webview.windows[0].evaluate_js('window.pywebview.termbridge.onChannelData_%s && window.pywebview.termbridge.onChannelData_%s("%s")'%(self.uniqueKey, self.uniqueKey, data1))

    def onChannelClose(self):
        super().onChannelClose()
        if self.sentChannelCloseEvent and len(webview.windows) > 0:
            webview.windows[0].evaluate_js('window.closeThisTab && window.closeThisTab("'+self.uniqueKey+'", true)')

class WorkspaceClient(SSHClient):
    def onChannelData(self, bdata):
        data1 = base64.b64encode(bdata).decode()
        if len(webview.windows) > 0:
            webview.windows[0].evaluate_js('window.pywebview.workbridge.onChannelData && window.pywebview.workbridge.onChannelData("%s")'%(data1))

    def onChannelClose(self):
        super().onChannelClose()
        self.parentApi.workspaceWorkingChannel = ''
        if self.sentChannelCloseEvent and len(webview.windows) > 0:
            webview.windows[0].evaluate_js('window.closeWorkspaceChannel && window.closeWorkspaceChannel("'+self.serverKey+'")')


themeType = 'dark'

class ApiBase:
    def __init__(self, is_debug=False):
        self.is_debug = is_debug

    def isDebug(self):
        return self.is_debug

    def fullscreen(self):
        webview.windows[0].toggle_fullscreen()

    def choose_file(self):
        filename = webview.windows[0].create_file_dialog(webview.OPEN_DIALOG)
        return filename

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
        path = params.get('path', '')
        if not os.path.isfile(path):
            return {'errinfo': 'File not found: %s' % path}
        try:
            with open(path, 'r') as f:
                return f.read()
        except Exception as e:
            return {'errinfo': str(e)}

    def save_file(self, params):
        path = params.get('path', '')
        content = params.get('content', '')
        if filename_settings == path:
            try:
                json.loads(content)
            except:
                return {'errinfo': 'Invalid JSON'}
        with open(path, 'w') as f:
            f.write(content)

    def save_content(self, content):
        filename = webview.windows[0].create_file_dialog(webview.SAVE_DIALOG)
        if not filename:
            return
        with open(filename, 'w') as f:
            f.write(content)

    def setTheme(self, params):
        global themeType
        themeType = (params or {}).get('type', themeType)
        print('theme', themeType)

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


class ApiOysape(ApiBase):
    listServer = []
    listTask = []
    listPipeline = []
    workspaceSettings = {"exclude": [
        ".DS_Store ._* .Spotlight-V100 .Trashes Thumbs.db Desktop.ini",
        "_MTN .bzr .hg .fslckout _FOSSIL_ .fos CVS _darcs .git .svn .osc .gitattributes .gitmodules",
        "*.pyc *.pyo *.class *.a *.obj *.o *.so *.la *.lib *.dylib *.ocx *.dll *.exe *.jar *.zip *.tar *.tar.gz *.tgz *.rpm *.dmg *.pkg *.deb}",
        "*.jpg *.jpeg *.gif *.png *.bmp *.tiff *.tif *.webp *.wav *.mp3 *.ogg *.flac *.avi *.mpg *.mp4 *.mkv *.xcf *.xpm}",
        "node_modules"
    ]}

    def getPipelineSteps(self, pipeName):
        pipeObject = self.getPipelineObject(pipeName)
        return json.loads(json.dumps(pipeObject.get('steps') or []))

    def getServerList(self, params={}):
        if not self.listServer:
            if os.path.isfile(filename_servers):
                with open(filename_servers, 'r') as f:
                    self.listServer = json.load(f)
        return self.listServer

    def addServer(self, params):
        items = self.getServerList()
        if params.get('prikey') and not os.path.isfile(os.path.expanduser(params.get('prikey'))):
            return {"errinfo": "Private key file not found: %s" % params.get('prikey')}
        exists = False
        oldkey = params.pop('oldkey', '')
        for i in range(len(items)):
            if items[i].get('key') == oldkey or items[i].get('key') == params.get('key'):
                exists = True
                items[i] = params
        if not exists:
            items.append(params)
        items.sort(key=lambda x: x.get('name'))
        with open(filename_servers, 'w') as f:
            json.dump(items, f, indent=4)
        self.listServer = items
        return {"serverList": items}

    def deleteServer(self, params):
        items = [x for x in self.getServerList() if x.get('key') != params.get('key')]
        with open(filename_servers, 'w') as f:
            json.dump(items, f, indent=4)
        self.listServer = items
        return {"serverList": items}

    def getTaskObject(self, taskKey):
        return get_task_object(taskKey, self.listTask)

    def getTaskCommands(self, taskKey):
        return get_task_commands(taskKey, self.listTask)

    def getTaskList(self, params={}):
        if not self.listTask:
            self.listTask = get_task_list()
        return self.listTask

    def addTask(self, params):
        items = self.getTaskList()
        oldkey = params.pop('oldkey', '')
        hasOthers = [items[i] for i in range(len(items)) if items[i].get('key') != oldkey and items[i].get('key') == params.get('key')]
        if hasOthers: return {"errinfo": "Task name already exists"}
        exists = False
        for i in range(len(items)):
            if items[i].get('key') == oldkey:
                exists = True
                if items[i].get('name') != params.get('name'):
                    self.changeTaskNameForPipeline(items[i].get('name'), params.get('name'))
                items[i] = params
        if not exists:
            items.append(params)
        items.sort(key=lambda x: x.get('name'))
        with open(filename_tasks, 'w') as f:
            json.dump(items, f, indent=4)
        self.listTask = items
        return {"taskList": items, "pipelineList": self.listPipeline}

    def deleteTask(self, params):
        items = [x for x in self.getTaskList() if x.get('key') != params.get('key')]
        with open(filename_tasks, 'w') as f:
            json.dump(items, f, indent=4)
        self.listTask = items
        return {"taskList": items}

    def getPipelineObject(self, pipeName):
        pipeObj = [x for x in self.listPipeline if x.get('name') == pipeName]
        pipeObj = pipeObj[0] if pipeObj else {}
        return pipeObj

    def getPipelineList(self, params={}):
        if not self.listPipeline:
            if os.path.isfile(filename_pipelines):
                with open(filename_pipelines, 'r') as f:
                    self.listPipeline = json.load(f)
        return self.listPipeline

    def addPipeline(self, params):
        items = self.getPipelineList()
        exists = False
        oldkey = params.pop('oldkey', '')
        for i in range(len(items)):
            if items[i].get('key') == oldkey or items[i].get('key') == params.get('key'):
                exists = True
                items[i] = params
        if not exists:
            items.append(params)
        items.sort(key=lambda x: x.get('name'))
        with open(filename_pipelines, 'w') as f:
            json.dump(items, f, indent=4)
        self.listPipeline = items
        return {"pipelineList": items}

    def changeTaskNameForPipeline(self, oldName, newName):
        items = self.getPipelineList()
        for i in range(len(items)):
            for j in range(len(items[i].get('steps'))):
                items[i]['steps'][j]['tasks'] = [newName if x==oldName else x for x in items[i]['steps'][j]['tasks'] or []]
        with open(filename_pipelines, 'w') as f:
            json.dump(items, f, indent=4)
        self.listPipeline = items
        return {"pipelineList": items}

    def deletePipeline(self, params):
        items = [x for x in self.getPipelineList() if x.get('key') != params.get('key')]
        with open(filename_pipelines, 'w') as f:
            json.dump(items, f, indent=4)
        self.listPipeline = items
        return {"pipelineList": items}

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
        folders = [{"root":True, "title":os.path.basename(x['path']), "key":get_key(x['path']), "path":x['path'], "children":get_files(x['path'], True, exclude+(x.get('exclude') or []), ignore)} for x in folders if x.get('path') and not ignore(x['path'],exclude)]
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

class ApiTerminal(ApiOysape):
    terminalConnections = {}

    def createTermConnection(self, params):
        serverKey = params.get('serverKey')
        uniqueKey = params.get('uniqueKey')
        taskKey = params.get('taskKey')
        slist = [x for x in self.getServerList() if x["key"] == serverKey]
        if len(slist) == 0:
            return
        if not uniqueKey in self.terminalConnections:
            print('createTermConnection', serverKey, uniqueKey)
            conn_str = create_ssh_connection_string(slist[0].get("address"), slist[0].get("username"), slist[0].get("port"))
            self.terminalConnections[uniqueKey] = TerminalClient(conn_str, private_key=slist[0].get("prikey"), serverKey=serverKey, startup=slist[0].get("tasks"))
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
            print('closeTermConnection', uniqueKey)
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

    def createCombConnection(self, serverKey):
        slist = [x for x in self.getServerList() if x["key"] == serverKey]
        if len(slist) == 0:
            return
        if not serverKey in self.combinedConnections:
            print('createCombConnection', serverKey)
            conn_str = create_ssh_connection_string(slist[0].get("address"), slist[0].get("username"), slist[0].get("port"))
            self.combinedConnections[serverKey] = WorkspaceClient(conn_str, private_key=slist[0].get("prikey"), serverKey=serverKey, startup=slist[0].get("tasks"))
            self.combinedConnections[serverKey].parentApi = self

    def closeCombConnections(self, params={}):
        for serverKey in self.combinedConnections.keys():
            print('closeCombConnections', serverKey)
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
            self.workspaceWorkingChannel = serverKey if taskObj.get('interaction') == 'interactive' else ''
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
            if output: client.onChannelString(CRLF+'Uploaded %s file(s). %s transfered'%(number, convert_bytes(transfered))+CRLF)
        else:
            client.onChannelString((CRLF+'No source or destination defined: %s'%taskObj.get('name')+CRLF))
    elif taskObj.get('interaction') == 'download':
        # Download a file/directory
        if output: client.onChannelString((CRLF+CRLF+colorizeText('Task: %s @%s'%(taskKey, client.serverKey), 'cyan', bgColor)+CRLF))
        if taskObj.get('source') and taskObj.get('destination'):
            number, transfered = client.download(taskObj.get('source'), taskObj.get('destination'))
            if output: client.onChannelString(CRLF+'Downloaded %s file(s). %s transfered'%(number, convert_bytes(transfered))+CRLF)
        else:
            client.onChannelString((CRLF+'No source or destination defined: %s'%taskObj.get('name')+CRLF))
    elif not taskCmds:
        client.onChannelString((CRLF+'No commands defined: %s'%taskKey+CRLF))
    else:
        # Execute the task's commands
        if output: client.onChannelString((CRLF+CRLF+colorizeText('Task: %s @%s'%(taskKey, client.serverKey), 'cyan', bgColor)+CRLF))
        runmode = taskObj.get('runmode') or ''
        if runmode.startswith('batch'):
            # Send commands to the channel once for all
            #TODO: Windows has different join symbol
            command = (' && ' if runmode.endswith('join') else LF).join(taskCmds)
            if len(taskCmds)>1 and runmode.endswith('escape'):
                command = es_home + command + es_end
            print('execTask', client.serverKey, json.dumps(command))
            client.send_to_channel(command + LF, human=False)
        elif runmode=='script':
            #TODO: Save the commands to the script file, then execute it
            pass
        else:
            # Send commands to the channel line-by-line
            print('execTask', client.serverKey, json.dumps(taskCmds))
            while taskCmds:
                data = taskCmds.pop(0)
                data = data.strip()+LF
                if not data.startswith('#'):
                    client.send_to_channel(data, human=False)
                    time.sleep(0.01)
