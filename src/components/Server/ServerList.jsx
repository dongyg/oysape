import React, { useState, useEffect, useCallback } from 'react';
import { App, Table, Tag, Input, Dropdown, Space, Button, Tooltip } from "antd";
import { SearchOutlined, EditOutlined, DeleteOutlined, QuestionCircleFilled, KeyOutlined } from '@ant-design/icons';
import { FiTerminal } from "react-icons/fi";
import { BsTerminal } from "react-icons/bs";

import { useCustomContext } from '../Contexts/CustomContext'
import { getUniqueKey, callApi, getCredentials } from '../Common/global';
// import CredentialsModal from '../Server/CredentialsModal';
import WebsiteCredentials from '../Websites/WebsiteCredentials';
import ServerEditor from './ServerEditor';

const ServerList = () => {
  const { message, modal } = App.useApp();
  const { hideSidebarIfNeed, tabItems, setTabItems, setTabActiveKey, userSession, setUserSession } = useCustomContext();
  const [showServers, setShowServers] = useState(userSession.servers||[]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [multipleSelect] = useState(false);
  const [editable] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [visibleCredentialsModal, setVisibleCredentialsModal] = useState(false);

  const onClickMenu = (e) => {
    if(e.domEvent) e.domEvent.stopPropagation();
    if(!selectedRowKeys[0]) {
      // message.info(`Click on item ${key} ${selectedRowKeys[0]}`);
      return;
    }
    if(e.key === 'editServer') {
      editServer(selectedRowKeys[0]);
    }else if(e.key === 'deleteServer') {
      deleteServer(selectedRowKeys[0]);
    }else if(e.key === 'runOnServer') {
      runOnServer(selectedRowKeys[0]);
    }else if(e.key === 'terminalServer') {
      if(window.openServerTerminal) {
        window.openServerTerminal(selectedRowKeys[0]);
        hideSidebarIfNeed();
      }
    }else if(e.key === 'credential') {
      setVisibleCredentialsModal(true);
    }
  };
  const getContextItems = () => {
    var retval = [
      { key: 'runOnServer', label: <strong>Run a task on this server</strong>, icon: <FiTerminal />, },
    ];
    if(userSession.accesses.terminal) {
      retval = retval.concat([
        { type: 'divider', },
        { key: 'terminalServer', label: 'Terminal', icon: <BsTerminal />, },
      ]);
    }
    if(userSession.accesses.writable) {
      retval = retval.concat([
        { type: 'divider', },
        { key: 'editServer', label: 'Edit', icon: <EditOutlined />, },
        { key: 'deleteServer', label: 'Delete', icon: <DeleteOutlined />, },
      ]);
    }
    retval.push({ type: 'divider', });
    retval.push({ key: 'credential', label: 'Credential', icon: <KeyOutlined />, });
    return retval;
  };
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      render: (text, record, index) => {
        return (<Dropdown menu={{items: getContextItems(), onClick: onClickMenu}} trigger={['contextMenu']}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'break-spaces'}}>
              <div>{text}</div>
              <div style={{ textAlign: 'right' }}>
                { record.tags ? record.tags.map((tag) => (<Tag key={getUniqueKey()} onClick={onClickTag}>{tag}</Tag>)) : null }
              </div>
            </div>
            <div>{record.credAlias}{record.credAlias?'@':''}{record.address}{record.port?':':''}{record.port}</div>
          </div>
        </Dropdown>)
      }
    }
  ];
  const onClickTag = (event) => {
    setSearchKeyword(event.target.innerText);
    filterServers(event.target.innerText);
  }
  const onSearchKeywordChange = (event) => {
    setSearchKeyword(event.target.value);
    filterServers(event.target.value);
  }

  const filterServers = useCallback((keyword, viewUpdate) => {
    let query = keyword.toLowerCase();
    setShowServers(
      (userSession.servers||[]).filter((server) => {
        return server.name.toLowerCase().includes(query) || server.address.toLowerCase().includes(query) || (server.username||'').toLowerCase().includes(query)|| (server.tags&&server.tags.join(',').toLowerCase().includes(query));
      })
    )
  }, [userSession]);

  const selectRow = (record, isContextMenu) => {
    if(editable&&multipleSelect) {
      if(selectedRowKeys.includes(record.key)) {
        setSelectedRowKeys(selectedRowKeys.filter((key) => key !== record.key));
      } else {
        setSelectedRowKeys(selectedRowKeys.concat([record.key]));
      }
    } else {
      if(selectedRowKeys.includes(record.key) && !isContextMenu) {
        setSelectedRowKeys([]);
      }else{
        setSelectedRowKeys([record.key]);
      }
    }
  };
  const onSelectedRowKeysChange = (selectedRowKeys) => {
    setSelectedRowKeys(selectedRowKeys);
  };

  const editServer = (serverKey) => {
    const tabKey = serverKey+'-server-editor';
    const findItem = tabItems.find((item) => item.serverKey === tabKey);
    if(findItem) {
      setTabActiveKey(findItem.key);
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
    hideSidebarIfNeed();
  }
  const deleteServer = (serverKey) => {
    modal.confirm({
      title: 'Confirm to delete',
      icon: <QuestionCircleFilled />,
      content: 'Server '+serverKey+' will be deleted.',
      onOk() {
        callApi('deleteServer', {key: serverKey, credentials: getCredentials()}).then((data) => {
          if(data && data.errinfo) {
            message.error(data.errinfo);
          }else if(data && data.servers) {
            setUserSession({...userSession, servers: data.servers});
            setShowServers(showServers.filter((server) => server.key !== serverKey));
          }
        }).catch((err) => { message.error(err.message); })
      },
      onCancel() {
        // console.log('Cancel');
      },
    });
  }
  const runOnServer = (serverKey) => {
    const serverObj = userSession.servers.find((server) => server.key === serverKey)||{};
    if(serverObj&&serverObj.name){
      window.fillSearchServer(serverObj.name);
    }
    hideSidebarIfNeed();
  }

  const handleCredentialsCancel = () => {
    setVisibleCredentialsModal(false);
  }

  const handleCredentialsChoose = (data) => {
    callApi('set_credential_for_server', {credential: data, serverKey: selectedRowKeys[0]}).then((res) => {
      if(res&&res.email) {
        // saveCredentialMapping(userSession.team0, selectedRowKeys[0], data['alias']);
        setUserSession(res);
      }else if (res && res.errinfo) {
        message.error(res.errinfo);
      }
    }).catch((err) => { message.error(err.message); })
  }

  const handleCredentialsRemove = () => {
    callApi('set_credential_for_server', {credential: null, serverKey: selectedRowKeys[0]}).then((res) => {
      if(res&&res.email) {
        // saveCredentialMapping(userSession.team0, selectedRowKeys[0], null);
        setUserSession(res);
      }else if (res && res.errinfo) {
        message.error(res.errinfo);
      }
    }).catch((err) => { message.error(err.message); })
  }

  useEffect(() => {
    filterServers(searchKeyword);
  }, [searchKeyword, filterServers]);

  return (
    <>
      <Input prefix={<SearchOutlined />} onChange={onSearchKeywordChange} value={searchKeyword} allowClear={true} placeholder='Search' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
      <Table
        className={editable?'':'hide-selection-column'}
        rowSelection={{
          selectedRowKeys,
          hideSelectAll: true,
          type: multipleSelect&&editable?'checkbox':'radio',
          onChange: onSelectedRowKeysChange,
          columnWidth: '0px',
        }}
        showHeader={false}
        pagination={false}
        columns={columns}
        dataSource={showServers}
        onRow={(record) => ({
          onClick: () => {
            selectRow(record);
          },
          onContextMenu: () => {
            selectRow(record, true);
          },
          onDoubleClick: () => {
            runOnServer(record.name);
          }
        })}
        expandable={{ showExpandColumn: false, expandRowByClick: true, expandedRowKeys: selectedRowKeys,
          expandedRowRender: (record) => <Space style={{ padding: '8px', width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
            {getContextItems().map((item) => {
              return item.type!=='divider' ? <Tooltip title={item.label}><Button type="text" size="large" icon={item.icon} onClick={(e) => {onClickMenu({key:item.key});}} ></Button></Tooltip> : null
            })}
          </Space>
        }}
      />
      {/* <CredentialsModal visible={visibleCredentialsModal} onCancel={handleCredentialsCancel} onChoose={handleCredentialsChoose} onRemove={handleCredentialsRemove} initialMode="choose" initTitle={'Choose Credential for '+selectedRowKeys[0]} /> */}
      <WebsiteCredentials obh={'localhost'} visible={visibleCredentialsModal} initialMode="choose" onCancel={handleCredentialsCancel} onChoose={handleCredentialsChoose} onRemove={handleCredentialsRemove} initTitle={'Choose Credential for '+selectedRowKeys[0]} />
    </>
  )
}

export default ServerList;