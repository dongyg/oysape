import { App, Button, Tooltip } from 'antd';
import { BsPlusLg } from "react-icons/bs";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi } from '../Common/global';

// import ProjectCollapse from './ProjectCollapse';
import ProjectFileTree from './ProjectFileTree';

import './ProjectsPanel.css';

export default function ProjectsPanel() {
  const { message } = App.useApp();
  const { setProjectFiles } = useCustomContext();
  const headerHeight = '56px';

  const addFolder = () => {
    callApi('addFolderToWorkspace').then((data) => {
      if(data && data.errinfo) {
        message.error(data.errinfo);
      }else if(data && data.projectFiles) {
        setProjectFiles(data.projectFiles);
      }
    })
  }

  return (
    <>
    <div style={{ height: headerHeight, padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <span style={{ flex: 'auto', paddingTop: '4px' }}>Files</span>
      <div>
        <Tooltip placement="bottomRight" title="Add a folder to the workspace">
          <Button type='text' icon={<BsPlusLg />} onClick={(event) => {
            addFolder()
          }}>
          </Button>
        </Tooltip>
      </div>
    </div>
    <div style={{ height: 'calc(100% - ' + headerHeight+')', overflow: 'auto' }} className='withScrollContent'>
      {/* 因为 ProjectCollapse 会是 100% 高度, 所以需要在它外面包一层 div, 并且高度是 100% 去掉上面的 header div 的高度 */}
      <ProjectFileTree />
    </div>
    </>
  );
}