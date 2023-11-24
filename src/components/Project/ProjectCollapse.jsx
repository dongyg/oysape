// 不使用该组件
// 使用 Collapse 组件包含不同的内容. 最终效果上还有一点点问题: 第一组高度足够整个窗口时, 后面的组头只会在底部, 只有收起第一组时才能看到下面的内容
// 另外考虑到如果在 vscode 中做插件的话, 内容的组织结构会有所不同

import { Collapse, Button } from 'antd';
import { FileEarmarkPlus, FolderPlus, PlusLg, DashSquare } from 'react-bootstrap-icons';

import { useCustomContext } from '../Contexts/CustomContext'
import ProjectFileTree from './ProjectFileTree';
import PipelineList from '../Pipeline/PipelineList';

import './ProjectCollapse.less';

export default function ProjectCollapse() {
  const { customTheme } = useCustomContext();
  const genExtraForFiles = () => (
    <>
      <Button type='text' icon={<FileEarmarkPlus />} style={{ fontSize: '1.12em' }} onClick={(event) => {
        // If you don't want click extra trigger collapse, you can prevent this:
        event.stopPropagation();
      }}>
      </Button>
      <Button type='text' icon={<FolderPlus />} style={{ fontSize: '1.12em' }} onClick={(event) => {
        // If you don't want click extra trigger collapse, you can prevent this:
        event.stopPropagation();
      }}>
      </Button>
      <Button type='text' icon={<DashSquare />} style={{ fontSize: '1.12em' }} onClick={(event) => {
        // If you don't want click extra trigger collapse, you can prevent this:
        event.stopPropagation();
      }}>
      </Button>
    </>
  );
  const getExtraForPipelines = () => (
    <>
      <Button type='text' icon={<PlusLg />} style={{ fontSize: '1.12em' }} onClick={(event) => {
        // If you don't want click extra trigger collapse, you can prevent this:
        event.stopPropagation();
      }}>
      </Button>
    </>
  )

  const panels = [
    {
      key: '1',
      label: 'Files',
      children: <ProjectFileTree />,
      extra: genExtraForFiles(),
    },
    {
      key: '2',
      label: 'Pipelines',
      children: <PipelineList />,
      extra: getExtraForPipelines(),
    },
  ];

  return (
      <Collapse defaultActiveKey={['1','2']} size='small' items={panels} className={customTheme.className}></Collapse>
  );
}