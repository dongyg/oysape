import { App, Button, Dropdown } from 'antd';
import { BsPlusLg, BsThreeDots } from "react-icons/bs";
import { ImportOutlined, ExportOutlined, DeleteFilled, QuestionCircleFilled } from '@ant-design/icons';

import { useCustomContext } from '../Contexts/CustomContext'
import { getUniqueKey, callApi } from '../Common/global';
import TaskList from './TaskList';
import TaskEditor from './TaskEditor';

import '../Server/ServersPanel.css';

export default function TasksPanel() {
  const { message, modal } = App.useApp();
  const { hideSidebarIfNeed, tabItems, setTabItems, setTabActiveKey, userSession, setUserSession } = useCustomContext();
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
    hideSidebarIfNeed();
  }

  const menuItems = [
    { key: 'menuNewTask', label: ('Add a new Task'), icon: <BsPlusLg />, },
    { type: 'divider', },
    { key: 'menuImportTask', label: ( 'Import' ), icon: <ImportOutlined />, },
    { key: 'menuExportTask', label: ( 'Export' ), icon: <ExportOutlined />, },
    { type: 'divider', },
    { key: 'menuEmptyTask', label: ( 'Remove all tasks' ), icon: <DeleteFilled />, },
  ];
  const onClickMenu = ({ key }) => {
    if(key === 'menuNewTask') {
      addTask()
    }else if(key === 'menuImportTask') {
      callApi('importTo', {what: 'tasks'}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }else if(data && data.tasks) {
          setUserSession({...userSession, tasks: data.tasks});
        }
      }).catch((err) => { message.error(err.message); })
    }else if(key === 'menuExportTask') {
      callApi('exportFrom', {what: 'tasks'}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }
      }).catch((err) => { message.error(err.message); })
    }else if(key === 'menuEmptyTask') {
      modal.confirm({
        title: 'Confirm to delete',
        icon: <QuestionCircleFilled />,
        content: 'Are you sure to delete all tasks?',
        onOk() {
          callApi('deleteTask', {key: '__ALL__'}).then((data) => {
            if(data && data.errinfo) {
              message.error(data.errinfo);
            }else if(data && data.tasks) {
              setUserSession({...userSession, tasks: data.tasks});
            }
          }).catch((err) => { message.error(err.message); })
        },
        onCancel() {
          // console.log('Cancel');
        },
      });
  }
  };

  return (
    <>
    <div style={{ height: headerHeight, padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <span style={{ flex: 'auto', paddingTop: '4px' }}>Tasks</span>
      {
        userSession.accesses.writable ?
        <div>
          <Dropdown menu={{ items: menuItems, onClick: onClickMenu }} placement="topRight">
            <Button type='text' icon={<BsThreeDots />}></Button>
          </Dropdown>
        </div> : null
      }
    </div>
    <div style={{ height: 'calc(100% - ' + headerHeight+')', overflow: 'auto' }} className='withScrollContent'>
      <TaskList />
    </div>
    </>
  );
}