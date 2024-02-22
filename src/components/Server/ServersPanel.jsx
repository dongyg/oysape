import { App, Button, Dropdown } from 'antd';
import { BsPlusLg, BsThreeDots } from "react-icons/bs";
import { ImportOutlined, ExportOutlined } from '@ant-design/icons';

import { useCustomContext } from '../Contexts/CustomContext'
import { getUniqueKey, callApi } from '../Common/global';
import ServerList from './ServerList';
import ServerEditor from './ServerEditor';

import './ServerPanel.css';

export default function ServersPanel() {
  const { message } = App.useApp();
  const { tabItems, setTabItems, setTabActiveKey } = useCustomContext();
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
  }

  const menuItems = [
    { key: 'menuNewServer', label: ('Add a new server'), icon: <BsPlusLg />, },
    { type: 'divider', },
    { key: 'menuImportServer', label: ( 'Import' ), icon: <ImportOutlined />, },
    { key: 'menuExportServer', label: ( 'Export' ), icon: <ExportOutlined />, },
  ];
  const onClickMenu = ({ key }) => {
    if(key === 'menuNewServer') {
      addServer()
    }else if(key === 'menuImportServer') {
      callApi('importTo', {what: 'servers'}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }else{
          window.reloadServerList();
        }
      })
    }else if(key === 'menuExportServer') {
      callApi('exportFrom', {what: 'servers'}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }
      })
    }
  };

  return (
    <>
    <div style={{ height: headerHeight, padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <span style={{ flex: 'auto', paddingTop: '4px' }}>Servers</span>
      <div>
        <Dropdown menu={{ items: menuItems, onClick: onClickMenu }} placement="topRight">
          <Button type='text' icon={<BsThreeDots />}></Button>
        </Dropdown>
      </div>
    </div>
    <div style={{ height: 'calc(100% - ' + headerHeight+')', overflow: 'auto' }} className='withScrollContent'>
      <ServerList />
    </div>
    </>
  );
}
