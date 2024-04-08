import { useState } from 'react';
import { App, Button, Dropdown, Table } from 'antd';
import { BsPlusLg, BsThreeDots } from "react-icons/bs";
import { DeleteOutlined, DeleteFilled } from '@ant-design/icons';
import { RiInstallLine, RiUninstallLine } from "react-icons/ri";
import { BiUserCheck } from "react-icons/bi";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi } from '../Common/global';

import TextInputModal from '../Modules/TextInputModal';
import './WebsitesPanel.css';

export default function WebsitesPanel() {
  const { message } = App.useApp();
  const { userSession, setUserSession } = useCustomContext();
  const headerHeight = '56px';
  const [ showInput, setShowInput ] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [multipleSelect, setMultipleSelect] = useState(false);
  const [editable, setEditable] = useState(false);

  const addWebsite = (value) => {
    setShowInput(false);
    callApi('addWebHost', {obh: value}).then((data) => {
      if(data && data.errinfo) {
        message.error(data.errinfo);
      }else if(data && data.sites){
        console.log(data);
        setUserSession({...userSession, sites: data.sites});
      }
    })
  }

  const menuItems = [
    { key: 'menuNewWebHost', label: ('Add a new web host'), icon: <BsPlusLg />, },
    { type: 'divider', },
    { key: 'menuEmptyWebHost', label: ( 'Remove all webhosts' ), icon: <DeleteFilled />, },
  ];
  const onClickMenu = ({ key }) => {
    if(key === 'menuNewWebHost') {
      setShowInput(true);
    }
  };

  const onClickContextItem = ({ key }) => {
    if(!selectedRowKeys[0]) {
      return;
    }
    if(key === 'menuSetupWebhost') {
    }else if(key === 'menuVerifyOwner') {
      callApi('verifyWebHost', {obh: selectedRowKeys[0]}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }else if(data && data.sites){
          console.log(data);
          setUserSession({...userSession, sites: data.sites});
        }
      })
    }else if(key === 'menuUnsetup') {
      callApi('uninstallWebHost', {obh: selectedRowKeys[0]}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }else if(data && data.sites){
          console.log(data);
          setUserSession({...userSession, sites: data.sites});
        }
      })
    }else if(key === 'menuDeleteWebhost') {
      callApi('deleteWebHost', {obh: selectedRowKeys[0]}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }else if(data && data.sites){
          console.log(data);
          setUserSession({...userSession, sites: data.sites});
        }
      })
    } else if (userSession.servers.filter((item) => item.key === key).length > 0) {
      callApi('installWebHost', {obh: selectedRowKeys[0], target: key}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }else if(data && data.sites){
          console.log(data);
          setUserSession({...userSession, sites: data.sites});
        }
      })
    }
  };
  const getContextItems = () => {
    var retval = [
      { key: 'menuSetupWebhost', label: ('Install on'), icon: <RiInstallLine />, children: userSession.servers.map((item) => {return {key: item.key, label: item.name}})},
      { key: 'menuVerifyOwner', label: ('Verify the owner'), icon: <BiUserCheck />, },
      { type: 'divider', },
      { key: 'menuUnsetup', label: ('Uninstall'), icon: <RiUninstallLine />, },
      { key: 'menuDeleteWebhost', label: ('Delete'), icon: <DeleteOutlined />, },
    ];
    return retval;
  };
  const columns = [
    {
      title: "Name",
      dataIndex: "obh",
      render: (text, record, index) => {
        return (<Dropdown menu={{items: getContextItems(), onClick: onClickContextItem}} trigger={['contextMenu']}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'break-spaces'}}>
              <div>{record.obh}</div>
              <div style={{ textAlign: 'right' }}>
                { record.verified ? 'Verified' : 'Unverified' }
              </div>
            </div>
            <div>{record.target || 'Unset'}</div>
          </div>
        </Dropdown>)
      }
    }
  ];

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

  const NoDataComponent = () => (
    <div>
      <p>No Webhosts.</p><Button type="primary" onClick={() => setShowInput(true)}>Add a New One</Button>
    </div>
  );
  const customLocale = {
    emptyText: <NoDataComponent />, // Using a React component for custom no data display
  };

  return (
    <>
      <div style={{ height: headerHeight, padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <span style={{ flex: 'auto', paddingTop: '4px' }}>Webhosts</span>
        {
          userSession.teams[userSession.team0].is_creator ?
          <div>
            <Dropdown menu={{ items: menuItems, onClick: onClickMenu }} placement="topRight">
              <Button type='text' icon={<BsThreeDots />}></Button>
            </Dropdown>
          </div> : null
        }
      </div>
      <div style={{ height: 'calc(100% - ' + headerHeight+')', overflow: 'auto' }} className='withScrollContent'>
        <Table
          className={editable?'':'hide-selection-column'}
          rowSelection={rowSelection}
          showHeader={false}
          pagination={false}
          columns={columns}
          dataSource={userSession.sites||[]}
          locale={userSession.teams[userSession.team0].is_creator?customLocale:{}}
          onRow={(record) => ({
            onClick: () => {
              selectRow(record);
            },
            onContextMenu: () => {
              selectRow(record);
            },
            onDoubleClick: () => {
              //TODO: open the web host
            }
          })}
        />
      </div>
      <TextInputModal visible={showInput} defaultValue={""} title={"Add a new web host"} onCreate={addWebsite} onCancel={() => setShowInput(false)} placeholder={"Enter your web host url"}></TextInputModal>
    </>
  );
}
