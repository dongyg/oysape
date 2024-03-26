import { App, Button, Dropdown } from 'antd';
import { BsPlusLg, BsThreeDots } from "react-icons/bs";
import { ImportOutlined, ExportOutlined, DeleteFilled, QuestionCircleFilled } from '@ant-design/icons';

import { useCustomContext } from '../Contexts/CustomContext'
import { getUniqueKey, callApi } from '../Common/global';
import ServerList from './ServerList';
import ServerEditor from './ServerEditor';

import './ServerPanel.css';

export default function ServersPanel() {
  const { message, modal } = App.useApp();
  const { hideSidebarIfNeed, tabItems, setTabItems, setTabActiveKey, setServerItems, userSession, setUserSession } = useCustomContext();
  const headerHeight = '56px';

  const addServer = () => {
    const uniqueKey = getUniqueKey();
    setTabItems([...tabItems || [], {
      key: uniqueKey,
      serverKey: "server-new",
      label: "New Server",
      children: <ServerEditor uniqueKey={uniqueKey} serverKey={""} />,
    }]);
    setTabActiveKey(uniqueKey);
    hideSidebarIfNeed();
  }

  const menuItems = [
    { key: 'menuNewServer', label: ('Add a new server'), icon: <BsPlusLg />, },
    { type: 'divider', },
    { key: 'menuImportServer', label: ( 'Import' ), icon: <ImportOutlined />, },
    { key: 'menuExportServer', label: ( 'Export' ), icon: <ExportOutlined />, },
    { type: 'divider', },
    { key: 'menuEmptyServer', label: ( 'Remove all servers' ), icon: <DeleteFilled />, },
  ];
  const onClickMenu = ({ key }) => {
    if(key === 'menuNewServer') {
      addServer()
    }else if(key === 'menuImportServer') {
      callApi('importTo', {what: 'servers'}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }else{
          setUserSession({...userSession, servers: data.servers});
        }
      })
    }else if(key === 'menuExportServer') {
      callApi('exportFrom', {what: 'servers'}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }
      })
    }else if(key === 'menuEmptyServer') {
      modal.confirm({
        title: 'Confirm to delete',
        icon: <QuestionCircleFilled />,
        content: 'Are you sure to delete all servers?',
        onOk() {
          callApi('deleteServer', {key: '__ALL__'}).then((data) => {
            if(data && data.errinfo) {
              message.error(data.errinfo);
            }else if(data && data.servers) {
              setServerItems(data.servers);
            }
          })
        },
        onCancel() {
          console.log('Cancel');
        },
      });
    }
  };

  return (
    <>
    <div style={{ height: headerHeight, padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <span style={{ flex: 'auto', paddingTop: '4px' }}>Servers</span>
      {
        userSession.teams[userSession.team0].is_creator || userSession.teams[userSession.team0].members.find(item => item.email === userSession.email)?.access_writable ?
        <div>
          <Dropdown menu={{ items: menuItems, onClick: onClickMenu }} placement="topRight">
            <Button type='text' icon={<BsThreeDots />}></Button>
          </Dropdown>
        </div> : null
      }
    </div>
    <div style={{ height: 'calc(100% - ' + headerHeight+')', overflow: 'auto' }} className='withScrollContent'>
      <ServerList />
    </div>
    </>
  );
}
