import React, { useState, useCallback } from 'react'
import { App, Tag, Steps, AutoComplete, Input } from 'antd';
import { PlusOutlined, SelectOutlined } from "@ant-design/icons";

import { useCustomContext } from '../Contexts/CustomContext'
import { getUniqueKey } from '../Common/global';
import TaskEditor from '../Task/TaskEditor';
import ServerEditor from '../Server/ServerEditor';

export default function StepsComponent({steps, onChange, ...props}) {
  const { message } = App.useApp();
  const { serverItems, taskItems, tabItems, setTabItems, setTabActiveKey, hideSidebarIfNeed } = useCustomContext();
  const [indexEditTarget, setIndexEditTarget] = useState(-1);
  const [indexEditTask, setIndexEditTask] = useState(-1);
  const [indexEditTaskIndex, setIndexEditTaskIndex] = useState(-1);

  const onClickTarget = (index) => {
    setIndexEditTarget(index);
    setIndexEditTask(-1);
    setIndexEditTaskIndex(-1);
  }
  const onChangeTarget = useCallback((idxStep, value) => {
    const newItems = [...steps];
    newItems[idxStep].target = value;
    if(onChange) onChange(newItems);
    setIndexEditTarget(-1);
  }, [steps, onChange]);
  const onCloseTarget = useCallback((idxStep) => {
    const newItems = [...steps];
    newItems.splice(idxStep, 1);
    if(onChange) onChange(newItems);
  }, [steps, onChange]);

  const onClickTask = (idxStep, idxTask) => {
    setIndexEditTarget(-1);
    setIndexEditTask(idxStep);
    setIndexEditTaskIndex(idxTask);
  }
  const onChangeTask = useCallback((idxStep, idxTask, value) => {
    const newItems = [...steps];
    newItems[idxStep].tasks[idxTask] = value;
    if(onChange) onChange(newItems);
    setIndexEditTask(-1);
    setIndexEditTaskIndex(-1);
  }, [steps, onChange]);
  const onCloseTask = useCallback((idxStep, idxTask) => {
    const newItems = [...steps];
    newItems[idxStep].tasks.splice(idxTask, 1);
    if(onChange) onChange(newItems);
  }, [steps, onChange]);

  const filterOption = (input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase());

  const handleOpenServer = (serverKey)=>{
    // Same with editServer in ServerList.jsx
    const tabKey = serverKey+'-server-editor';
    const findItems = tabItems.filter((item) => item.serverKey === tabKey);
    if(findItems.length > 0) {
      setTabActiveKey(findItems[0].key);
    }else{
      const uniqueKey = getUniqueKey();
      setTabItems([...tabItems || [], {
        key: uniqueKey,
        serverKey: tabKey,
        label: serverKey,
        children: <ServerEditor uniqueKey={uniqueKey} serverKey={serverKey} />,
      }]);
      setTabActiveKey(uniqueKey);
    }
    hideSidebarIfNeed();
  }
  const handleOpenTask = (taskKey)=>{
    // Same with editTask in TaskList.jsx
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
    hideSidebarIfNeed();
  }

  const getTargetPart = useCallback((item, idxStep) => {
    return <>
      <div>{
        indexEditTarget === idxStep ? (
          <div>
            <AutoComplete autoFocus={true} popupMatchSelectWidth={'100%'} defaultActiveFirstOption={true} open={true} style={{marginLeft: "3px"}} size='small'
            // <Select autoFocus={true} defaultValue={item.target} defaultOpen={true} style={{marginLeft: "3px"}} size='small' autoComplete='off'
              options={serverItems.map((item) => {return {value: item.name, label: item.name}})} filterOption={filterOption}
              onSelect={(value) => onChangeTarget(idxStep, value)} onBlur={() => setIndexEditTarget(-1)}>
              <Input placeholder="Select a Server" size='small' autoComplete='off' autoCapitalize='off' autoCorrect='off' spellCheck='false' />
            </AutoComplete>
          </div>
        ) : (
          <div><Tag key={getUniqueKey()} closable={true} style={{ userSelect: 'none', }} icon={item.target?<SelectOutlined onClick={()=>{handleOpenServer(item.target)}} />:null} onClose={() => onCloseTarget(idxStep)} onDoubleClick={()=>{onClickTarget(idxStep)}}>{item.target}</Tag></div>
        )}
      </div>
      <div>{
        item.tasks.concat('').map((task, idxTask) => {
          return indexEditTask === idxStep && indexEditTaskIndex === idxTask ? (
            // <Select autoFocus={true} defaultValue={task} defaultOpen={true} style={{marginLeft: "3px"}} size='small' autoComplete='off'
            <AutoComplete autoFocus={true} popupMatchSelectWidth={'100%'} defaultActiveFirstOption={true} open={true} style={{marginLeft: "3px"}} size='small'
              options={taskItems.map((item) => {return {value: item.name, label: item.name}})} filterOption={filterOption}
              onSelect={(value) => onChangeTask(idxStep, idxTask, value)} onBlur={() => {setIndexEditTask(-1); setIndexEditTaskIndex(-1);}}>
                <Input placeholder="Select a Task" size='small' autoComplete='off' autoCapitalize='off' autoCorrect='off' spellCheck='false' />
            </AutoComplete>
          ) : (
            <Tag key={getUniqueKey()} closable={!!task} style={{ userSelect: 'none', }} icon={task?<SelectOutlined onClick={()=>{handleOpenTask(task)}} />:null} onClose={() => onCloseTask(idxStep, idxTask)} onDoubleClick={() => onClickTask(idxStep, idxTask)}>
              {task||'+'}
            </Tag>
          )
        })}
      </div>
    </>
  }, [indexEditTarget, indexEditTask, indexEditTaskIndex, serverItems, taskItems, onChangeTarget, onChangeTask, onCloseTarget, onCloseTask]);

  const onClickAddStep = useCallback(() => {
    const newItems = [...steps];
    newItems.push({target: '', tasks: []});
    setIndexEditTarget(steps.length);
    if(onChange) {
      onChange(newItems);
    }
  }, [steps, setIndexEditTarget, onChange]);

  return (
    <Steps
      direction="vertical"
      size="small" current={0}
      items={steps.map((item, index) => {
        return {
          title: getTargetPart(item, index),
          subTitle: null,
          description: null,
          status: 'wait',
        }
      }).concat({
        title: <Tag key={getUniqueKey()} icon={<PlusOutlined />} onClick={onClickAddStep}>Choose a server</Tag>,
        subTitle: '',
        description: [],
        status: 'wait',
      })}
    />
  )
}
