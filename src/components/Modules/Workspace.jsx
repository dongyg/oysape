import React from 'react';
import { Base64 } from 'js-base64';
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
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

export default function CombinedTerminal(props) {
    const { customTheme, setTabActiveKey, tabItems, setTabItems } = useCustomContext();
    const xtermRef = React.useRef(null)
    const divTerminalContainer = React.useRef(null)
    const currentWorkingChannel = React.useRef('')
    const uniqueKey = props.uniqueKey;
    // const clearTerminal = '\x1b[2J\r';
    // const ctrl_c = '\x03';
    // const ctrl_d = '\x04';
    // const hideCursor = '\x1b[?25l';
    // const showCursor = '\x1b[?25h';

    const updateWorkspaceTabTitle = (serverKey) => {
        currentWorkingChannel.current = serverKey;
        tabItems[0].label = serverKey ? ('Working on (' + serverKey + ')') : 'Workspace';
        setTabItems([...tabItems]);
    }
    const callTask = (taskObj, serverObj, taskInput) => {
        const taskKey = taskInput.task;
        const serverKey = taskInput.server;
        if(!taskKey || !serverKey) return;
        // Set the workspace's tab label if workspace is interaction
        updateWorkspaceTabTitle(taskObj.interaction==='interactive'?serverKey:'');
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
        callApi('callTask', {taskKey:taskKey, serverKey:serverKey}).then(res => {}).catch(err => {});
    }
    const callPipeline = (pipelineName) => {
        updateWorkspaceTabTitle('');
        setTabActiveKey('workspace');
        xtermRef.current.focus();
        xtermRef.current.write('\r\n\r\n'+colorizeText('Pipeline: '+pipelineName, 'green', customTheme.type==='light' ? 'white' : 'gray'));
        callApi('callPipeline', {pipelineName:pipelineName})
            .then(res => {
            })
            .catch(err => {
            });
    }

    window.callTask = callTask;
    window.callPipeline = callPipeline;
    window.closeWorkspaceChannel = (serverKey) => {
        currentWorkingChannel.current = '';
        tabItems[0].label = 'Workspace';
        setTabItems([...tabItems]);
    }

    React.useEffect(() => {
        xtermRef.current = new Terminal(termOptions);
        xtermRef.current.fitAddon = new FitAddon();

        const prompt = () => {
            xtermRef.current.write("\x1b[33m$\x1b[0m ");
        }

        const handlerData = (data) => {
            // console.log('cmd:', data);
            if(!currentWorkingChannel.current) return;
            callApi('sendCombinedInput', {input:data})
                .then(res => {
                    if (!xtermRef.current.resized) {
                        onResize();
                        xtermRef.current.resized = true;
                    }
                })
                .catch(err => {
                    console.log(err);
                    xtermRef.current.write(data);
                    if(data === '\r') {
                        xtermRef.current.write('\n');
                        prompt();
                    }
                });
        }

        const onResize = () => {
            if(window.oypaseTabs.tabActiveKey !== uniqueKey) return;
            // console.log('cols: ' + xtermRef.current._core._bufferService.cols, 'rows: ' + xtermRef.current._core._bufferService.rows);
            xtermRef.current.fitAddon.fit();
            if (window.pywebview) {
                callApi('resizeAllCombChannel', {cols:xtermRef.current._core._bufferService.cols, rows:xtermRef.current._core._bufferService.rows});
            }
        }

        const termDom = document.getElementById("terminal_workspace");
        xtermRef.current.open(termDom);
        xtermRef.current.loadAddon(xtermRef.current.fitAddon);
        xtermRef.current.onData(handlerData);
        window.oypaseTabs = window.oypaseTabs || {}; window.oypaseTabs.tabActiveKey = uniqueKey; window.oypaseTabs[uniqueKey] = xtermRef.current;
        onResize();
        // xtermRef.current.write(hideCursor+clearTerminal);
        writeWelcome(xtermRef.current);
        window.addEventListener('resize', onResize);
        if (window.pywebview) {
            if (!window.pywebview.workbridge) {
                window.pywebview.workbridge = {}
            }
            window.pywebview.workbridge['onChannelData'] = (data) => {
                // console.log('out: '+Base64.decode(data));
                xtermRef.current.write(Base64.decode(data));
            }
        }
        return () => {
            if (window.pywebview) {
                callApi('closeCombConnections', {});
                delete window.pywebview.workbridge['onChannelData'];
            }
            window.removeEventListener('resize', onResize);
            xtermRef.current.dispose();
        }
    }, [uniqueKey]);

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
