import { useState, useEffect, useCallback } from 'react';
import { App, Table, Tag, Input, Dropdown } from "antd";
import { SearchOutlined, EditOutlined, DeleteOutlined, QuestionCircleFilled } from '@ant-design/icons';
import { FiTerminal } from "react-icons/fi";

import { useCustomContext } from '../Contexts/CustomContext'
import { getUniqueKey, callApi } from '../Common/global';
import PipelineEditor from './PipelineEditor';
import './PipelineList.css';

const PipelineList = () => {
  const { message, modal } = App.useApp();
  const { pipelineItems, setPipelineItems, tabItems, setTabItems, setTabActiveKey } = useCustomContext();
  const [showPipelines, setShowPipelines] = useState(pipelineItems);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [multipleSelect, setMultipleSelect] = useState(false);
  const [editable, setEditable] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  const onClickMenu = ({ key }) => {
    if(!selectedRowKeys[0]) {
      // message.info(`Click on item ${key} ${selectedRowKeys[0]}`);
      return;
    }
    if(key === 'editPipeline') {
      editPipeline(selectedRowKeys[0]);
    }else if(key === 'deletePipeline') {
      deletePipeline(selectedRowKeys[0]);
    }else if(key === 'runPipeline') {
      callThisPipeline(selectedRowKeys[0])
    }
  };
  const contextItems = [
    { key: 'runPipeline', label: <strong>Run</strong>, icon: <FiTerminal />, },
    { type: 'divider', },
    { key: 'editPipeline', label: 'Edit', icon: <EditOutlined />, },
    { key: 'deletePipeline', label: 'Delete', icon: <DeleteOutlined />, },
  ];
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      ellipsis: true,
      render: (text, record, index) => (<Dropdown menu={{items: contextItems, onClick: onClickMenu}} trigger={['contextMenu']}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'break-spaces'}}>
            <div>{text}</div>
            <div style={{ textAlign: 'right' }}>
              { record.tags ? record.tags.map((tag) => (<Tag key={getUniqueKey()} onClick={onClickTag}>{tag}</Tag>)) : null }
            </div>
          </div>
          <div style={{ whiteSpace: 'break-spaces', color: '#666666' }}>
            {(record.steps||[]).map((step, idx) => '('+(step.tasks.join(','))+')@'+step.target).join(', ')}
          </div>
        </div>
      </Dropdown>)
    }
  ];
  const onClickTag = (event) => {
    setSearchKeyword(event.target.innerText);
    filterPipelines(event.target.innerText);
  }
  const onSearchKeywordChange = (event) => {
    setSearchKeyword(event.target.value);
    filterPipelines(event.target.value);
  }
  const filterPipelines = useCallback((keyword) => {
    setShowPipelines(
      (pipelineItems||[]).filter((pipeline) => {
        return pipeline.name.includes(keyword) || (pipeline.tags&&pipeline.tags.join(',').includes(keyword));
      })
    )
  }, [pipelineItems]);

  const selectRow = (record) => {
    if(editable&&multipleSelect) {
      if(selectedRowKeys.includes(record.key)) {
        setSelectedRowKeys(selectedRowKeys.filter((key) => key !== record.key));
      } else {
        setSelectedRowKeys(selectedRowKeys.concat([record.key]));
      }
    } else {
      setSelectedRowKeys([record.key]);
    }
  };
  const onSelectedRowKeysChange = (selectedRowKeys) => {
    setSelectedRowKeys(selectedRowKeys);
  };
  const rowSelection = {
    selectedRowKeys,
    hideSelectAll: true,
    type: multipleSelect&&editable?'checkbox':'radio',
    onChange: onSelectedRowKeysChange
  };

  const editPipeline = (pipelineKey) => {
    const tabKey = pipelineKey+'-pipeline-editor';
    const findItems = tabItems.filter((item) => item.pipelineKey === tabKey);
    if(findItems.length > 0) {
      setTabActiveKey(findItems[0].key);
    }else{
      const uniqueKey = getUniqueKey();
      setTabItems([...tabItems || [], {
        key: uniqueKey,
        pipelineKey: tabKey,
        label: pipelineKey,
        children: <PipelineEditor uniqueKey={uniqueKey} pipelineKey={pipelineKey} />,
      }]);
      setTabActiveKey(uniqueKey);
    }
  }
  const deletePipeline = (pipelineKey) => {
    modal.confirm({
      title: 'Confirm to delete',
      icon: <QuestionCircleFilled />,
      content: 'Pipeline '+pipelineKey+' will be deleted.',
      onOk() {
        callApi('deletePipeline', {key: pipelineKey}).then((data) => {
          if(data && data.errinfo) {
            message.error(data.errinfo);
          }else if(data && data.pipelineList) {
            setPipelineItems(data.pipelineList);
            setShowPipelines(showPipelines.filter((pipeline) => pipeline.key !== pipelineKey));
          }
        })
      },
      onCancel() {
        console.log('Cancel');
      },
    });
  }
  const callThisPipeline = (pipelineKey) => {
    const pipelineObj = pipelineItems.filter((pipeline) => pipeline.key === pipelineKey)[0]||{};
    console.log('pipelineObj', pipelineObj);
    if(pipelineObj&&pipelineObj.name){
      window.fillSearchPipeline(pipelineObj.name);
    }
  }

  useEffect(() => {
    filterPipelines(searchKeyword);
  }, [pipelineItems, searchKeyword, filterPipelines]);

  return (
    <>
    <Input prefix={<SearchOutlined />} onChange={onSearchKeywordChange} value={searchKeyword} allowClear={true} placeholder='Search' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
    <Table
      className={editable?'':'hide-selection-column'}
      rowSelection={rowSelection}
      showHeader={false}
      pagination={false}
      columns={columns}
      dataSource={showPipelines}
      onRow={(record) => ({
        onClick: () => {
          selectRow(record);
        },
        onContextMenu: () => {
          selectRow(record);
        },
        onDoubleClick: (event) => {
          console.log('onDoubleClick: record.key', record.key);
          if(window.fillSearchPipeline) {
            window.fillSearchPipeline(record.name);
          }
        },
      })}
    />
    </>
  )
}

export default PipelineList;