import React, { useState, useEffect, useCallback } from 'react';
import { App, Table, Layout, } from 'antd';
import dayjs from 'dayjs';

import AnsiText from './AnsiText';
import { useCustomContext } from '../Contexts/CustomContext';
import { callApi } from '../Common/global';

const { Content, Sider } = Layout;

function decolorizeText(text) {
    const ansiEscape = /[\u001b\u009b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*[0-9A-ORZcf-nqry=><]?|[^\x1b\x9b]*[\x1b\x9b]?[0-9A-ORZcf-nqry=><])/g;
    return text.replace(ansiEscape, '');
}

const ScheduleLogViewer = ({ obh, sch, tname }) => {
    const { message } = App.useApp();
    const { customTheme } = useCustomContext();
    const [logs, setLogs] = useState([]);
    const [logTitle, setLogTitle] = useState('');
    const [currLogContent, setCurrLogContent] = useState('');
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0, showSizeChanger: false });

    const fetchLogs = useCallback((page = pagination.current, pageSize = pagination.pageSize) => {
        callApi('callFetchScheduleLogs', { obh, sch, page, pageSize, tname }).then((data) => {
            console.log('fetchLogs', data);
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
    }, [obh, sch, message]); // remove pagination from dependencies to avoid re-running

    const handleTableChange = useCallback((pagination) => {
        fetchLogs(pagination.current, pagination.pageSize);
    }, [fetchLogs]);

    useEffect(() => {
        fetchLogs();
    }, []); // empty dependency array to avoid re-running

    let columns = [ { title: 'Time', dataIndex: 'ts', key: 'ts', width: 178, }, ]
    if(!sch) {
        columns.push(
            { title: 'Task', dataIndex: 'sch', key: 'sch', width: 120, },
        );
    }
    columns.push(
        { title: 'Output', dataIndex: 'out', key: 'out', render: text => `${decolorizeText(text||'').substring(0, 24)}${decolorizeText(text||'').length>24?'...':''}`, }
    );

    return (
        <Layout>
            <Sider width={sch?440:560} height="100%" theme="light">
                <Table style={{ height: "100%" }}
                    dataSource={logs}
                    columns={columns}
                    rowKey="id"
                    pagination={pagination}
                    onChange={handleTableChange}
                    onRow={(record) => ({
                        onClick: () => {
                          setLogTitle(`Log Viewer - ${record.ts}`);
                          setCurrLogContent(record.out);
                        }
                    })}
                />
            </Sider>
            <Content className='withScrollContent enableHighlight'>
                <div style={{ height: "55px", lineHeight: "55px", padding: "0 20px", fontWeight: 700 }}>{logTitle}</div>
                <div className={customTheme.className} style={{ height: "calc(100% - 55px)", backgroundColor: customTheme.colors["editor.background"], padding: "4px" }}>
                    <div style={{ height: "100%", width: "100%" }}><AnsiText text={currLogContent} /></div>
                </div>
            </Content>
        </Layout>
    );
};

export default ScheduleLogViewer;
