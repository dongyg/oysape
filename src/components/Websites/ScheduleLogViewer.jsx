import React, { useState, useEffect, useRef, useCallback } from 'react';
import { App, Table, Layout, } from 'antd';
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import dayjs from 'dayjs';
import "xterm/css/xterm.css";

import { useCustomContext } from '../Contexts/CustomContext';
import { callApi } from '../Common/global';
import "../Modules/Terminal.css";

const { Content, Sider } = Layout;

const termOptions = {
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontWeight: 400,
    fontSize: 14,
    cursorBlink: false,
}

function decolorizeText(text) {
    const ansiEscape = /[\u001b\u009b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*[0-9A-ORZcf-nqry=><]?|[^\x1b\x9b]*[\x1b\x9b]?[0-9A-ORZcf-nqry=><])/g;
    return text.replace(ansiEscape, '');
}

const ScheduleLogViewer = ({ obh, sch, tname }) => {
    //TODO: sch can be empty string
    const { message } = App.useApp();
    const { customTheme } = useCustomContext();
    const [logs, setLogs] = useState([]);
    const [logTitle, setLogTitle] = useState('');
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0, showSizeChanger: false });
    const xtermRef = useRef(null);

    useEffect(() => {
        const terminal = new Terminal(termOptions);
        const fitAddon = new FitAddon();
        xtermRef.current = terminal;
        terminal.loadAddon(fitAddon);
        const termDom = document.getElementById("xterm_schedule_log");
        terminal.open(termDom);
        fitAddon.fit();

        return () => {
            terminal.dispose();
        };
    }, []);

    useEffect(() => {
      xtermRef.current.setOption('theme', {
          background: customTheme.colors["editor.background"],
          cursor: customTheme.isDark?'white':'darkgrey',
          foreground: customTheme.colors["editor.foreground"],
      });
    }, [customTheme])

    const fetchLogs = useCallback((page = pagination.current, pageSize = pagination.pageSize) => {
        callApi('callFetchScheduleLogs', { obh, sch, page, pageSize, tname }).then((data) => {
            console.log(data);
            if(data && data.errinfo) {
                message.error(data.errinfo);
            }else if(data && data.list){
                setLogs(data.list.map(log => ({
                    ...log,
                    ts: dayjs.unix(log.ts).format('YYYY-MM-DD HH:mm:ss')
                })));
                setPagination(prev => ({ ...prev, total: data.total, current: page, pageSize }));
            }
        });
    }, [obh, sch]); // remove pagination from dependencies to avoid re-running

    const handleTableChange = useCallback((pagination) => {
        fetchLogs(pagination.current, pagination.pageSize);
    }, [fetchLogs]);

    useEffect(() => {
        fetchLogs();
    }, []); // empty dependency array to avoid re-running

    const columns = [
        {
            title: 'Time',
            dataIndex: 'ts',
            key: 'ts',
            width: 178,
        },
        {
            title: 'Output',
            dataIndex: 'out',
            key: 'out',
            render: text => `${decolorizeText(text||'').substring(0, 24)}${decolorizeText(text||'').length>24?'...':''}`,
        }
    ];

    return (
        <Layout>
            <Sider width={440} height="100%" theme="light">
                <Table style={{ height: "100%" }}
                    dataSource={logs}
                    columns={columns}
                    rowKey="id"
                    pagination={pagination}
                    onChange={handleTableChange}
                    onRow={(record) => ({
                        onClick: () => {
                          setLogTitle(`Log Viewer - ${record.ts}`);
                          xtermRef.current.write('\x1bc');
                          xtermRef.current.clear();
                          xtermRef.current.write(record.out||'');
                        }
                    })}
                />
            </Sider>
            <Content>
                <div style={{ height: "55px", lineHeight: "55px", padding: "0 20px", fontWeight: 700 }}>{logTitle}</div>
                <div className={customTheme.className} style={{ height: "calc(100% - 55px)" }}>
                    <div id="xterm_schedule_log" style={{ height: "100%", width: "100%" }}></div>
                </div>
            </Content>
        </Layout>
    );
};

export default ScheduleLogViewer;
