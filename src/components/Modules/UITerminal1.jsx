import React from 'react';
import { Base64 } from 'js-base64';
import { App } from "antd";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

import { useCustomContext } from '../Contexts/CustomContext'
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'
import { callApi } from '../Common/global';
import "./Terminal.css";

const termOptions = {
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontWeight: 400,
    fontSize: 14,
    cursorBlink: true,
}

export default function WebTerminal(props) {
    const { message } = App.useApp();
    const { customTheme, userSession } = useCustomContext();
    const xtermRef = React.useRef(null)
    const divTerminalContainer = React.useRef(null)
    const uniqueKey = props.uniqueKey;
    const serverKey = props.serverKey;
    const taskKey = props.taskKey;
    const withCommand = props.withCommand;
    const socketObject = React.useRef(null);
    const access_terminal = userSession.accesses.terminal;

    React.useEffect(() => {
        const hasTerm = !!xtermRef.current;
        xtermRef.current = new Terminal(termOptions);
        xtermRef.current.fitAddon = new FitAddon();

        const sendData = (data) => {
            if(socketObject.current && socketObject.current.readyState === WebSocket.OPEN) {
                socketObject.current.send(JSON.stringify({ uniqueKey:uniqueKey, serverKey:serverKey, input:data}));
            }
            if (!xtermRef.current.resized) {
                onResize();
                xtermRef.current.resized = true;
            }
        }
        const handlerData = (data) => {
            if(access_terminal) {
                sendData(data);
            }
        }

        const onResize = () => {
            if(window.oypaseTabs.tabActiveKey !== uniqueKey) return;
            // console.log('cols: ' + xtermRef.current._core._bufferService.cols, 'rows: ' + xtermRef.current._core._bufferService.rows);
            xtermRef.current.fitAddon.fit();
            if(socketObject.current && socketObject.current.readyState === WebSocket.OPEN) {
                socketObject.current.send(JSON.stringify({ action:'resize', uniqueKey:uniqueKey, cols:xtermRef.current._core._bufferService.cols, rows:xtermRef.current._core._bufferService.rows}));
            }
        }

        const termDom = document.getElementById("terminal_"+uniqueKey);
        xtermRef.current.open(termDom);
        xtermRef.current.focus();
        xtermRef.current.loadAddon(xtermRef.current.fitAddon);
        xtermRef.current.onData(handlerData);
        window.oypaseTabs = window.oypaseTabs || {}; window.oypaseTabs[uniqueKey] = xtermRef.current;
        onResize();
        window.addEventListener('resize', onResize);
        if(!hasTerm) {
            callApi('createTermConnection', {serverKey:serverKey, uniqueKey:uniqueKey, taskKey:taskKey}).then(res => {
                if(res?.errinfo) {
                    if(xtermRef.current) { xtermRef.current.write(res.errinfo); }
                    else { message.error(res.errinfo); }
                }else if(withCommand) {
                    setTimeout(() => {
                        sendData(withCommand+'\r');
                    }, 500);
                }
            });
        }
        return () => {
            callApi('closeTermConnection', {uniqueKey:uniqueKey, serverKey:serverKey});
            window.removeEventListener('resize', onResize);
            if(xtermRef.current) xtermRef.current.dispose();
        }
    }, [uniqueKey, serverKey, taskKey, withCommand, message, access_terminal]);

    React.useEffect(() => {
        const hasSocket = !!socketObject.current;
        if(!hasSocket) {
            socketObject.current = process.env.NODE_ENV === 'development'
                ? new WebSocket(`ws://${window.location.hostname}:19790/websocket`) // for local testing
                : new WebSocket((window.OYSAPE_BACKEND_HOST||'').replace('http', 'ws')+'/websocket');
            socketObject.current.onopen = () => {
                // console.log('WebSocket Connected');
                socketObject.current.send(JSON.stringify({ action: 'init', uniqueKey:uniqueKey }));
            }
            socketObject.current.onmessage = function(event) {
                const message = event.data;
                if(xtermRef.current) xtermRef.current.write(Base64.decode(message));
            }
            socketObject.current.onclose = () => {
                // console.log('WebSocket Disconnected');
            };
            socketObject.current.onerror = (error) => {
                // console.error('WebSocket Error: ', error);
            };
        }
        return () => {
            if(socketObject.current) {
                socketObject.current.close();
                socketObject.current = null;
            }
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
            <div id={"terminal_"+uniqueKey} ref={divTerminalContainer}
                autoFocus={true}
                style={{ height: "100%", width: "100%" }}></div>
        </div>
    );
}
