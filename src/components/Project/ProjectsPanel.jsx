import { App, Button, Dropdown } from 'antd';
import { BsPlusLg, BsThreeDots } from "react-icons/bs";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi } from '../Common/global';

// import ProjectCollapse from './ProjectCollapse';
import ProjectFileTree from './ProjectFileTree';
import CodeEditor from '../Modules/CodeEditor';

import './ProjectsPanel.css';

export default function ProjectsPanel() {
  const { message } = App.useApp();
  const { hideSidebarIfNeed, tabItems, setTabItems, setTabActiveKey, setFolderFiles } = useCustomContext();
  const headerHeight = '56px';

  const addFolder = () => {
    callApi('addFolder').then((data) => {
      if(data && data.errinfo) {
        message.error(data.errinfo);
      }else if(data && data.folderFiles) {
        setFolderFiles(data.folderFiles);
      }
    }).catch((err) => { message.error(err.message); })
  }
  const editGlobalExcludes = () => {
    callApi('getGlobalExcludes', {}).then((listExcludes)=>{
      const fileBody = JSON.stringify(listExcludes, null, 2);
      const uniqueKey = 'globalExcludes.json';
      if (tabItems.filter((item) => item.key === uniqueKey)[0]) {
      } else {
        setTabItems([...tabItems || [], {
          key: uniqueKey,
          fileKey: fileBody,
          label: 'Global Excludes',
          children: <CodeEditor uniqueKey={uniqueKey} filename={uniqueKey} filebody={fileBody} tabTitle={'Global Excludes'} />,
        }]);
      }
      setTabActiveKey(uniqueKey);
      hideSidebarIfNeed();
    }).catch((err) => { message.error(err.message); });
  }

  const menuItems = [
    { key: 'menuNewFolder', label: ('Add a new folder'), icon: <BsPlusLg />, },
    { type: 'divider', },
    { key: 'menuExcludes', label: ( 'Set global excludes' ), },
  ];
  const onClickMenu = ({ key }) => {
    if(key === 'menuNewFolder') {
      addFolder();
    }else if(key === 'menuExcludes') {
      // if(window.openProjectFile) window.openProjectFile('~/.oysape/excludes.json', 'Global Excludes');
      editGlobalExcludes();
    }
  };

  return (
    <>
    <div style={{ height: headerHeight, padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <span style={{ flex: 'auto', paddingTop: '4px' }}>File Explorer</span>
      <div>
        <Dropdown menu={{ items: menuItems, onClick: onClickMenu }} placement="topRight">
          <Button type='text' icon={<BsThreeDots />}></Button>
        </Dropdown>
      </div>
    </div>
    <div style={{ height: 'calc(100% - ' + headerHeight+')', overflow: 'auto' }} className='withScrollContent'>
      {/* 因为 ProjectCollapse 会是 100% 高度, 所以需要在它外面包一层 div, 并且高度是 100% 去掉上面的 header div 的高度 */}
      <ProjectFileTree />
    </div>
    </>
  );
}