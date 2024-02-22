import { App, Button, Dropdown } from 'antd';
import { BsPlusLg, BsThreeDots } from "react-icons/bs";
import { ImportOutlined, ExportOutlined } from '@ant-design/icons';

import { useCustomContext } from '../Contexts/CustomContext'
import { getUniqueKey, callApi } from '../Common/global';
import PipelineList from './PipelineList';
import PipelineEditor from './PipelineEditor';

export default function PipelinesPanel() {
  const { message } = App.useApp();
  const { tabItems, setTabItems, setTabActiveKey } = useCustomContext();
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
  }

  const menuItems = [
    { key: 'menuNewPipeline', label: ('Add a new Pipeline'), icon: <BsPlusLg />, },
    { type: 'divider', },
    { key: 'menuImportPipeline', label: ( 'Import' ), icon: <ImportOutlined />, },
    { key: 'menuExportPipeline', label: ( 'Export' ), icon: <ExportOutlined />, },
  ];
  const onClickMenu = ({ key }) => {
    if(key === 'menuNewPipeline') {
      addPipeline()
    }else if(key === 'menuImportPipeline') {
      callApi('importTo', {what: 'pipelines'}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }else{
          window.reloadPipelineList();
        }
      })
    }else if(key === 'menuExportPipeline') {
      callApi('exportFrom', {what: 'pipelines'}).then((data) => {
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }
      })
    }
  };

  return (
    <>
    <div style={{ height: headerHeight, padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <span style={{ flex: 'auto', paddingTop: '4px' }}>Pipelines</span>
      <div>
        <Dropdown menu={{ items: menuItems, onClick: onClickMenu }} placement="topRight">
          <Button type='text' icon={<BsThreeDots />}></Button>
        </Dropdown>
      </div>
    </div>
    <div style={{ height: 'calc(100% - ' + headerHeight+')', overflow: 'auto' }} className='withScrollContent'>
      <PipelineList />
    </div>
    </>
  );
}