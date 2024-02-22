import { App, Button, Dropdown } from 'antd';
import { BsPlusLg, BsThreeDots } from "react-icons/bs";
import { ImportOutlined, ExportOutlined } from '@ant-design/icons';

import { useCustomContext } from '../Contexts/CustomContext'
import { getUniqueKey, callApi } from '../Common/global';
import TaskList from './TaskList';
import TaskEditor from './TaskEditor';

export default function TasksPanel() {
  const { message } = App.useApp();
  const { tabItems, setTabItems, setTabActiveKey } = useCustomContext();
  const headerHeight = '56px';

  const addTask = () => {
    const uniqueKey = getUniqueKey();
    setTabItems([...tabItems || [], {
      key: uniqueKey,
      taskKey: "task-new",
      label: "New Task",
      children: <TaskEditor uniqueKey={uniqueKey} taskKey={""} />,
    }]);
    setTabActiveKey(uniqueKey);
  }

  const menuItems = [
    { key: 'menuNewTask', label: ('Add a new Task'), icon: <BsPlusLg />, },
    { type: 'divider', },
    { key: 'menuImportTask', label: ( 'Import' ), icon: <ImportOutlined />, },
    { key: 'menuExportTask', label: ( 'Export' ), icon: <ExportOutlined />, },
  ];
  const onClickMenu = ({ key }) => {
    if(key === 'menuNewTask') {
      addTask()
    }else if(key === 'menuImportTask') {
      callApi('importTo', {what: 'tasks'}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }else{
          window.reloadTaskList();
        }
      })
    }else if(key === 'menuExportTask') {
      callApi('exportFrom', {what: 'tasks'}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }
      })
    }
  };

  return (
    <>
    <div style={{ height: headerHeight, padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <span style={{ flex: 'auto', paddingTop: '4px' }}>Tasks</span>
      <div>
        <Dropdown menu={{ items: menuItems, onClick: onClickMenu }} placement="topRight">
          <Button type='text' icon={<BsThreeDots />}></Button>
        </Dropdown>
      </div>
    </div>
    <div style={{ height: 'calc(100% - ' + headerHeight+')', overflow: 'auto' }} className='withScrollContent'>
      <TaskList />
    </div>
    </>
  );
}