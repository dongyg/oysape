import React, { useState, useEffect, useCallback } from 'react';
import { App, Table, Layout, } from 'antd';
import dayjs from 'dayjs';

import AnsiText from './AnsiText';
import { useCustomContext } from '../Contexts/CustomContext';
import { callApi, decolorizeText } from '../Common/global';

const { Content, Sider } = Layout;

const ScheduleLogViewer = ({ obh, sch, tid, tname }) => {
    const { message } = App.useApp();
    const { customTheme } = useCustomContext();
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [logs, setLogs] = useState([]);
    const [logTitle, setLogTitle] = useState('');
    const [currLogContent, setCurrLogContent] = useState('');
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0, showSizeChanger: false, showQuickJumper: true, showTotal: total => `Total ${total}` });

    const fetchLogs = useCallback((page, pageSize) => {
        callApi('callFetchScheduleLogs', { obh, sch, page, pageSize, tid, tname }).then((data) => {
            if(data && data.errinfo) {
                message.error(data.errinfo);
            }else if(data && data.list){
                setLogs(data.list);
                setPagination(prev => ({ ...prev, total: data.total, current: page, pageSize }));
            }
        }).catch((err) => { message.error(err.message); });
    }, [obh, sch, message, tid, tname]);

    const handleTableChange = useCallback((pagination) => {
        fetchLogs(pagination.current, pagination.pageSize);
    }, [fetchLogs]);

    useEffect(() => {
        fetchLogs(1, 10);
    }, [fetchLogs]); // empty dependency array to avoid re-running

    let columns = [ { title: 'Time', dataIndex: 'ts', key: 'ts', render: text => dayjs.unix(text).format('MM-DD HH:mm:ss')  }, ]
    if(!sch) {
        columns.push(
            { title: 'Task', dataIndex: 'sch', key: 'sch',  },
        );
    }
    columns.push(
        { title: 'Output', dataIndex: 'out1', key: 'out1', render: text => `${decolorizeText(text||'').substring(0, 24)}${decolorizeText(text||'').length>24?'...':''}`, }
    );

    const selectRow = (record) => {
        setSelectedRowKeys([record.key]);
    };
    const onSelectedRowKeysChange = (selectedRowKeys) => {
        setSelectedRowKeys(selectedRowKeys);
    };
    const rowSelection = {
        selectedRowKeys,
        hideSelectAll: true,
        columnTitle: '',
        type: 'radio',
        onChange: onSelectedRowKeysChange,
        columnWidth: 0,
    };

    return (
        <Layout>
            <Sider width={sch?440:560} height="100%" theme="light">
                <Table size="small" style={{ height: "100%" }}
                    className='hide-selection-column'
                    rowSelection={rowSelection}
                    dataSource={logs}
                    columns={columns}
                    rowKey="id"
                    pagination={pagination}
                    onChange={handleTableChange}
                    onRow={(record) => ({
                        onClick: () => {
                            selectRow(record);
                            setLogTitle(`Log Viewer - ${ dayjs.unix(record.ts).format('YYYY-MM-DD HH:mm:ss')}`);
                            setCurrLogContent(record.out1);
                        },
                        onContextMenu: () => {
                            selectRow(record);
                        },
                        onDoubleClick: () => {
                            selectRow(record);
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
