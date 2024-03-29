import React from 'react';
import { Base64 } from 'js-base64';
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { SearchAddon } from "xterm-addon-search";
import "xterm/css/xterm.css";

import { useCustomContext } from '../Contexts/CustomContext'
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'
import { uniqueClientID, callApi, getTokenFromCookie, writeWelcome, colorizeText } from '../Common/global';
import "./Terminal.css";
import { message } from 'antd';

const termOptions = {
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontWeight: 400,
    fontSize: 14,
    // disableStdin: true,
    // cursorInactiveStyle: 'block',
    cursorBlink: true,
}

export default function WorkspaceTerminal(props) {
    const { customTheme, setTabActiveKey, tabItems, setTabItems, setBrowserInfo, userSession } = useCustomContext();
    const xtermRef = React.useRef(null)
    const divTerminalContainer = React.useRef(null)
    const currentWorkingChannel = React.useRef('')
    const uniqueKey = props.uniqueKey;
    const socketObject = React.useRef(null);
    const socketPinger = React.useRef(null);
    const token = getTokenFromCookie();

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
            if(userSession.teams[userSession.team0].is_creator || userSession.teams[userSession.team0].members.find(item => item.email === userSession.email)?.access_terminal) {
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
            callApi('callTask', {taskKey:taskKey, serverKey:serverKey}).then(res => {}).catch(err => {});
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
            socketObject.current.send(JSON.stringify({clientId: uniqueClientID, uniqueKey:uniqueKey, token:token, input:data}));
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
                socketObject.current.send(JSON.stringify({clientId: uniqueClientID, action:'resize', uniqueKey:uniqueKey, token:token, cols:xtermRef.current._core._bufferService.cols, rows:xtermRef.current._core._bufferService.rows}));
            }
        }

        const termDom = document.getElementById("terminal_workspace");
        xtermRef.current.open(termDom);
        xtermRef.current.loadAddon(xtermRef.current.fitAddon);
        xtermRef.current.onData(handlerData);
        window.oypaseTabs = window.oypaseTabs || {}; window.oypaseTabs.tabActiveKey = uniqueKey; window.oypaseTabs[uniqueKey] = xtermRef.current;
        onResize();
        // xtermRef.current.write(hideCursor+clearTerminal);
        setBrowserInfo(xtermRef.current._core.browser);
        writeWelcome(xtermRef.current);
        window.addEventListener('resize', onResize);
        console.log(navigator.userAgent);
        return () => {
            callApi('closeCombConnections', {});
            window.removeEventListener('resize', onResize);
            xtermRef.current.dispose();
        }
    }, [setBrowserInfo, uniqueKey, token, userSession]);

    React.useEffect(() => {
        const hasSocket = !!socketObject.current;
        if(!hasSocket) {
            socketObject.current = new WebSocket((window.OYSAPE_BACKEND_HOST||'').replace('http', 'ws')+'/websocket');
            socketObject.current.onopen = () => {
                // console.log('WebSocket Connected');
                socketObject.current.send(JSON.stringify({clientId: uniqueClientID, action: 'init', uniqueKey:uniqueKey, token:token }));
                socketPinger.current = setInterval(() => {
                    socketObject.current.send(JSON.stringify({clientId: uniqueClientID, action: 'ping', uniqueKey:uniqueKey, token:token }));
                }, 60*1000);
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
                // console.log('WebSocket Disconnected');
                socketPinger.current && clearInterval(socketPinger.current);
            };
            socketObject.current.onerror = (error) => {
                // console.error('WebSocket Error: ', error);
                socketPinger.current && clearInterval(socketPinger.current);
            };
        }
        return () => {
            if(socketObject.current) {
                socketObject.current.close();
                socketObject.current = null;
            }
        }
    }, [token, uniqueKey]);

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
