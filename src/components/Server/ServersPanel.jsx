import { Button, Tooltip } from 'antd';
import { BsPlusLg } from "react-icons/bs";

import { useCustomContext } from '../Contexts/CustomContext'
import { getUniqueKey } from '../Common/global';
import ServerList from './ServerList';
import ServerEditor from './ServerEditor';

import './ServerPanel.css';

export default function ServersPanel() {
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

  return (
    <>
    <div style={{ height: headerHeight, padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <span style={{ flex: 'auto', paddingTop: '4px' }}>Servers</span>
      <div>
        <Tooltip placement="bottomRight" title="Add a new server">
          <Button type='text' icon={<BsPlusLg />} onClick={(event) => {
            addServer()
          }}>
          </Button>
        </Tooltip>
      </div>
    </div>
    <div style={{ height: 'calc(100% - ' + headerHeight+')', overflow: 'auto' }} className='withScrollContent'>
      <ServerList />
    </div>
    </>
  );
}