import React, { useState } from 'react';
import { Layout, Tabs, Button } from 'antd';
import { VscRemoteExplorer } from "react-icons/vsc";
import { MdTaskAlt } from "react-icons/md";
import { BsFiles } from "react-icons/bs";
import { UnorderedListOutlined, DoubleLeftOutlined, DoubleRightOutlined } from "@ant-design/icons";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi } from '../Common/global';
import ProfileButton from '../Common/ProfileButton'
import ServersPanel from '../Server/ServersPanel';
import ProjectsPanel from '../Project/ProjectsPanel';
import PipelinesPanel from '../Pipeline/PipelinesPanel';
import TasksPanel from '../Task/TasksPanel';

import './SideFrame.css';

const { Sider } = Layout;

export default function SideFrame() {
  const { customTheme, sideAlign, setSideAlign, sideSplitterMoving, setSideSplitterMoving, sideWidthUse, setSideWidthUse, sideWidthBak, setSideWidthBak, setTaskItems, setPipelineItems, setProjectFiles } = useCustomContext();
  const [currentTab, setCurrentTab] = useState('1');

  let menuWidth = 60;
  const memuButton1 = <Button type='text'><DoubleLeftOutlined style={{marginRight: '0px'}} onClick={handleToggleSideAlign} /></Button>;
  const memuButton2 = <Button type='text'><DoubleRightOutlined style={{marginRight: '0px'}} onClick={handleToggleSideAlign} /></Button>;
  const Operations = {
    left: sideAlign==='left'?memuButton2:memuButton1,
    right: <ProfileButton></ProfileButton>,
  };

  function Splitter({sideAlign, onMouseDown}) {
    return (
      <div id="splitterLeft" onMouseDown={onMouseDown} style={{ left: sideAlign==='right'?0:'', right: sideAlign==='left'?0:'', }}></div>
    )
  }

  React.useEffect(() => {
    setTimeout(() => {
      // callApi('getServerList').then((data) => { setServerItems(data); })
      callApi('getProjectFiles').then((data) => { setProjectFiles(data); })
      callApi('getTaskList').then((data) => { setTaskItems(data); });
      callApi('getPipelineList').then((data) => { setPipelineItems(data); });
    }, 50)
  },[setTaskItems, setPipelineItems, setProjectFiles]);

  return (
      <Sider width={sideWidthUse} style={{ transition: sideSplitterMoving?'none':'' }} className='disableHighlight'>
      <Tabs tabPosition={sideAlign} tabBarExtraContent={Operations} onTabClick={handleClickMenuTab} style={{ height: '100%' }} className={customTheme.className}
        items={[
          { key: 'side1', label: <VscRemoteExplorer style={{fontSize:'2em', marginRight: '0px'}} />, children: <ServersPanel /> },
          { key: 'side2', label: <MdTaskAlt style={{fontSize:'2em', marginRight: '0px'}} />, children: <TasksPanel /> },
          { key: 'side3', label: <UnorderedListOutlined style={{fontSize:'2em', marginRight: '0px'}} />, children: <PipelinesPanel /> },
          { key: 'side4', label: <BsFiles style={{fontSize:'2em', marginRight: '0px'}} />, children: <ProjectsPanel /> },
          // { key: '5', label: <HistoryOutlined style={{fontSize:'2em', marginRight: '0px'}} />, children: `5` },
        ]}
      />
      <Splitter sideAlign={sideAlign} onMouseDown={handleMouseDown}></Splitter>
    </Sider>
  )

  function handleToggleSideAlign() {
    if(sideAlign==='left') {
      setSideAlign('right');
    } else {
      setSideAlign('left');
    }
  }

  function handleClickMenuTab(key, event) {
    if(sideWidthUse===menuWidth) {
      setSideWidthUse(sideWidthBak);
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 200);
    } else if(currentTab===key) {
      setSideWidthBak(sideWidthUse);
      setSideWidthUse(menuWidth);
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 200);
    }
    setCurrentTab(key);
  }

  function handleMouseDown(event) {
    setSideSplitterMoving(true);
  }
}
