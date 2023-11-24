import { Button, Tooltip } from 'antd';
import { BsPlusLg } from "react-icons/bs";

import { useCustomContext } from '../Contexts/CustomContext'
import { getUniqueKey } from '../Common/global';
import PipelineList from './PipelineList';
import PipelineEditor from './PipelineEditor';

export default function PipelinesPanel() {
  const { tabItems, setTabItems, setTabActiveKey } = useCustomContext();
  const headerHeight = '56px';

  const addPipeline = () => {
    const uniqueKey = getUniqueKey();
    setTabItems([...tabItems || [], {
      key: uniqueKey,
      pipelineKey: "pipeline-new",
      label: "New Pipeline",
      children: <PipelineEditor inTabKey={uniqueKey} uniqueKey={uniqueKey} pipelineKey={""} />,
    }]);
    setTabActiveKey(uniqueKey); window.xterms.tabActiveKey = uniqueKey; setTimeout(() => {window.dispatchEvent(new Event('resize'));}, 10);

  }

  return (
    <>
    <div style={{ height: headerHeight, padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <span style={{ flex: 'auto', paddingTop: '4px' }}>Pipelines</span>
      <div>
        <Tooltip placement="bottomRight" title="Add a new pipeline">
          <Button type='text' icon={<BsPlusLg />} onClick={(event) => {
              addPipeline()
            }}>
          </Button>
        </Tooltip>
      </div>
    </div>
    <div style={{ height: 'calc(100% - ' + headerHeight+')', overflow: 'auto' }} className='withScrollContent'>
      <PipelineList />
    </div>
    </>
  );
}