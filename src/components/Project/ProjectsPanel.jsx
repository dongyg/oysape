import React, {useState} from 'react';
import { App, Select } from 'antd';

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi } from '../Common/global';

// import ProjectCollapse from './ProjectCollapse';
import AntIcon from '../Common/AntIcon';
import TextInputModal from '../Modules/TextInputModal';
import ProjectFileTree from './ProjectFileTree';
import CodeEditor from '../Modules/CodeEditor';

import './ProjectsPanel.css';

export default function ProjectsPanel() {
  const { message } = App.useApp();
  const { hideSidebarIfNeed, tabItems, setTabItems, setTabActiveKey, userSession, setUserSession, currentLocalProject, setCurrentLocalProject } = useCustomContext();
  const headerHeight = 56;
  const [showProjectInput, setShowProjectInput] = useState(false);

  const chooseProject = (value) => {
    if(value === 'NEWLOCALPROJECT') {
      setShowProjectInput(true);
    }else if(value === 'menuExcludes') {
      editGlobalExcludes();
    }else if(value.startsWith('LOCALPPROJECT_')) {
      console.log('chooseProject', value);
      setCurrentLocalProject(value);
    }
  }

  const createLocalProject = (projectLabel) => {
    setShowProjectInput(false);
    callApi('addLocalProjectItem', {tid: userSession.team0, label: projectLabel}).then((resp) => {
      if(resp && resp.errinfo) {
        message.error(resp.errinfo);
      } else {
        setUserSession({...userSession, local_projects: resp.local_projects||[]});
        if ((resp.local_projects||[]).find((item)=>item.label===projectLabel)) {
          chooseProject('LOCALPPROJECT_'+projectLabel, true, resp.local_projects||[]);
        }
      }
    }).catch((err) => {
      message.error(err.message);
    })
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

  return (
    <>
      <div style={{ height: headerHeight+'px', padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', justifyContent: 'space-between' }}>
        <span style={{ flex: 'auto', paddingTop: '4px', width: '100px', }}>Projects</span>
        <Select options={[
            {value: 'NEWLOCALPROJECT', label: <><AntIcon name="PlusOutlined" />&nbsp;New Project</>},
            {value: 'menuExcludes', label: <><AntIcon name="SettingOutlined" />&nbsp;Global excludes</>, },
            userSession.local_projects&&userSession.local_projects.length>0 ? {title: 'Projects', label: 'Projects', options: userSession.local_projects.map((item) => {return {value: 'LOCALPPROJECT_'+item.label, label: item.label}})} : null,
          ].filter((x) => x)} placeholder="Choose a Project"
          value={currentLocalProject} onSelect={(value) => chooseProject(value)} style={{ width: '100%'}}>
        </Select>
      </div>
      <ProjectFileTree />
      <TextInputModal visible={showProjectInput} defaultValue={""} title={"Create a new project"} onCreate={createLocalProject} onCancel={() => setShowProjectInput(false)} placeholder={"Please input a project name"}></TextInputModal>
    </>
  );
}
