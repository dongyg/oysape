import { App, Button, Dropdown } from 'antd';
import { BsPlusLg, BsThreeDots } from "react-icons/bs";
import { ImportOutlined, ExportOutlined, DeleteFilled, QuestionCircleFilled } from '@ant-design/icons';

import { useCustomContext } from '../Contexts/CustomContext'
import { getUniqueKey, callApi } from '../Common/global';
import PipelineList from './PipelineList';
import PipelineEditor from './PipelineEditor';

export default function PipelinesPanel() {
  const { message, modal } = App.useApp();
  const { hideSidebarIfNeed, tabItems, setTabItems, setTabActiveKey, userSession, setUserSession } = useCustomContext();
  const headerHeight = '56px';

  const addPipeline = () => {
    const uniqueKey = getUniqueKey();
    setTabItems([...tabItems || [], {
      key: uniqueKey,
      pipelineKey: "pipeline-new",
      label: "New Pipeline",
      children: <PipelineEditor uniqueKey={uniqueKey} pipelineKey={""} />,
    }]);
    setTabActiveKey(uniqueKey);
    hideSidebarIfNeed();
  }

  const menuItems = [
    { key: 'menuNewPipeline', label: ('Add a new Pipeline'), icon: <BsPlusLg />, },
    { type: 'divider', },
    { key: 'menuImportPipeline', label: ( 'Import' ), icon: <ImportOutlined />, },
    { key: 'menuExportPipeline', label: ( 'Export' ), icon: <ExportOutlined />, },
    { type: 'divider', },
    { key: 'menuEmptyPipeline', label: ( 'Remove all pipelines' ), icon: <DeleteFilled />, },
  ];
  const onClickMenu = ({ key }) => {
    if(key === 'menuNewPipeline') {
      addPipeline()
    }else if(key === 'menuImportPipeline') {
      callApi('importTo', {what: 'pipelines'}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }else if(data && data.pipelines) {
          setUserSession({...userSession, pipelines: data.pipelines});
        }
      })
    }else if(key === 'menuExportPipeline') {
      callApi('exportFrom', {what: 'pipelines'}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }
      })
    }else if(key === 'menuEmptyPipeline') {
      modal.confirm({
        title: 'Confirm to delete',
        icon: <QuestionCircleFilled />,
        content: 'Are you sure to delete all pipelines?',
        onOk() {
          callApi('deletePipeline', {key: '__ALL__'}).then((data) => {
            if(data && data.errinfo) {
              message.error(data.errinfo);
            }else if(data && data.pipelines) {
              setUserSession({...userSession, pipelines: data.pipelines});
            }
          })
        },
        onCancel() {
          console.log('Cancel');
        },
      });
    }
  };

  return (
    <>
    <div style={{ height: headerHeight, padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <span style={{ flex: 'auto', paddingTop: '4px' }}>Pipelines</span>
      {
        userSession.teams[userSession.team0].is_creator || userSession.teams[userSession.team0].members.find(item => item.email === userSession.email)?.access_writable ?
        <div>
          <Dropdown menu={{ items: menuItems, onClick: onClickMenu }} placement="topRight">
            <Button type='text' icon={<BsThreeDots />}></Button>
          </Dropdown>
        </div> : null
      }
    </div>
    <div style={{ height: 'calc(100% - ' + headerHeight+')', overflow: 'auto' }} className='withScrollContent'>
      <PipelineList />
    </div>
    </>
  );
}