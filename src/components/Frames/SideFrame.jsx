import React, { useState } from 'react';
import { Layout, Tabs, Button, Tooltip } from 'antd';
import { VscRemoteExplorer } from "react-icons/vsc";
import { MdTaskAlt } from "react-icons/md";
import { BsFiles } from "react-icons/bs";
import { FaDocker } from "react-icons/fa";
import { AiOutlineCloudServer } from "react-icons/ai";
import { UnorderedListOutlined, DoubleLeftOutlined, DoubleRightOutlined, MenuFoldOutlined } from "@ant-design/icons";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, isDesktopVersion } from '../Common/global';
// import ProfileButton from '../Common/ProfileButton'
import ServersPanel from '../Server/ServersPanel';
import ProjectsPanel from '../Project/ProjectsPanel';
import PipelinesPanel from '../Pipeline/PipelinesPanel';
import TasksPanel from '../Task/TasksPanel';
import Sftp from '../Modules/Sftp';
import DockersPanel from '../Modules/DockersPanel';

import './SideFrame.css';

const { Sider } = Layout;

export default function SideFrame() {
  const { customTheme, browserInfo, userSession, currentSideKey, setCurrentSideKey, menuWidth, sideAlign, setSideAlign, sideSplitterMoving, setSideSplitterMoving, sideWidthUse, setSideWidthUse, sideWidthBak, setSideWidthBak, setFolderFiles, hideSidebar, setHideSidebar } = useCustomContext();
  const [currentTab, setCurrentTab] = useState('1');

  const handleHideSidebar = () => {
    setHideSidebar(true);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }

  const memuButton1 = <Button type='text' icon={<DoubleLeftOutlined />} onClick={handleToggleSideAlign} ></Button>;
  const memuButton2 = <Button type='text' icon={<DoubleRightOutlined />} onClick={handleToggleSideAlign} ></Button>;
  const menuBottonHide = <Button type='text' icon={<MenuFoldOutlined />} onClick={handleHideSidebar} style={{ margin: '13px'}}></Button>
  const Operations = {
    left: menuBottonHide,
    right: sideAlign==='left'?memuButton2:memuButton1,
  };

  function Splitter({sideAlign, onMouseDown}) {
    return (
      <div id="splitterLeft" onMouseDown={onMouseDown} style={{ left: sideAlign==='right'?0:'', right: sideAlign==='left'?0:'', }}></div>
    )
  }

  const getSideButtons = () => {
    var buttons = [
      { key: 'sideServer', label: <Tooltip placement="right" title={'Servers ('+(browserInfo&&browserInfo.isMac ? 'Command' : 'Ctrl')+'+Shift+S)'}><VscRemoteExplorer style={{fontSize:'2em', marginRight: '0px'}} /></Tooltip>, children: <ServersPanel /> },
      { key: 'sideTask', label: <Tooltip placement="right" title={'Tasks ('+(browserInfo&&browserInfo.isMac ? 'Command' : 'Ctrl')+'+Shift+T)'}><MdTaskAlt style={{fontSize:'2em', marginRight: '0px'}} /></Tooltip>, children: <TasksPanel /> },
      { key: 'sidePipeline', label: <Tooltip placement="right" title={'Pipelines ('+(browserInfo&&browserInfo.isMac ? 'Command' : 'Ctrl')+'+Shift+X)'}><UnorderedListOutlined style={{fontSize:'2em', marginRight: '0px'}} /></Tooltip>, children: <PipelinesPanel /> },
      // { key: 'sideHistory', label: <HistoryOutlined style={{fontSize:'2em', marginRight: '0px'}} />, children: `5` },
    ];
    if(userSession.accesses.sftp){
      buttons.push({ key: 'sideSftp', label: <Tooltip placement="right" title={'SFTP ('+(browserInfo&&browserInfo.isMac ? 'Command' : 'Ctrl')+'+Shift+F)'}><AiOutlineCloudServer style={{fontSize:'2em', marginRight: '0px'}} /></Tooltip>, children: <Sftp /> });
    }
    if(userSession.accesses.docker){
      buttons.push({ key: 'sideDocker', label: <Tooltip placement="right" title={'Docker ('+(browserInfo&&browserInfo.isMac ? 'Command' : 'Ctrl')+'+Shift+D)'}><FaDocker style={{fontSize:'2em', marginRight: '0px'}} /></Tooltip>, children: <DockersPanel /> });
    }
    // access_files will not affect the Desktop version. This is invisible on the web version.
    if(isDesktopVersion){
      buttons.push({ key: 'sideExplorer', label: <Tooltip placement="right" title={'File Explorer ('+(browserInfo&&browserInfo.isMac ? 'Command' : 'Ctrl')+'+Shift+E)'}><BsFiles style={{fontSize:'2em', marginRight: '0px'}} /></Tooltip>, children: <ProjectsPanel /> })
    }
    return buttons;
  }
  React.useEffect(() => {
    setTimeout(() => {
      callApi('getFolderFiles').then((data) => { setFolderFiles(data); })
    }, 1000)
  },[setFolderFiles]);

  return (
    <Sider width={sideWidthUse} style={{ transition: sideSplitterMoving?'none':'', position: sideWidthUse==='100%'?'absolute':'relative', display: hideSidebar?'none':'block' }} className='disableHighlight'>
      <Tabs tabPosition={sideAlign} tabBarExtraContent={Operations} onTabClick={handleClickMenuTab} style={{ height: '100%' }} className={customTheme.className}
        activeKey={currentSideKey} onChange={(key) => { setCurrentSideKey(key); }}
        items={getSideButtons()}
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
