import { Button, Tooltip } from 'antd';
import { BsPlusLg } from "react-icons/bs";

import { useCustomContext } from '../Contexts/CustomContext'
import { getUniqueKey } from '../Common/global';
import TaskList from './TaskList';
import TaskEditor from './TaskEditor';

export default function TasksPanel() {
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

  return (
    <>
    <div style={{ height: headerHeight, padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <span style={{ flex: 'auto', paddingTop: '4px' }}>Tasks</span>
      <div>
        <Tooltip placement="bottomRight" title="Add a new server">
          <Button type='text' icon={<BsPlusLg />} onClick={(event) => {
            addTask();
          }}>
          </Button>
        </Tooltip>
      </div>
    </div>
    <div style={{ height: 'calc(100% - ' + headerHeight+')', overflow: 'auto' }} className='withScrollContent'>
      <TaskList />
    </div>
    </>
  );
}