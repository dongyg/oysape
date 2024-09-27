import React,{ useState, useEffect, useCallback } from 'react';
import { App, Table, Tag, Input, Dropdown, Space, Button, Tooltip } from "antd";
import { SearchOutlined, EditOutlined, DeleteOutlined, QuestionCircleFilled } from '@ant-design/icons';
import { FiTerminal } from "react-icons/fi";
import { useCustomContext } from '../Contexts/CustomContext'
import { getShowTitle, getUniqueKey, callApi } from '../Common/global';
import TaskEditor from './TaskEditor';
import './TaskList.css';

const TaskList = () => {
  const { message, modal } = App.useApp();
  const { hideSidebarIfNeed, tabItems, setTabItems, setTabActiveKey, userSession, setUserSession } = useCustomContext();
  const [showTasks, setShowTasks] = useState(userSession.tasks||[]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [multipleSelect] = useState(false);
  const [editable] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  const onClickMenu = (e) => {
    if(e.domEvent) e.domEvent.stopPropagation();
    if(!selectedRowKeys[0]) {
      // message.info(`Click on item ${key} ${selectedRowKeys[0]}`);
      return;
    }
    if(e.key === 'editTask') {
      editTask(selectedRowKeys[0]);
    }else if(e.key === 'deleteTask') {
      deleteTask(selectedRowKeys[0]);
    }else if(e.key === 'runTask') {
      callThisTask(selectedRowKeys[0]);
    }
  };
  const getContextItems = () => {
    var retval = [
      { key: 'runTask', label: <strong>Run this task on a Server</strong>, icon: <FiTerminal />, },
    ];
    if(userSession.accesses.writable) {
      retval = retval.concat([
        { type: 'divider', },
        { key: 'editTask', label: 'Edit', icon: <EditOutlined />, },
        { key: 'deleteTask', label: 'Delete', icon: <DeleteOutlined />, },
      ]);
    }
    return retval;
  };
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      // ellipsis: true, // 设置为 true 会影响 expandable 有展开时 colspan 带来的显示问题
      render: (text, record, index) => {
        return (<Dropdown menu={{items: getContextItems(), onClick: onClickMenu}} trigger={['contextMenu']}>
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
    let query = keyword.toLowerCase();
    setShowTasks(
      (userSession.tasks||[]).filter((task) => {
        return task.name.toLowerCase().includes(query) || (task.cmds||[]).join('\n').toLowerCase().includes(query) || (task.tags&&task.tags.join(',').toLowerCase().includes(query)) || (task.interaction&&task.interaction.toLowerCase().includes(query));
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

  const editTask = (taskKey) => {
    const tabKey = taskKey+'-task-editor';
    const findItem = tabItems.find((item) => item.taskKey === tabKey);
    if(findItem) {
      setTabActiveKey(findItem.key);
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
    hideSidebarIfNeed();
  }
  const deleteTask = (taskKey) => {
    const pipelines = userSession.pipelines.filter((pipeline) => !!pipeline.steps.find((step) => step.tasks.includes(taskKey))).map((pipeline) => {
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
          }else if(data && data.tasks) {
            setUserSession({...userSession, tasks: data.tasks});
            setShowTasks(showTasks.filter((task) => task.key !== taskKey));
          }
        }).catch((err) => { message.error(err.message); })
      },
      onCancel() {
        // console.log('Cancel');
      },
    });
  }
  const callThisTask = (taskKey) => {
    const taskObj = userSession.tasks.find((task) => task.key === taskKey)||{};
    if(taskObj&&taskObj.name){
      window.fillSearchTask(taskObj.name);
    }
    hideSidebarIfNeed();
  }

  useEffect(() => {
    filterTasks(searchKeyword);
  }, [searchKeyword, filterTasks]);

  return (
    <>
    <Input prefix={<SearchOutlined />} onChange={onSearchKeywordChange} value={searchKeyword} allowClear={true} placeholder='Search' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
    <Table style={{ overflowX: 'hidden' }}
      className={editable?'':'hide-selection-column'}
      rowSelection={{
        selectedRowKeys,
        // hideSelectAll: true,
        type: multipleSelect&&editable?'checkbox':'radio',
        onChange: onSelectedRowKeysChange,
        columnWidth: '0px',
      }}
      showHeader={false}
      pagination={false}
      columns={columns}
      dataSource={showTasks}
      onRow={(record) => ({
        onClick: () => {
          selectRow(record);
        },
        onContextMenu: () => {
          selectRow(record, true);
        },
        onDoubleClick: () => {
          callThisTask(record.key);
        },
      })}
      expandable={{ showExpandColumn: false, expandRowByClick: true, expandedRowKeys: selectedRowKeys,
        expandedRowRender: (record) => <Space style={{ padding: '8px', width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
          {getContextItems().map((item) => {
            return item.type!=='divider' ? <Tooltip title={item.label}><Button type="text" size="large" icon={item.icon} onClick={(e) => {onClickMenu({key:item.key});}} ></Button></Tooltip> : null
          })}
        </Space>
      }}
    />
    </>
  )
}

export default TaskList;