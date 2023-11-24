import React from 'react';
import { Base64 } from 'js-base64';
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
    const { customTheme } = useCustomContext();
    const xtermRef = React.useRef(null)
    const divTerminalContainer = React.useRef(null)
    const inTabKey = props.inTabKey;
    const uniqueKey = props.uniqueKey;
    const serverKey = props.serverKey;
    const taskKey = props.taskKey;

    React.useEffect(() => {
        const hasTerm = !!xtermRef.current;
        xtermRef.current = new Terminal(termOptions);
        xtermRef.current.fitAddon = new FitAddon();

        const prompt = () => {
            xtermRef.current.write("\x1b[33m$\x1b[0m ");
        }

        const handlerData = (data) => {
            // console.log('cmd:', data);
            callApi('sendTerminalInput', {uniqueKey:uniqueKey, serverKey:serverKey, input:data})
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
            if(window.xterms.tabActiveKey !== inTabKey) return;
            // console.log('cols: ' + xtermRef.current._core._bufferService.cols, 'rows: ' + xtermRef.current._core._bufferService.rows);
            xtermRef.current.fitAddon.fit();
            if (window.pywebview) {
                callApi('resizeTermChannel', {uniqueKey:uniqueKey, cols:xtermRef.current._core._bufferService.cols, rows:xtermRef.current._core._bufferService.rows});
            }
        }

        const termDom = document.getElementById("terminal_"+uniqueKey);
        xtermRef.current.open(termDom);
        xtermRef.current.focus();
        xtermRef.current.loadAddon(xtermRef.current.fitAddon);
        xtermRef.current.onData(handlerData);
        window.xterms = window.xterms || {}; window.xterms[uniqueKey] = xtermRef.current;
        onResize();
        window.addEventListener('resize', onResize);
        if (window.pywebview) {
            if (!window.pywebview.termbridge) {
                window.pywebview.termbridge = {}
            }
            window.pywebview.termbridge['onChannelData_'+uniqueKey] = (data) => {
                // console.log('out: '+Base64.decode(data));
                xtermRef.current.write(Base64.decode(data));
            }
            if(!hasTerm) callApi('createTermConnection', {serverKey:serverKey, uniqueKey:uniqueKey, taskKey:taskKey});
        }
        return () => {
            if (window.pywebview) {
                callApi('closeTermConnection', {uniqueKey:uniqueKey, serverKey:serverKey});
                delete window.pywebview.termbridge['onChannelData_'+uniqueKey];
            }
            window.removeEventListener('resize', onResize);
            xtermRef.current.dispose();
        }
    }, [uniqueKey, serverKey, taskKey, inTabKey]);

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
            <div id={"terminal_"+uniqueKey} ref={divTerminalContainer} style={{ height: "100%", width: "100%" }}></div>
        </div>
    );
}
