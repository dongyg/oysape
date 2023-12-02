import React, { useState, useEffect } from 'react';
import { App, Table, Dropdown, Input, Tag } from "antd";
import { SearchOutlined } from '@ant-design/icons';
import { EditOutlined, DeleteOutlined, QuestionCircleFilled } from "@ant-design/icons";
import { FiTerminal } from "react-icons/fi";
import { BsTerminal } from "react-icons/bs";

import { useCustomContext } from '../Contexts/CustomContext'
import { getUniqueKey, callApi } from '../Common/global';
import ServerEditor from './ServerEditor';

const ServerList = () => {
  const { message, modal } = App.useApp();
  const { tabItems, setTabItems, setTabActiveKey, serverItems, setServerItems } = useCustomContext();
  const [showServers, setShowServers] = useState(serverItems);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [multipleSelect, setMultipleSelect] = useState(false);
  const [editable, setEditable] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  const onSearchKeywordChange = (event) => {
    setSearchKeyword(event.target.value);
    filterServers(event.target.value);
  }

  const filterServers = React.useCallback((keyword, viewUpdate) => {
    setShowServers(
      (serverItems||[]).filter((server) => {
        return server.name.includes(keyword) || server.address.includes(keyword) || (server.username||'').includes(keyword)|| (server.tags&&server.tags.join(',').includes(keyword));
      })
    )
  }, [serverItems])

  const onClickMenu = ({ key }) => {
    if(!selectedRowKeys[0]) {
      // message.info(`Click on item ${key} ${selectedRowKeys[0]}`);
      return;
    }
    if(key === 'editServer') {
      editServer(selectedRowKeys[0]);
    }else if(key === 'deleteServer') {
      deleteServer(selectedRowKeys[0]);
    }else if(key === 'runOnServer') {
      runOnServer(selectedRowKeys[0]);
    }else if(key === 'terminalServer') {
      if(window.openServerTerminal) window.openServerTerminal(selectedRowKeys[0]);
    }
  };
  const contextItems = [
    { key: 'runOnServer', label: <strong>Run a task on this server</strong>, icon: <FiTerminal />, },
    { type: 'divider', },
    { key: 'terminalServer', label: 'Terminal', icon: <BsTerminal />, },
    { type: 'divider', },
    { key: 'editServer', label: 'Edit', icon: <EditOutlined />, },
    { key: 'deleteServer', label: 'Delete', icon: <DeleteOutlined />, },
  ];
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      render: (text, record, index) => {
        return (<Dropdown menu={{items: contextItems, onClick: onClickMenu}} trigger={['contextMenu']}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'break-spaces'}}>
              <div>{text}</div>
              <div style={{ textAlign: 'right' }}>
                { record.tags ? record.tags.map((tag) => (<Tag key={getUniqueKey()} onClick={onClickTag}>{tag}</Tag>)) : null }
              </div>
            </div>
            <div>{record.username}{record.username?'@':''}{record.address}{record.port?':':''}{record.port}</div>
          </div>
        </Dropdown>)
      }
    }
  ];
  const onClickTag = (event) => {
    setSearchKeyword(event.target.innerText);
    filterServers(event.target.innerText);
  }

  const selectRow = (record) => {
    if(editable&&multipleSelect) {
      if(selectedRowKeys.includes(record.key)) {
        setSelectedRowKeys(selectedRowKeys.filter((key) => key !== record.key));
      } else {
        setSelectedRowKeys(selectedRowKeys.concat([record.key]));
      }
    } else {
      setSelectedRowKeys([record.key]);
    }
  };
  const onSelectedRowKeysChange = (selectedRowKeys) => {
    setSelectedRowKeys(selectedRowKeys);
  };
  const rowSelection = {
    selectedRowKeys,
    hideSelectAll: true,
    type: multipleSelect&&editable?'checkbox':'radio',
    onChange: onSelectedRowKeysChange
  };

  const editServer = (serverKey) => {
    const tabKey = serverKey+'-server-editor';
    const findItems = tabItems.filter((item) => item.serverKey === tabKey);
    if(findItems.length > 0) {
      setTabActiveKey(findItems[0].key);
    }else{
      const uniqueKey = getUniqueKey();
      setTabItems([...tabItems || [], {
        key: uniqueKey,
        serverKey: tabKey,
        label: serverKey,
        children: <ServerEditor uniqueKey={uniqueKey} serverKey={serverKey} />,
      }]);
      setTabActiveKey(uniqueKey);
    }
  }
  const deleteServer = (serverKey) => {
    modal.confirm({
      title: 'Confirm to delete',
      icon: <QuestionCircleFilled />,
      content: 'Server '+serverKey+' will be deleted.',
      onOk() {
        callApi('deleteServer', {key: serverKey}).then((data) => {
          if(data && data.errinfo) {
            message.error(data.errinfo);
          }else if(data && data.serverList) {
            setServerItems(data.serverList);
            setShowServers(showServers.filter((server) => server.key !== serverKey));
          }
        })
      },
      onCancel() {
        console.log('Cancel');
      },
    });
  }
  const runOnServer = (serverKey) => {
    const serverObj = serverItems.filter((server) => server.key === serverKey)[0]||{};
    if(serverObj&&serverObj.name){
      window.fillSearchServer(serverObj.name);
    }
  }

  useEffect(() => {
    setTimeout(() => {
      callApi('getServerList').then((data) => {
        setServerItems(data);
        setShowServers(data);
      })
    }, 10)
  },[setServerItems]);

  useEffect(() => {
    filterServers(searchKeyword);
  }, [serverItems, searchKeyword, filterServers]);

  return (
    <>
    <Input prefix={<SearchOutlined />} onChange={onSearchKeywordChange} value={searchKeyword} allowClear={true} placeholder='Search' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
    <Table
      className={editable?'':'hide-selection-column'}
      rowSelection={rowSelection}
      showHeader={false}
      pagination={false}
      columns={columns}
      dataSource={showServers}
      onRow={(record) => ({
        onClick: () => {
          selectRow(record);
        },
        onContextMenu: () => {
          selectRow(record);
        },
        onDoubleClick: () => {
          runOnServer(record.name);
        }
      })}
    />
    </>
  )
}

export default ServerList;