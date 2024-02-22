#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os, base64, traceback, json, re, json, _thread, time, getpass, platform
import webview
import paramiko
from . import tools

BUF_SIZE = 1024
CR = '\r'
LF = '\n'
CRLF = CR + LF
ctrl_c = '\u0003'
ctrl_d = '\u0004'
es_home = '\u001b[200~'
es_end = '\u001b[201~'

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
    client.get_transport().set_keepalive(30)
    return client

def create_ssh_string(hostname, username=None, port=22):
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
        if not (sshconn.transport and sshconn.transport.is_alive()):
            sshconn.reconnect()
        if hasattr(sshconn, 'client') and sshconn.client is not None:
            # stdin, stdout, stderr = sshconn.client.exec_command("ps -t %s"%tty_number)
            stdin, stdout, stderr = sshconn.client.exec_command("ps -ef | grep %s | grep -v grep"%tty_number, timeout=15)
            output = stdout.read().decode()
        else:
            output = ''
    except Exception as e:
        sshconn.reconnect()
        if hasattr(sshconn, 'client') and sshconn.client is not None:
            stdin, stdout, stderr = sshconn.client.exec_command("ps -ef | grep %s | grep -v grep"%tty_number, timeout=15)
            output = stdout.read().decode()
        else:
            output = ''
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
        if self.private_key.startswith('~/'):
            self.private_key = os.path.expanduser(self.private_key)
        self.passphrase = passphrase
        self.serverKey = serverKey
        self.startup = startup
        self.reconnect()

    def reconnect(self):
        self.close()
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
            self.transport = self.client._transport
            self.openChannel()
            self.running = True
            _thread.start_new_thread(self.mainloop,())
        except Exception as e:
            traceback.print_exc()
            self.message = str(e)

    def openChannel(self):
        from . import apis
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
                    print('startup', self.startup)
                    for taskKey in self.startup:
                        taskObj = apis.apiInstance.getTaskObject(taskKey)
                        taskCmds = apis.apiInstance.getTaskCommands(taskKey)
                        apis.execTask(taskKey, taskObj, taskCmds, self, output=False)
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
                self.data1 = ''
                if self.channel and self.isChannelIdle() and self.channel_available and self.shellCacheAuto:
                    self.data1 = self.shellCacheAuto.pop(0)
                    self.channel.send(self.data1)
                    self.output = ''
                # time.sleep(0.01)
                if (self.data1 and re.findall(pattern, self.data1)):
                    self.updateChannelStatus('send')
                self.data2 = ''
                if self.channel and self.shellCacheHuman:
                    self.data2 = self.shellCacheHuman.pop(0)
                    self.channel.send(self.data2)
                    self.output = ''
            if self.channel and not self.sentChannelCloseEvent and self.channel.exit_status_ready():
                self.onChannelClose()

    def close(self):
        self.running = False
        self.prompt_endchar = None
        self.tty_number = None
        self.ps_list = []
        if hasattr(self, 'channel') and self.channel is not None:
            self.channel.close()
        if hasattr(self, 'client') and self.client is not None:
            self.client.close()

    def execute_command(self, command):
        if self.client is None: return None
        if not (self.transport and self.transport.is_alive()):
            self.reconnect()
        stdin, stdout, stderr = self.client.exec_command(command)
        self.command_result = stdout.read().decode() or stderr.read().decode()
        return self.command_result

    def get_command_result(self):
        return self.command_result

    def send_to_channel(self, data, human=True):
        if not (self.transport and self.transport.is_alive()):
            self.reconnect()
        if human:
            self.shellCacheHuman.append(data)
        else:
            self.shellCacheAuto.append(data)

    def resizeChannel(self, width, height):
        if self.isChannelActive():
            self.channel.resize_pty(width, height)

    def ensureExists(self, sftp, apath):
        try:
            sftp.stat(apath)
        except Exception as e:
            self.ensureExists(sftp, os.path.split(apath)[0])
            sftp.mkdir(apath)

    def upload_file(self, local_path, remote_path, callback=None):
        try:
            sftp = self.client.open_sftp()
            (callback or print)(' '.join([local_path, '->', remote_path]))
            if remote_path.startswith('~/'):
                remote_path = os.path.join(sftp.normalize('.'), remote_path[2:])
            self.ensureExists(sftp, os.path.split(remote_path)[0])
            sftp.put(local_path, remote_path)
            source_stat = os.stat(local_path)
            sftp.utime(remote_path, (source_stat.st_atime, source_stat.st_mtime))
            sftp.chmod(remote_path, source_stat.st_mode)
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
            if remote_path.startswith('~/'):
                remote_path = os.path.join(sftp.normalize('.'), remote_path[2:])
            apath = os.path.split(local_path)[0]
            if not os.path.exists(apath):
                os.makedirs(apath)
            sftp.get(remote_path, local_path)
            source_stat = sftp.stat(remote_path)
            os.utime(local_path, (source_stat.st_atime, source_stat.st_mtime))
            os.chmod(local_path, source_stat.st_mode)
            sftp.close()
            (callback or print)(' Done.'+CRLF)
            return 1, os.path.getsize(local_path)
        except Exception as e:
            traceback.print_exc()
            (callback or print)(str(e)+CRLF)

    def upload_directory(self, local_path, remote_path, callback=None):
        exclude = ['__pycache__', 'node_modules', '.svn', '.git', '.gitignore', '.DS_Store', '.Trashes', 'Thumbs.db', 'Desktop.ini']
        sftp = self.client.open_sftp()
        if remote_path.startswith('~/'):
            remote_path = os.path.join(sftp.normalize('.'), remote_path[2:])
        remote_path = os.path.join(remote_path, os.path.basename(local_path))
        self.ensureExists(sftp, remote_path)
        ret1, ret2 = 0, 0
        def recurse(spath, dpath, ret1, ret2):
            items = os.listdir(spath)
            items.sort()
            dirs = [x for x in items if os.path.isdir(os.path.join(spath, x)) and x not in exclude]
            files = [x for x in items if os.path.isfile(os.path.join(spath, x)) and x not in exclude]
            for dir in dirs:
                (callback or print)(' '.join([os.path.join(spath, dir), '->', os.path.join(dpath, dir)])+CRLF)
                self.ensureExists(sftp, os.path.join(dpath, dir))
                ret1, ret2 = recurse(os.path.join(spath, dir), os.path.join(dpath, dir), ret1, ret2)
            for file in files:
                local_file_path = os.path.join(spath, file)
                remote_file_path = os.path.join(dpath, file)
                try:
                    local_stat = os.stat(local_file_path)
                    try:
                        remote_stat = sftp.stat(remote_file_path)
                    except Exception as e:
                        remote_stat = None
                    if remote_stat == None or int(local_stat.st_mtime) > remote_stat.st_mtime or local_stat.st_size != remote_stat.st_size:
                        (callback or print)(' '.join([local_file_path, '->', remote_file_path]))
                        sftp.put(local_file_path, remote_file_path)
                        sftp.utime(remote_file_path, (local_stat.st_atime, int(local_stat.st_mtime)))
                        sftp.chmod(remote_file_path, local_stat.st_mode)
                        ret1 += 1
                        ret2 += local_stat.st_size
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
        if remote_path.startswith('~/'):
            remote_path = os.path.join(sftp.normalize('.'), remote_path[2:])
        os.makedirs(local_path, exist_ok=True)
        local_path = os.path.join(local_path, os.path.basename(remote_path))
        os.makedirs(local_path, exist_ok=True)
        ret1, ret2 = 0, 0
        def recurse(spath, dpath, ret1, ret2):
            for entry in sftp.listdir(spath):
                if entry in exclude: continue
                remote_file_path = os.path.join(spath, entry)
                local_file_path = os.path.join(dpath, entry)
                try:
                    remote_stat = sftp.stat(remote_file_path)
                except Exception as e:
                    (callback or print)(' '.join([remote_file_path, '->', local_file_path]))
                    traceback.print_exc()
                    (callback or print)(CRLF+str(e)+CRLF)
                    continue
                if stat.S_ISDIR(remote_stat.st_mode):
                    (callback or print)(' '.join([remote_file_path, '->', local_file_path])+CRLF)
                    os.makedirs(local_file_path, exist_ok=True)
                    ret1, ret2 = recurse(remote_file_path, local_file_path, ret1, ret2)
                else:
                    try:
                        local_stat = os.stat(local_file_path) if os.path.exists(local_file_path) else None
                        if local_stat == None or remote_stat.st_mtime > int(local_stat.st_mtime) or remote_stat.st_size != local_stat.st_size:
                            (callback or print)(' '.join([remote_file_path, '->', local_file_path]))
                            sftp.get(remote_file_path, local_file_path)
                            os.utime(local_file_path, (remote_stat.st_atime, remote_stat.st_mtime))
                            os.chmod(local_file_path, remote_stat.st_mode)
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
        if not (self.transport and self.transport.is_alive()):
            self.reconnect()
        if local_path.startswith('~/'):
            local_path = os.path.realpath(os.path.expanduser(local_path))
        if os.path.isdir(local_path):
            return self.upload_directory(local_path, remote_path, self.onChannelString)
        else:
            return self.upload_file(local_path, remote_path, self.onChannelString)

    def download(self, remote_path, local_path):
        if not (self.transport and self.transport.is_alive()):
            self.reconnect()
        if local_path.startswith('~/'):
            local_path = os.path.expanduser(local_path)
        import stat
        sftp = self.client.open_sftp()
        if remote_path.startswith('~/'):
            remote_path = os.path.join(sftp.normalize('.'), remote_path[2:])
        file_attr = sftp.stat(remote_path)
        sftp.close()
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

