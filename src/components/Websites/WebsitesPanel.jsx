import { useState } from 'react';
import { App, Button, Dropdown, Table } from 'antd';
import { BsPlusLg, BsThreeDots } from "react-icons/bs";
// import { DeleteOutlined, QuestionCircleFilled } from '@ant-design/icons';
// import { RiInstallLine, RiUninstallLine } from "react-icons/ri";
// import { BiUserCheck } from "react-icons/bi";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, getUniqueKey } from '../Common/global';

import TextInputModal from '../Modules/TextInputModal';
import WebsiteManage from './WebsiteManage';
import './WebsitesPanel.css';

export default function WebsitesPanel() {
  const { message } = App.useApp();
  const { hideSidebarIfNeed, userSession, setUserSession, tabItems, setTabItems, setTabActiveKey } = useCustomContext();
  const headerHeight = '56px';
  const [ showInput, setShowInput ] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [multipleSelect] = useState(false);
  const [editable] = useState(false);

  const addWebsite = (value) => {
    setShowInput(false);
    callApi('addWebHost', {obh: value}).then((data) => {
      if(data && data.errinfo) {
        message.error(data.errinfo);
      }else if(data && data.sites){
        setUserSession({...userSession, sites: data.sites});
        const record = data.sites.find((item) => item.obh === value);
        if(record) {
          setSelectedRowKeys([record.obh]);
          openWebsiteEditor(record);
        }
      }
    })
  }
  const menuItems = [
    { key: 'menuNewWebHost', label: ('Add a new web host'), icon: <BsPlusLg />, },
  ];
  const onClickMenu = ({ key }) => {
    if(key === 'menuNewWebHost') {
      setShowInput(true);
    }
  };

  // const execVerify = (obh) => {
  //   modal.confirm({
  //     title: 'Confirm to Verify Webhost',
  //     icon: <QuestionCircleFilled />,
  //     content: 'Are you sure you want to verify webhost ' + obh + '?',
  //     onOk() {
  //       callApi('verifyWebHost', {obh: obh}).then((data) => {
  //         if(data && data.errinfo) {
  //           message.error(data.errinfo);
  //         }else if(data && data.sites){
  //           message.success('Verified successfully');
  //           setUserSession({...userSession, sites: data.sites, teams: data.teams});
  //         }
  //       })
  //     },
  //     onCancel() {
  //       // console.log('Cancel');
  //     },
  //   });
  // }
  // const execUninstall = (obh, target) => {
  //   modal.confirm({
  //     title: 'Confirm to Uninstall Webhost',
  //     icon: <QuestionCircleFilled />,
  //     content: 'Are you sure you want to uninstall webhost ' + obh + ' from ' + target + '?',
  //     onOk() {
  //       callApi('uninstallWebHost', {obh: obh}).then((data) => {
  //         if(data && data.errinfo) {
  //           message.error(data.errinfo);
  //         }else if(data && data.sites){
  //           setUserSession({...userSession, sites: data.sites, teams: data.teams});
  //         }
  //       })
  //     },
  //     onCancel() {
  //       // console.log('Cancel');
  //     },
  //   });
  // }
  // const execDelete = (obh) => {
  //   modal.confirm({
  //     title: 'Confirm to Delete Webhost',
  //     icon: <QuestionCircleFilled />,
  //     content: 'Are you sure you want to delete webhost ' + obh + '?',
  //     onOk() {
  //       callApi('deleteWebHost', {obh: obh}).then((data) => {
  //         if(data && data.errinfo) {
  //           message.error(data.errinfo);
  //         }else if(data && data.sites){
  //           setUserSession({...userSession, sites: data.sites});
  //         }
  //       })
  //     },
  //     onCancel() {
  //       // console.log('Cancel');
  //     },
  //   });
  // }

  // const onClickContextItem = ({ key }) => {
  //   if(!selectedRowKeys[0]) {
  //     return;
  //   }
  //   if(key === 'menuOpenWebhost') {
  //     callApi('openWebHost', {obh: selectedRowKeys[0]}).then((data) => {
  //       if(data && data.errinfo) {
  //         message.error(data.errinfo);
  //       }
  //     })
  //   }else if(key === 'menuVerifyOwner') {
  //     execVerify(selectedRowKeys[0]);
  //   }else if(key === 'menuUnsetup') {
  //     const currentItem = userSession.sites.find((item) => item.obh === selectedRowKeys[0]);
  //     execUninstall(selectedRowKeys[0], currentItem.target);
  //   }else if(key === 'menuDeleteWebhost') {
  //     execDelete(selectedRowKeys[0]);
  //   }
  // };
  // const getContextItems = () => {
  //   const currentItem = userSession.sites.find((item) => item.obh === selectedRowKeys[0]);
  //   var retval = [];
  //   if(isDesktopVersion){
  //     retval.push({ key: 'menuOpenWebhost', label: ('Open in Browser'), });
  //   }
  //   if(currentItem && !currentItem.target && !currentItem.verified) {
  //     retval.push({ key: 'menuDeleteWebhost', label: ('Delete'), icon: <DeleteOutlined />, });
  //   }
  //   if(currentItem && currentItem.target && !currentItem.verified) {
  //     retval.push({ key: 'menuVerifyOwner', label: ('Verify the owner'), icon: <BiUserCheck />, });
  //   }
  //   if(currentItem && currentItem.target && currentItem.verified) {
  //     retval.push({ key: 'menuUnsetup', label: ('Uninstall'), icon: <RiUninstallLine />, });
  //   }
  //   return retval;
  // };

  const columns = [
    {
      title: "Title",
      dataIndex: "obh",
      render: (text, record, index) => {
        return (
          //<Dropdown menu={{items: getContextItems(), onClick: onClickContextItem}} trigger={['contextMenu']}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'break-spaces'}}>
                <div>{record.title || record.obh}</div>
                <div>{record.target || 'Uninstalled'}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'break-spaces'}}>
                <div>{record.title ? record.obh : ''}</div>
                <div style={{ textAlign: 'right' }}>{ record.verified ? 'Verified' : 'Unverified' }</div>
              </div>
            </div>
          //</Dropdown>
        );
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

  const openWebsiteEditor = (record) => {
    const tabKey = record.obh+'-editor';
    record.initScript = record.initScript||'';
    const findItem = tabItems.find((item) => item.websiteKey === tabKey);
    if(findItem) {
      setTabActiveKey(findItem.key);
    }else{
      const uniqueKey = getUniqueKey();
      setTabItems([...tabItems || [], {
        key: uniqueKey,
        websiteKey: tabKey,
        label: record.obh,
        children: <WebsiteManage uniqueKey={uniqueKey} websiteKey={tabKey} websiteObject={record} />,
      }]);
      setTabActiveKey(uniqueKey);
    }
    hideSidebarIfNeed();
  }

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
              openWebsiteEditor(record);
            }
          })}
        />
      </div>
      <TextInputModal visible={showInput} defaultValue={""} title={"Add a new web host"} onCreate={addWebsite} onCancel={() => setShowInput(false)}
        placeholder={"Please input your web host URL using http(s)://"}
        rules={[/^https?:\/\//]}></TextInputModal>
    </>
  );
}
