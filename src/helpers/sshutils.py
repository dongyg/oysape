#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os, base64, traceback, json, re, json, _thread, time, getpass, stat
import paramiko
from . import tools, scheduler, apis

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
    if key_file.startswith('~'):
        key_file = os.path.expanduser(key_file)
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
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        if password:
            client.connect(hostname, port=port, username=username, password=password, timeout=10)
        elif private_key:
            private_key = get_paramiko_key_from_file(private_key, passphrase)
            client.connect(hostname, port=port, username=username, pkey=private_key, timeout=10)
        client.get_transport().set_keepalive(30)
        return client
    except Exception as e:
        traceback.print_exc()
        return str(e)

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
    ansi_escape = re.compile(r'\x1B\[[0-?]*[ -/]*[@-~]')
    return ansi_escape.sub('', text)

def get_prompt_string(channel, debug=False):
    while not channel.recv_ready(): pass
    output = ''
    while channel.recv_ready():
        chunk = channel.recv(BUF_SIZE)
        output += chunk.decode()
        time.sleep(0.1)
    if debug: print(json.dumps(output))
    output = remove_ansi_color_codes(output).strip().splitlines()
    retval = output[-1] if output else None
    if debug: print(json.dumps(retval))
    return retval

def get_tty_number(channel, debug=False):
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

def get_if_sudo_need_password(sshconn):
    try:
        stdin, stdout, stderr = sshconn.client.exec_command('sudo -n true 2>/dev/null && echo "NOPASSWD" || echo "NEEDPASSWD"')
        output = stdout.read().decode()
        if 'NOPASSWD' in output:
            return False
        else:
            return True
    except Exception as e:
        return True

class SSHClient:
    def __init__(self, ssh_connection_string, password=None, private_key=None, passphrase=None, serverKey=None, parentApi=None, uniqueKey=None, startup=None):
        self.hostname, self.port, self.username = parse_ssh_connection_string(ssh_connection_string)
        self.dockerManualPrefix = None
        self.dockerAutoPrefix = None
        self.dockerComposePrefix = None
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
        if self.private_key and self.private_key.startswith('~/'):
            self.private_key = os.path.expanduser(self.private_key)
        self.passphrase = passphrase
        self.serverKey = serverKey
        self.parentApi = parentApi
        self.uniqueKey = uniqueKey
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
        self.prompt_string = None
        self.prompt_endchar = None
        self.tty_number = None
        self.ps_list = []
        self.channel_available = False
        self.check_ps_source = ''
        self.check_ps_time = time.time()
        self.data1 = ''
        self.data2 = ''
        self.input = []
        self.output = ''
        v1 = create_ssh_connection(self.hostname, self.username, self.port, self.password, self.private_key, self.passphrase)
        if isinstance(v1, paramiko.SSHClient):
            self.client = v1
            self.transport = self.client._transport
            self.openChannel()
            self.running = True
            _thread.start_new_thread(self.mainloop,())
        else:
            self.message = v1

    def openChannel(self):
        if not self.isChannelActive():
            if self.channel: self.channel.close()
            try:
                self.channel = self.client.invoke_shell(term='xterm')
                # self.channel.setblocking(0)
                time.sleep(0.4) # wait for a while to get the prompt correctly
                self.prompt_string = get_prompt_string(self.channel, debug=False)
                self.prompt_endchar = self.prompt_string[-1] if self.prompt_string else None
                time.sleep(0.2) # wait for a while to get the tty number correctly
                self.tty_number = get_tty_number(self.channel)
                self.ps_list = get_ps(self, self.tty_number)
                self.sentChannelCloseEvent = False
                self.channel_available = True
                self.send_to_channel(LF, human=False)
                if self.startup:
                    print('startup', self.startup, flush=True)
                    for taskKey in self.startup:
                        taskObj = self.parentApi.getTaskObject(taskKey)
                        taskCmds = self.parentApi.getTaskCommands(taskKey)
                        print('exec', taskKey, taskObj, taskCmds, flush=True)
                        self.parentApi.execTask(taskKey, taskObj, taskCmds, self, output=False)
            except:
                pass
        return self.channel

    def isChannelActive(self):
        # Check if the channel is active. If not, needs to create a new channel
        return self.channel and not self.channel.closed

    def isChannelIdle(self):
        # Check if the channel is idle. If so, can send data to the channel
        # print(self.channel, not self.channel.closed, self.channel.send_ready(), not self.channel.recv_ready())
        # return self.channel and not self.channel.closed and self.channel.send_ready() and not self.channel.recv_ready()
        return self.channel and self.channel.send_ready() and not self.channel.recv_ready()

    def updateChannelStatus(self, source):
        # time1 = time.time()
        # print(time1, self.serverKey, source, 'update channel status', end="", flush=True)
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
        if source == 'recv' and self.channel_available:
            if hasattr(self, 'channelCommandFinished') and callable(self.channelCommandFinished):
                self.channelCommandFinished(self.output)
            self.input = []
        elif source == 'send':
            self.input.append(self.data1)
            if hasattr(self, 'channelCommandStart') and callable(self.channelCommandStart):
                self.channelCommandStart(self.data1)
        # print(self.serverKey, 'updateChannelStatus', time.time(), self.channel.recv_ready(), self.channel_available, flush=True)
        self.output = ''
        self.check_ps_source = source
        self.check_ps_time = time.time()

    def areAllTasksDone(self):
        # print(self.serverKey, self.tty_number, self.shellCacheAuto, self.shellCacheHuman, self.channel_available, self.isChannelIdle())
        return len(self.shellCacheAuto) == 0 and len(self.shellCacheHuman) == 0 and self.channel_available and self.isChannelIdle()

    def onChannelString(self, string):
        # Output a string. Default is outputting as a SSH channel data
        self.onChannelData(string.encode())

    def onChannelData(self, bdata):
        # To be overridden. All SSH channel data will be passed here
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
                # if self.output and re.findall(pattern, self.output): # Some commands do not have any output, but are still running.
                if not self.channel_available:
                    self.updateChannelStatus('recv')
            if self.shellCacheAuto or self.shellCacheHuman:
                if not self.isChannelActive(): self.openChannel()
                self.data1 = ''
                if self.channel and self.isChannelIdle() and self.channel_available and self.shellCacheAuto:
                    self.data1 = self.shellCacheAuto.pop(0)
                    self.channel.send(self.data1)
                    self.output = ''
                # time.sleep(0.01)
                if self.data1 and re.findall(pattern, self.data1):
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
            if remote_path.startswith('~/'):
                remote_path = os.path.join(sftp.normalize('.'), remote_path[2:])
            self.ensureExists(sftp, os.path.split(remote_path)[0])
            try:
                target_stat = sftp.stat(remote_path)
            except Exception as e:
                target_stat  = None
            if target_stat and stat.S_ISDIR(target_stat.st_mode):
                remote_path = os.path.join(remote_path, os.path.basename(local_path))
            (callback or print)(CRLF+' '.join([local_path, '->', remote_path]))
            sftp.put(local_path, remote_path)
            source_stat = os.stat(local_path)
            sftp.utime(remote_path, (source_stat.st_atime, source_stat.st_mtime))
            sftp.chmod(remote_path, source_stat.st_mode)
            sftp.close()
            # (callback or print)(CRLF+'Done.'+CRLF)
            return {'count':1, 'size':os.path.getsize(local_path)}
        except Exception as e:
            traceback.print_exc()
            (callback or print)(CRLF+str(e)+CRLF)
            return {'errinfo': str(e), 'count':0, 'size':0}

    def download_file(self, remote_path, local_path, callback=None):
        try:
            sftp = self.client.open_sftp()
            if remote_path.startswith('~/'):
                remote_path = os.path.join(sftp.normalize('.'), remote_path[2:])
            apath = os.path.split(local_path)[0]
            if not os.path.exists(apath):
                os.makedirs(apath)
            if os.path.isdir(local_path):
                local_path = os.path.join(local_path, os.path.basename(remote_path))
            (callback or print)(CRLF+' '.join([remote_path, '->', local_path]))
            sftp.get(remote_path, local_path)
            source_stat = sftp.stat(remote_path)
            os.utime(local_path, (source_stat.st_atime, source_stat.st_mtime))
            os.chmod(local_path, source_stat.st_mode)
            sftp.close()
            # (callback or print)(CRLF+'Done.'+CRLF)
            return {'count':1, 'size':os.path.getsize(local_path)}
        except Exception as e:
            traceback.print_exc()
            (callback or print)(CRLF+str(e)+CRLF)
            return {'errinfo': str(e), 'count':0, 'size':0}

    def upload_directory(self, local_path, remote_path, callback=None, excludes=None):
        exclude = ['__pycache__', 'node_modules', '.svn', '.git', '.gitignore', '.DS_Store', '.Trashes', 'Thumbs.db', 'Desktop.ini']
        if excludes: exclude.extend(excludes.split(' '))
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
                (callback or print)(CRLF+' '.join([os.path.join(spath, dir), '->', os.path.join(dpath, dir)]))
                self.ensureExists(sftp, os.path.join(dpath, dir))
                retdat = recurse(os.path.join(spath, dir), os.path.join(dpath, dir), ret1, ret2)
                ret1, ret2 = retdat.get('count', 0), retdat.get('size', 0)
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
                        (callback or print)(CRLF+' '.join([local_file_path, '->', remote_file_path]))
                        sftp.put(local_file_path, remote_file_path)
                        sftp.utime(remote_file_path, (local_stat.st_atime, int(local_stat.st_mtime)))
                        sftp.chmod(remote_file_path, local_stat.st_mode)
                        ret1 += 1
                        ret2 += local_stat.st_size
                        # (callback or print)(CRLF+'Done.'+CRLF)
                except Exception as e:
                    traceback.print_exc()
                    (callback or print)(CRLF+str(e)+CRLF)
                    return {'errinfo': str(e), 'count': ret1, 'size': ret2}
            return {'count': ret1, 'size': ret2}
        (callback or print)(CRLF+' '.join([local_path, '->', remote_path]))
        retdat = recurse(local_path, remote_path, ret1, ret2)
        ret1, ret2 = retdat.get('count', 0), retdat.get('size', 0)
        sftp.close()
        return {'count': ret1, 'size': ret2}

    def download_directory(self, remote_path, local_path, callback=None, excludes=None):
        exclude = ['__pycache__', 'node_modules', '.svn', '.git', '.gitignore', '.DS_Store', '.Trashes', 'Thumbs.db', 'Desktop.ini']
        if excludes: exclude.extend(excludes.split(' '))
        sftp = self.client.open_sftp()
        if remote_path.startswith('~/'):
            remote_path = os.path.join(sftp.normalize('.'), remote_path[2:])
        os.makedirs(local_path, exist_ok=True)
        local_path = os.path.join(local_path, os.path.basename(remote_path))
        os.makedirs(local_path, exist_ok=True)
        ret1, ret2 = 0, 0
        def recurse(spath, dpath, ret1, ret2):
            ll = [x for x in sftp.listdir_attr(spath) if stat.S_ISDIR(x.st_mode) or stat.S_ISREG(x.st_mode)]
            for entry in ll:
                if entry.filename in exclude: continue
                remote_file_path = os.path.join(spath, entry.filename)
                local_file_path = os.path.join(dpath, entry.filename)
                if stat.S_ISDIR(entry.st_mode):
                    (callback or print)(CRLF+' '.join([remote_file_path, '->', local_file_path]))
                    os.makedirs(local_file_path, exist_ok=True)
                    retdat = recurse(remote_file_path, local_file_path, ret1, ret2)
                    ret1, ret2 = retdat.get('count', 0), retdat.get('size', 0)
                else:
                    try:
                        local_stat = os.stat(local_file_path) if os.path.exists(local_file_path) else None
                        if local_stat == None or entry.st_mtime > int(local_stat.st_mtime) or entry.st_size != local_stat.st_size:
                            (callback or print)(CRLF+' '.join([remote_file_path, '->', local_file_path]))
                            sftp.get(remote_file_path, local_file_path)
                            os.utime(local_file_path, (entry.st_atime, entry.st_mtime))
                            os.chmod(local_file_path, entry.st_mode)
                            ret1 += 1
                            ret2 += os.path.getsize(local_file_path)
                            # (callback or print)(CRLF+'Done.'+CRLF)
                    except Exception as e:
                        traceback.print_exc()
                        (callback or print)(CRLF+str(e)+CRLF)
                        return {'errinfo': str(e), 'count': ret1, 'size': ret2}
            return {'count': ret1, 'size': ret2}
        (callback or print)(CRLF+' '.join([remote_path, '->', local_path]))
        retdat = recurse(remote_path, local_path, ret1, ret2)
        ret1, ret2 = retdat.get('count', 0), retdat.get('size', 0)
        sftp.close()
        return {'count': ret1, 'size': ret2}

    def upload(self, local_path, remote_path, excludes=None):
        if not self.client: return {'errinfo': 'No server connection'}
        timeout = 5
        passed = 0
        while not self.areAllTasksDone() and passed < timeout:
            time.sleep(0.1)
            passed += 0.1
        if passed >= timeout:
            return {'errinfo': 'Please wait until all tasks are done'}
        if not (self.transport and self.transport.is_alive()):
            self.reconnect()
        if local_path.startswith('~/'):
            local_path = os.path.realpath(os.path.expanduser(local_path))
        if os.path.isdir(local_path):
            return self.upload_directory(local_path, remote_path, self.onChannelString, excludes=excludes)
        elif os.path.isfile(local_path):
            return self.upload_file(local_path, remote_path, self.onChannelString)
        else:
            return {'errinfo': 'Local path not found: %s' % local_path, 'count': 0, 'size': 0}

    def download(self, remote_path, local_path, excludes=None):
        if not self.client: return {'errinfo': 'No server connection'}
        timeout = 5
        passed = 0
        while not self.areAllTasksDone() and passed < timeout:
            time.sleep(0.1)
            passed += 0.1
        if passed >= timeout:
            return {'errinfo': 'Please wait until all tasks are done'}
        if not (self.transport and self.transport.is_alive()):
            self.reconnect()
        if local_path.startswith('~/'):
            local_path = os.path.expanduser(local_path)
        try:
            sftp = self.client.open_sftp()
            if remote_path.startswith('~/'):
                remote_path = os.path.join(sftp.normalize('.'), remote_path[2:])
            file_attr = sftp.stat(remote_path)
            sftp.close()
            if stat.S_ISDIR(file_attr.st_mode):
                return self.download_directory(remote_path, local_path, self.onChannelString, excludes=excludes)
            else:
                return self.download_file(remote_path, local_path, self.onChannelString)
        except Exception as e:
            (self.onChannelString or print)(CRLF+str(e)+CRLF)
            return {'errinfo': str(e), 'count': 0, 'size': 0}

    def getServerFiles(self, folder):
        if not self.client: return {'errinfo': 'No server connection'}
        try:
            sftp = self.client.open_sftp()
            files = []
            ll = [x for x in sftp.listdir_attr(folder) if stat.S_ISDIR(x.st_mode) or stat.S_ISREG(x.st_mode)]
            ll.sort(key=lambda x: x.filename.lower())
            for entry in ll:
                remote_file_path = os.path.join(folder, entry.filename)
                files.append({'title': entry.filename, 'key': tools.get_key(self.serverKey+':'+remote_file_path), 'path':remote_file_path, 'isLeaf': not stat.S_ISDIR(entry.st_mode), 'target': self.serverKey})
            sftp.close()
            return {'fileList': files}
        except Exception as e:
            print(self.hostname, folder, flush=True)
            traceback.print_exc()
            return {'errinfo': str(e)}

    def open_remote_file(self, thisPath):
        if not self.client: return {'errinfo': 'No server connection'}
        try:
            content = ''
            sftp = self.client.open_sftp()
            file_attr = sftp.stat(thisPath)
            if stat.S_ISDIR(file_attr.st_mode):
                sftp.close()
                return {'errinfo': 'Not a file'}
            else:
                with sftp.open(thisPath, "r") as remote_file:
                    content = remote_file.read()
                sftp.close()
            return {'content': base64.b64encode(content).decode()}
        except Exception as e:
            print(self.hostname, thisPath, flush=True)
            traceback.print_exc()
            return {'errinfo': str(e)}

    def save_remote_file(self, thisPath, content, sudo=False, sudoPass=None):
        if not self.client: return {'errinfo': 'No server connection'}
        try:
            if self.password and not sudoPass:
                sudoPass = self.password
            sftp = self.client.open_sftp()
            try:
                sftp.stat(os.path.dirname(thisPath))
            except IOError:
                sftp.mkdir(os.path.dirname(thisPath))
            writePath = ('./'+tools.get_key(thisPath)) if sudo else thisPath
            with sftp.open(writePath, "w") as remote_file:
                remote_file.write(content)
            if sudo:
                command = (f'echo "{sudoPass}" | sudo -S -p ""' if sudoPass else 'sudo') + f' cp {writePath} {thisPath} && rm -f {writePath}'
                stdin, stdout, stderr = self.client.exec_command(command)
                # output = stdout.read().decode()
                error = stderr.read().decode()
                if error:
                    return {'errinfo': error}
        except PermissionError:
            return {'errinfo': 'Permission denied', 'needPassword': get_if_sudo_need_password(self) and not bool(sudoPass)}
        except Exception as e:
            print(self.hostname, thisPath, flush=True)
            traceback.print_exc()
            return {'errinfo': str(e)}
        finally:
            sftp.close()
        return {}

    def create_remote_file(self, remote_file_path, sudo=False, sudoPass=None):
        if not self.client: return {'errinfo': 'No server connection'}
        try:
            if self.password and not sudoPass:
                sudoPass = self.password
            sftp = self.client.open_sftp()
            writePath = ('./'+tools.get_key(remote_file_path)) if sudo else remote_file_path
            with sftp.open(writePath, 'w') as f:
                f.write('')
            if sudo:
                command = (f'echo "{sudoPass}" | sudo -S -p ""' if sudoPass else 'sudo') + f' cp {writePath} {remote_file_path} && rm -f {writePath}'
                stdin, stdout, stderr = self.client.exec_command(command)
                # output = stdout.read().decode()
                error = stderr.read().decode()
                if error:
                    return {'errinfo': error}
        except PermissionError:
            return {'errinfo': 'Permission denied', 'needPassword': get_if_sudo_need_password(self) and not bool(sudoPass)}
        except Exception as e:
            return {'errinfo': str(e)}
        finally:
            sftp.close()
        return {}

    def dockerCheckEnv(self, sudoPass=None):
        if self.password and not sudoPass:
            sudoPass = self.password
        tryCmds = ['', '/usr/local/bin/' ]
        for cmd in tryCmds:
            retval = self.dockerGetCommandResult(cmd+'docker version')
            retval = retval.get('errinfo') or ''
            if (retval.find('permission denied')>=0):
                if not sudoPass and get_if_sudo_need_password(self):
                    return {'errinfo': 'Sudo and password are required', 'needPassword': True}
                self.dockerAutoPrefix = (f'echo "{sudoPass}" | sudo -S -p ""' if sudoPass else 'sudo') + ' ' + (self.dockerAutoPrefix or '')
                self.dockerManualPrefix = 'sudo' + ' ' + (self.dockerManualPrefix or '')
                return None
            elif (retval.find('docker.sock')>=0):
                return {'errinfo': 'Docker is not running'}
            elif (retval.find('not found')>=0):
                continue
            elif retval:
                return {'errinfo': retval}
            else:
                self.dockerAutoPrefix = (self.dockerAutoPrefix or '') + cmd
                self.dockerManualPrefix = (self.dockerManualPrefix or '') + cmd
                return None
        return {'errinfo': 'Docker is not found'}

    def dockerComposeCheckEnv(self):
        self.dockerComposePrefix = ''
        tryCmds = ['docker compose', 'docker-compose', ]
        for cmd in tryCmds:
            retval = self.dockerGetCommandResult(cmd)
            retval = retval.get('errinfo') or ''
            if retval.find('is not a docker command')>=0:
                continue
            elif retval:
                return {'errinfo': retval}
            else:
                self.dockerComposePrefix = (self.dockerComposePrefix or '') + cmd
                return None
        return {'errinfo': 'Docker Compose is not found'}

    def dockerGetCommandResult(self, command):
        if not self.client: return {'errinfo': 'No server connection'}
        command = (self.dockerAutoPrefix or '') + command
        try:
            stdin, stdout, stderr = self.client.exec_command(command)
            output = stdout.read().decode()
            outerr = stderr.read().decode()
            return {'output': output, 'errinfo': outerr}
        except Exception as e:
            print(command, flush=True)
            traceback.print_exc()
            return {'errinfo': str(e)}

    def dockerCommandJsonResult(self, command):
        retval = self.dockerGetCommandResult(command)
        if retval.get('errinfo'): return retval
        output = retval.get('output')
        try:
            output = [json.loads(x) for x in output.split('\n') if x]
            return {'output': output}
        except Exception as e:
            traceback.print_exc()
            return {'errinfo': str(e), 'output': output}

    def dockerGetComposeResult(self, command):
        if not self.client: return {'errinfo': 'No server connection'}
        command = (self.dockerAutoPrefix or '') + (self.dockerComposePrefix or '') + command
        try:
            stdin, stdout, stderr = self.client.exec_command(command)
            output = stdout.read().decode()
            outerr = stderr.read().decode()
            return {'output': output, 'errinfo': outerr}
        except Exception as e:
            print(command, flush=True)
            traceback.print_exc()
            return {'errinfo': str(e)}

    def dockerComposeJsonResult(self, command):
        retval = self.dockerGetComposeResult(command)
        if retval.get('errinfo'): return retval
        output = retval.get('output')
        try:
            output = json.loads(output)
            return {'output': output}
        except Exception as e:
            traceback.print_exc()
            return {'errinfo': str(e), 'output': output}

    def dockerGetContainers(self):
        # Nodes for Docker containers
        if not self.client: return {'errinfo': 'No server connection'}
        containersParentKey = self.serverKey+'_docker_containers'
        retval = self.dockerCommandJsonResult('docker container ls --format=json -a')
        if retval.get('errinfo'):
            containerList = [{'key': self.serverKey+'_docker_container_error', 'title': retval.get('errinfo'), 'isLeaf': True, }]
        else:
            containerList = [{'key': self.serverKey+'_docker_container_'+x['ID'], 'theName': x['Names'], 'title': x['Names']+' ('+x['State']+')', 'isLeaf': True, 'parent': containersParentKey, 'raw':x } for x in (retval.get('output') or [])]
        return {'key': containersParentKey, 'title': 'Containers', 'isLeaf': False, 'children': containerList, 'subMenus':[
            {'label': 'restart', 'key': 'tree_menu_command_container_restart', 'command': self.dockerManualPrefix+'docker container restart {theName}', 'icon':'ReloadOutlined', 'refresh': True },
            {'type': 'divider', 'key': tools.getRandomString() },
            {'label': 'start', 'key': 'tree_menu_command_container_start', 'command': self.dockerManualPrefix+'docker container start {theName}', 'icon':'CaretRightOutlined', 'refresh': True },
            {'label': 'pause', 'key': 'tree_menu_command_container_pause', 'command': self.dockerManualPrefix+'docker container pause {theName}', 'icon':'PauseOutlined', 'refresh': True },
            {'label': 'stop', 'key': 'tree_menu_command_container_stop', 'command': self.dockerManualPrefix+'docker container stop {theName}', 'icon':'BorderOutlined', 'refresh': True },
            {'type': 'divider', 'key': tools.getRandomString() },
            {'label': 'logs -f', 'key': 'tree_menu_command_container_logs', 'command': self.dockerManualPrefix+'docker container logs -f {theName}', 'terminal': True, 'icon':'UnorderedListOutlined', 'hideSide': True },
            {'label': 'inspect', 'key': 'tree_menu_command_container_inspect', 'command': self.dockerManualPrefix+'docker container inspect {theName}', 'icon':'EyeOutlined', 'hideSide': True },
            {'label': 'stats --no-stream', 'key': 'tree_menu_command_container_stats', 'command': self.dockerManualPrefix+'docker container stats --no-stream {theName}', 'icon':'LineChartOutlined', 'hideSide': True },
            {'type': 'divider', 'key': tools.getRandomString() },
            {'label': 'rm', 'key': 'tree_menu_command_container_rm', 'command': self.dockerManualPrefix+'docker container rm {theName}', 'icon':'DeleteOutlined', 'refresh': True, 'confirm': 'Are you sure you want to delete this container' },
        ]}

    def dockerGetImages(self):
        # Nodes for Docker images
        if not self.client: return {'errinfo': 'No server connection'}
        imagesParentKey = self.serverKey+'_docker_images'
        retval = self.dockerCommandJsonResult('docker image ls --format=json -a')
        if retval.get('errinfo'):
            imageList = [{'key': self.serverKey+'_docker_image_error', 'title': retval.get('errinfo'), 'isLeaf': True, }]
        else:
            imageList = [{'key': self.serverKey+'_docker_image_'+x['ID'], 'theName': x['Repository'], 'title': x['Repository']+':'+x['Tag']+' ('+x['Size']+')', 'isLeaf': True, 'parent': imagesParentKey, 'raw':x } for x in (retval.get('output') or [])]
        return {'key': imagesParentKey, 'title': 'Images', 'isLeaf': False, 'children': imageList, 'subMenus':[
            {'label': 'inspect', 'key': 'tree_menu_command_image_inspect', 'command': self.dockerManualPrefix+'docker image inspect {theName}', 'icon':'EyeOutlined', 'hideSide': True },
            {'label': 'history', 'key': 'tree_menu_command_image_history', 'command': self.dockerManualPrefix+'docker image history {theName}', 'icon':'HistoryOutlined', 'hideSide': True },
            {'type': 'divider', 'key': tools.getRandomString() },
            {'label': 'rm', 'key': 'tree_menu_command_image_rm', 'command': self.dockerManualPrefix+'docker image rm {theName}', 'icon':'DeleteOutlined', 'refresh': True, 'confirm': 'Are you sure you want to delete this image' },
        ]}

    def dockerGetComposes(self):
        # Nodes for Docker compose
        if not self.client: return {'errinfo': 'No server connection'}
        composeParentKey = self.serverKey+'_docker_composes'
        if self.dockerComposePrefix == None:
            retval = self.dockerComposeCheckEnv()
            if isinstance(retval, str):
                composeList = [{'key': self.serverKey+'_docker_compose_error', 'title': retval, 'isLeaf': True, }]
            elif retval and retval.get('errinfo'):
                composeList = [{'key': self.serverKey+'_docker_compose_error', 'title': retval.get('errinfo'), 'isLeaf': True, }]
        retval = self.dockerComposeJsonResult(' ls --format=json -a')
        if retval.get('errinfo'):
            composeList = [{'key': self.serverKey+'_docker_compose_error', 'title': retval.get('errinfo'), 'isLeaf': True, }]
        else:
            composeList = [{'key': self.serverKey+'_docker_compose_'+x['Name'], 'theName':x['ConfigFiles'], 'title': x['Name']+' - '+x['Status'], 'isLeaf': True, 'parent': composeParentKey, 'raw':x } for x in (retval.get('output') or [])]
        return {'key': composeParentKey, 'title': 'Composes', 'isLeaf': False, 'children': composeList, 'subMenus':[
            {'label': 'restart', 'key': 'tree_menu_command_compose_restart', 'command': self.dockerManualPrefix+self.dockerComposePrefix+' -f {theName} restart', 'icon':'ReloadOutlined', 'refresh': True },
            {'type': 'divider', 'key': tools.getRandomString() },
            {'label': 'start', 'key': 'tree_menu_command_compose_start', 'command': self.dockerManualPrefix+self.dockerComposePrefix+' -f {theName} start', 'icon':'CaretRightOutlined', 'refresh': True },
            {'label': 'pause', 'key': 'tree_menu_command_compose_pause', 'command': self.dockerManualPrefix+self.dockerComposePrefix+' -f {theName} pause', 'icon':'PauseOutlined', 'refresh': True },
            {'label': 'stop', 'key': 'tree_menu_command_compose_stop', 'command': self.dockerManualPrefix+self.dockerComposePrefix+' -f {theName} stop', 'icon':'BorderOutlined', 'refresh': True },
            {'type': 'divider', 'key': tools.getRandomString() },
            {'label': 'logs -f', 'key': 'tree_menu_command_compose_logs', 'command': self.dockerManualPrefix+self.dockerComposePrefix+' -f {theName} logs -f', 'terminal': True, 'icon':'UnorderedListOutlined', 'hideSide': True },
            {'type': 'divider', 'key': tools.getRandomString() },
            {'label': 'up -d', 'key': 'tree_menu_command_compose_up-d', 'command': self.dockerManualPrefix+self.dockerComposePrefix+' -f {theName} up -d', 'icon':'VerticalAlignTopOutlined', 'refresh': True },
            {'label': 'down && up -d', 'key': 'tree_menu_command_compose_down_up-d', 'command': self.dockerManualPrefix+self.dockerComposePrefix+' -f {theName} down && '+self.dockerManualPrefix+self.dockerComposePrefix+' -f {theName} up -d', 'icon':'ColumnHeightOutlined', 'refresh': True },
            {'label': 'down', 'key': 'tree_menu_command_compose_down', 'command': self.dockerManualPrefix+self.dockerComposePrefix+' -f {theName} down', 'icon':'DeleteOutlined', 'confirm': 'Are you sure you want to delete this', 'refresh': True },
        ]}

    def dockerGetWholeTree(self, sudoPass=None):
        # Get the whole docker tree
        if not self.client: return {'errinfo': 'No server connection'}
        if self.dockerAutoPrefix == None:
            retval = self.dockerCheckEnv(sudoPass)
            if retval and retval.get('errinfo'): return retval
        featureList = []
        retval = self.dockerGetCommandResult('docker --version')
        if retval and retval.get('errinfo'): return retval
        output = retval.get('output')
        # Nodes for Docker Server
        if (output and output.strip().find('Docker version')>=0):
            # Insert a node to show the Docker version
            featureList.append({'key': self.serverKey+'_docker_version', 'title': output, 'isLeaf': True, 'menus':[
                {'label': 'ps -a', 'key': 'tree_menu_command_ps_a', 'command': self.dockerManualPrefix+'docker ps -a', 'icon':'ToolOutlined' },
                {'label': 'images', 'key': 'tree_menu_command_images', 'command': self.dockerManualPrefix+'docker images', 'icon':'FileImageOutlined'},
                {'label': 'stats', 'key': 'tree_menu_command_stats', 'command': self.dockerManualPrefix+'docker stats --no-stream', 'icon':'LineChartOutlined'},
            ]})
            featureList.append(self.dockerGetContainers())
            featureList.append(self.dockerGetImages())
            featureList.append(self.dockerGetComposes())
        return {'version': output, 'featureList': featureList}


class WebSocketSSHClient(SSHClient):
    def sendWebSocketData(self, data1, tabKey=''):
        tabKey = tabKey or self.uniqueKey
        if tabKey in self.parentApi.socketConnections:
            wsock = self.parentApi.socketConnections[tabKey]
            try:
                wsock.send(data1)
            except Exception as e:
                self.parentApi.socketConnections.pop(tabKey, None)

    def updateWorkspaceTabTitle(self, serverKey):
        # serverKey = '' means to clear the title of the tab
        self.parentApi.workspaceWorkingChannel = serverKey
        pack1 = base64.b64encode(json.dumps({'serverKey': serverKey, 'action': 'updateWorkspaceTabTitle'}).encode()).decode()
        self.sendWebSocketData(pack1)


class TerminalClient(WebSocketSSHClient):
    def onChannelData(self, bdata):
        # Send output to frontend xterm
        data1 = base64.b64encode(bdata).decode()
        self.sendWebSocketData(data1)

    def onChannelClose(self):
        super().onChannelClose()
        pack1 = base64.b64encode(json.dumps({'uniqueKey': self.uniqueKey, 'action': 'closeThisTab'}).encode()).decode()
        self.sendWebSocketData(pack1, 'workspace')


class WorkspaceClient(WebSocketSSHClient):
    def onChannelData(self, bdata):
        # Send output to frontend xterm
        data1 = base64.b64encode(bdata).decode()
        pack1 = base64.b64encode(json.dumps({'data': data1, 'action': 'data'}).encode()).decode()
        self.sendWebSocketData(pack1)

    def onChannelClose(self):
        super().onChannelClose()
        self.updateWorkspaceTabTitle('')


class SchedulerClient(WebSocketSSHClient):
    def onChannelData(self, bdata):
        # All SSH channel data will be passed here directly. Do nothing for a Scheduler Client
        pass

    def onChannelString(self, string):
        # Some output from execTask and execPipeline will be passed here. Do nothing for a Scheduler Client
        pass

    def updateWorkspaceTabTitle(self, serverKey):
        # Do not need to update the tab title for a Scheduler Client
        pass

    def channelCommandStart(self, command):
        # SSH channel will return a command input, so no need to save it here
        pass
        # print(self.__class__, 'channelCommandStart', command)
        # if hasattr(self.parentApi, 'log_id'):
        #     print('log_id', self.parentApi.log_id)
        #     dbpath = os.path.join(apis.folder_base, 'scheduler.db')
        #     logdb = tools.SQLiteDB(dbpath)
        #     logdb.update("UPDATE schedule_logs SET out = COALESCE(out, '') || ? WHERE id = ?", (command, self.parentApi.log_id))

    def channelCommandFinished(self, result):
        if hasattr(self.parentApi, 'log_id'):
            # Only schedule Api will have a log_id
            # Try to remove: prompt string, control characters, command lines, etc.
            # It's really diffcult to remove them all from output string.
            # Just save the whole channel output for now.
            # out2 = remove_ansi_color_codes(result)
            # if self.prompt_string:
            #     out2 = out2.replace(self.prompt_string, '')
            #     self.input.insert(0, self.prompt_string)
            # for line in self.input:
            #     out2 = out2.replace(line, '')
            dbpath = os.path.join(apis.folder_base, 'scheduler.db')
            logdb = tools.SQLiteDB(dbpath)
            # Get the obh, sch. Then get the schedule object
            sql_str = "SELECT * FROM schedule_logs WHERE id = ?"
            arg_arr = [self.parentApi.log_id]
            retdat = logdb.query(sql_str, arg_arr)
            if retdat and retdat[0]:
                sch = retdat[0]['sch']
                scheduleObj = scheduler.getScheduleObject(sch)
                if scheduleObj and (not scheduleObj.get('runMode') == 'command'):
                    logdb.update("UPDATE schedule_logs SET out1 = COALESCE(out1, '') || ? WHERE id = ?", (result, self.parentApi.log_id))
                    if scheduleObj.get('recipients') and result:
                        out2 = re.search(scheduleObj.get('regex'), result) if scheduleObj.get('regex') else [result]
                        amsg = (result[:512]+'...') if len(result)>512 else result
                        if out2:
                            self.parentApi.sendNotification({'recipients': scheduleObj.get('recipients'), 'message': amsg, 'mid': self.parentApi.log_id, 'title': sch, 'obh': retdat[0]['obh']})
