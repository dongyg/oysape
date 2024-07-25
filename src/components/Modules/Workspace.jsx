import React from 'react';
import { App } from 'antd';
import { Base64 } from 'js-base64';
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { SearchAddon } from "xterm-addon-search";
import "xterm/css/xterm.css";

import { useCustomContext } from '../Contexts/CustomContext'
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'
import { callApi, writeWelcome, colorizeText } from '../Common/global';
import "./Terminal.css";

const termOptions = {
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontWeight: 400,
    fontSize: 14,
    // disableStdin: true,
    // cursorInactiveStyle: 'block',
    cursorBlink: true,
}

export default function WorkspaceTerminal(props) {
  const { message, notification } = App.useApp();
  const { customTheme, setTabActiveKey, tabItems, setTabItems, setBrowserInfo, userSession } = useCustomContext();
    const xtermRef = React.useRef(null)
    const divTerminalContainer = React.useRef(null)
    const currentWorkingChannel = React.useRef('')
    const uniqueKey = props.uniqueKey;
    const socketObject = React.useRef(null);
    const socketPinger = React.useRef(null);

    const updateWorkspaceTabTitle = (serverKey) => {
        currentWorkingChannel.current = serverKey;
        tabItems[0].label = serverKey ? ('Working on (' + serverKey + ')') : 'Workspace';
        setTabItems([...tabItems]);
    }
    const callTask = (taskObj, serverObj, taskInput) => {
        const taskKey = taskInput.task;
        const serverKey = taskInput.server;
        if(!taskKey || !serverKey) return;
        callApi('testIfTaskCanRunOnServer', {taskKey: taskKey, serverKey: serverKey}).then(res1 => {
            if(!res1) {
                message.warning('Please wait for tasks to finish...');
                return;
            }
            // Set the workspace's tab label if workspace is interaction
            if(userSession.accesses.terminal) {
                updateWorkspaceTabTitle(taskObj.interaction==='interactive'||taskObj.interaction==='terminal'?serverKey:'');
            }
            // xtermRef.current.write(showCursor);
            // xtermRef.current.setOption('disableStdin',false);
            setTabActiveKey('workspace');
            setTimeout(() => {
                xtermRef.current.focus();
            }, 10);
            // xtermRef.current.write(colorizeText(serverKey, 'cyan', customTheme.type==='light' ? 'white' : 'gray'));
            // const command = taskObj.cmds.join('\r\n');
            // console.log(command);
            // xtermRef.current.write(command);
            callApi('setTheme', {type:customTheme.type}).then((data) => {}); // To ensure the theme is set on backend
            callApi('callTask', {taskKey:taskKey, serverKey:serverKey}).then(res => {
                if(res&&res.errinfo) {
                    message.error(res.errinfo);
                    xtermRef.current.write('\r\n\r\n'+colorizeText(res.errinfo, 'red', customTheme.type==='light' ? 'white' : 'gray'));
                }
            }).catch(err => {});
        }).catch(err => {});
    }
    const callPipeline = (pipelineObj) => {
        callApi('testIfPipelineCanRun', {pipelineName:pipelineObj.name}).then(res1 => {
            if(!res1) {
                message.warning('Please wait for tasks to finish...');
                return;
            }
            const pipelineName = pipelineObj.name;
            updateWorkspaceTabTitle('');
            setTabActiveKey('workspace');
            xtermRef.current.focus();
            xtermRef.current.write('\r\n\r\n'+colorizeText('Pipeline: '+pipelineName, 'green', customTheme.type==='light' ? 'white' : 'gray'));
            callApi('setTheme', {type:customTheme.type}).then((data) => {}); // To ensure the theme is set on backend
            callApi('callPipeline', {pipelineName:pipelineName}).then(res2 => {}).catch(err => {});
        }).catch(err => {});
    }

    window.callTask = callTask;
    window.callPipeline = callPipeline;
    window.updateWorkspaceTabTitle = updateWorkspaceTabTitle;

    React.useEffect(() => {
        xtermRef.current = new Terminal(termOptions);
        xtermRef.current.fitAddon = new FitAddon();
        xtermRef.current.searchAddon = new SearchAddon();

        const sendData = (data) => {
            if(socketObject.current && socketObject.current.readyState === WebSocket.OPEN) {
                socketObject.current.send(JSON.stringify({uniqueKey:uniqueKey, input:data}));
            }
            if (!xtermRef.current.resized) {
                onResize();
                xtermRef.current.resized = true;
            }
        }
        const handlerData = (data) => {
            if(!currentWorkingChannel.current) return;
            sendData(data);
        }

        const onResize = () => {
            if(window.oypaseTabs.tabActiveKey !== uniqueKey) return;
            // console.log('cols: ' + xtermRef.current._core._bufferService.cols, 'rows: ' + xtermRef.current._core._bufferService.rows);
            xtermRef.current.fitAddon.fit();
            if(socketObject.current && socketObject.current.readyState === WebSocket.OPEN) {
                socketObject.current.send(JSON.stringify({action:'resize', uniqueKey:uniqueKey, cols:xtermRef.current._core._bufferService.cols, rows:xtermRef.current._core._bufferService.rows}));
            }
        }

        const termDom = document.getElementById("terminal_workspace");
        xtermRef.current.open(termDom);
        xtermRef.current.loadAddon(xtermRef.current.fitAddon);
        xtermRef.current.onData(handlerData);
        xtermRef.current.onMobileData = (data) => {
            handlerData(data['input']);
        }
        window.oypaseTabs = window.oypaseTabs || {}; window.oypaseTabs.tabActiveKey = uniqueKey; window.oypaseTabs[uniqueKey] = xtermRef.current;
        onResize();
        // xtermRef.current.write(hideCursor+clearTerminal);
        setBrowserInfo(xtermRef.current._core.browser);
        writeWelcome(xtermRef.current);
        window.addEventListener('resize', onResize);
        // console.log(navigator.userAgent);
        return () => {
            callApi('closeCombConnections', {});
            window.removeEventListener('resize', onResize);
            xtermRef.current.dispose();
            delete window.oypaseTabs[uniqueKey];
        }
    }, [setBrowserInfo, uniqueKey]);

    React.useEffect(() => {
        const hasSocket = !!socketObject.current;
        if(!hasSocket) {
            const url = process.env.NODE_ENV === 'development'
                ? `ws://${window.location.hostname}:19790/websocket` // for local testing
                : ((window.OYSAPE_BACKEND_HOST||'').replace('http', 'ws')+'/websocket');
            console.log(url);
            socketObject.current = new WebSocket(url);
            xtermRef.current.socketObject = socketObject.current;
            socketObject.current.onopen = () => {
                console.log('WebSocket Connected');
                socketObject.current.send(JSON.stringify({action: 'init', uniqueKey:uniqueKey }));
                socketPinger.current = setInterval(() => {
                    if (socketObject.current.readyState === WebSocket.OPEN) {
                        socketObject.current.send(JSON.stringify({action: 'ping', uniqueKey:uniqueKey }));
                    }
                }, 30*1000);
            }
            socketObject.current.onmessage = function(event) {
                const message = event.data;
                const pack1 = JSON.parse(Base64.decode(message));
                if(pack1.action === 'data') {
                    xtermRef.current.write(Base64.decode(pack1.data));
                }else if(pack1.action === 'closeThisTab') {
                    window.closeThisTab && window.closeThisTab(pack1.uniqueKey);
                }else if(pack1.action === 'updateWorkspaceTabTitle') {
                    window.updateWorkspaceTabTitle && window.updateWorkspaceTabTitle(pack1.serverKey);
                }
            }
            socketObject.current.onclose = () => {
                console.log('WebSocket Disconnected');
                socketPinger.current && clearInterval(socketPinger.current);
            };
            socketObject.current.onerror = (error) => {
                // console.error('WebSocket Error: ', error);
                if(process.env.NODE_ENV !== 'development'){
                    notification.error({
                        message: 'WebSocket Error',
                        description: 'Failed to connect to WebSocket. Terminal communication will be unavailable.',
                    });
                }
                socketPinger.current && clearInterval(socketPinger.current);
            };
        }
        return () => {
            if(socketObject.current) {
                socketObject.current.close();
                socketObject.current = null;
            }
        }
    }, [notification, uniqueKey]);

    React.useEffect(() => {
        xtermRef.current.setOption('theme', {
            background: customTheme.colors["editor.background"],
            cursor: customTheme.isDark?'white':'darkgrey',
            foreground: customTheme.colors["editor.foreground"],
        });
    }, [customTheme])

    useKeyPress(keyMapping["terminalClear"], (event) => {
        xtermRef.current.clear();
        event.preventDefault(); return;
    }, divTerminalContainer.current);

    return (
        <div className={customTheme.className} style={{ height: "100%" }}>
            <div id="terminal_workspace" ref={divTerminalContainer} style={{ height: "100%", width: "100%" }}></div>
        </div>
    );
}
