import React,{ useState, useEffect, useCallback } from 'react';
import { App, Table, Tag, Input, Dropdown } from "antd";
import { SearchOutlined, EditOutlined, DeleteOutlined, QuestionCircleFilled } from '@ant-design/icons';
import { FiTerminal } from "react-icons/fi";
import { useCustomContext } from '../Contexts/CustomContext'
import { getShowTitle, getUniqueKey, callApi } from '../Common/global';
import TaskEditor from './TaskEditor';
import './TaskList.css';

const TaskList = () => {
  const { message, modal } = App.useApp();
  const { taskItems, setTaskItems, pipelineItems, tabItems, setTabItems, setTabActiveKey } = useCustomContext();
  const [showTasks, setShowTasks] = useState(taskItems);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [multipleSelect, setMultipleSelect] = useState(false);
  const [editable, setEditable] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  const onClickMenu = ({ key }) => {
    if(!selectedRowKeys[0]) {
      // message.info(`Click on item ${key} ${selectedRowKeys[0]}`);
      return;
    }
    if(key === 'editTask') {
      editTask(selectedRowKeys[0]);
    }else if(key === 'deleteTask') {
      deleteTask(selectedRowKeys[0]);
    }else if(key === 'runTask') {
      callThisTask(selectedRowKeys[0])
    }
  };
  const contextItems = [
    { key: 'runTask', label: <strong>Run this task on a Server</strong>, icon: <FiTerminal />, },
    { type: 'divider', },
    { key: 'editTask', label: 'Edit', icon: <EditOutlined />, },
    { key: 'deleteTask', label: 'Delete', icon: <DeleteOutlined />, },
  ];
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      ellipsis: true,
      render: (text, record, index) => {
        return (<Dropdown menu={{items: contextItems, onClick: onClickMenu}} trigger={['contextMenu']}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'break-spaces'}}>
              <div>{getShowTitle(text)}</div>
              <div style={{ textAlign: 'right' }}>
                { record.interaction ? (<Tag key={getUniqueKey()} onClick={onClickTag}>{record.interaction}</Tag>) : null }
                { record.tags ? record.tags.map((tag) => (<Tag key={getUniqueKey()} onClick={onClickTag}>{tag}</Tag>)) : null }
              </div>
            </div>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#666666' }}>{(record.cmds||[]).join(', ')||record.source}</div>
          </div>
        </Dropdown>)
      }
    }
  ];
  const onClickTag = (event) => {
    setSearchKeyword(event.target.innerText);
    filterTasks(event.target.innerText);
  }
  const onSearchKeywordChange = (event) => {
    setSearchKeyword(event.target.value);
    filterTasks(event.target.value);
  }
  const filterTasks = useCallback((keyword, viewUpdate) => {
    setShowTasks(
      (taskItems||[]).filter((task) => {
        return task.name.includes(keyword) || (task.cmds||[]).join('\n').includes(keyword) || (task.tags&&task.tags.join(',').includes(keyword)) || (task.interaction&&task.interaction.includes(keyword));
      })
    )
  }, [taskItems]);

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

  const editTask = (taskKey) => {
    const tabKey = taskKey+'-task-editor';
    const findItems = tabItems.filter((item) => item.taskKey === tabKey);
    if(findItems.length > 0) {
      setTabActiveKey(findItems[0].key);
    }else{
      const uniqueKey = getUniqueKey();
      setTabItems([...tabItems || [], {
        key: uniqueKey,
        taskKey: tabKey,
        label: taskKey,
        children: <TaskEditor uniqueKey={uniqueKey} taskKey={taskKey} />,
      }]);
      setTabActiveKey(uniqueKey);
    }
  }
  const deleteTask = (taskKey) => {
    const pipelines = pipelineItems.filter((pipeline) => pipeline.steps.filter((step) => step.tasks.includes(taskKey)).length > 0).map((pipeline) => {
      return pipeline.name;
    })
    modal.confirm({
      title: 'Confirm to delete',
      icon: <QuestionCircleFilled />,
      content: 'Task '+taskKey+' will be deleted.'+(pipelines.length > 0 ? ' This task is used in the following pipelines: '+pipelines.join(', ') : ''),
      onOk() {
        callApi('deleteTask', {key: taskKey}).then((data) => {
          if(data && data.errinfo) {
            message.error(data.errinfo);
          }else if(data && data.taskList) {
            setTaskItems(data.taskList);
            setShowTasks(showTasks.filter((task) => task.key !== taskKey));
          }
        })
      },
      onCancel() {
        console.log('Cancel');
      },
    });
  }
  const callThisTask = (taskKey) => {
    const taskObj = taskItems.filter((task) => task.key === taskKey)[0]||{};
    if(taskObj&&taskObj.name){
      window.fillSearchTask(taskObj.name);
    }
  }

  useEffect(() => {
    filterTasks(searchKeyword);
  }, [taskItems, searchKeyword, filterTasks]);

  return (
    <>
    <Input prefix={<SearchOutlined />} onChange={onSearchKeywordChange} value={searchKeyword} allowClear={true} placeholder='Search' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
    <Table
      className={editable?'':'hide-selection-column'}
      rowSelection={rowSelection}
      showHeader={false}
      pagination={false}
      columns={columns}
      dataSource={showTasks}
      onRow={(record) => ({
        onClick: () => {
          selectRow(record);
        },
        onContextMenu: () => {
          selectRow(record);
        },
        onDoubleClick: (event) => {
          if(window.fillSearchTask) {
            window.fillSearchTask(record.name);
          }
        },
      })}
    />
    </>
  )
}

export default TaskList;