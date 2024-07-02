import { useState, useEffect, useCallback } from 'react';
import { App, Table, Tag, Input, Dropdown, Space, Button, Tooltip } from "antd";
import { SearchOutlined, EditOutlined, DeleteOutlined, QuestionCircleFilled } from '@ant-design/icons';
import { FiTerminal } from "react-icons/fi";

import { useCustomContext } from '../Contexts/CustomContext'
import { getUniqueKey, callApi } from '../Common/global';
import PipelineEditor from './PipelineEditor';
import './PipelineList.css';

const PipelineList = () => {
  const { message, modal } = App.useApp();
  const { hideSidebarIfNeed, tabItems, setTabItems, setTabActiveKey, userSession, setUserSession } = useCustomContext();
  const [showPipelines, setShowPipelines] = useState(userSession.pipelines);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [multipleSelect] = useState(false);
  const [editable] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  const onClickMenu = (e) => {
    if(e.domEvent) e.domEvent.stopPropagation();
    if(!selectedRowKeys[0]) {
      // message.info(`Click on item ${key} ${selectedRowKeys[0]}`);
      return;
    }
    if(e.key === 'editPipeline') {
      editPipeline(selectedRowKeys[0]);
    }else if(e.key === 'deletePipeline') {
      deletePipeline(selectedRowKeys[0]);
    }else if(e.key === 'runPipeline') {
      callThisPipeline(selectedRowKeys[0])
    }
  };
  const getContextItems = () => {
    var retval = [
      { key: 'runPipeline', label: <strong>Run</strong>, icon: <FiTerminal />, },
    ];
    if(userSession.accesses.writable) {
      retval = retval.concat([
        { type: 'divider', },
        { key: 'editPipeline', label: 'Edit', icon: <EditOutlined />, },
        { key: 'deletePipeline', label: 'Delete', icon: <DeleteOutlined />, },
      ])
    }
    return retval;
  };
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      render: (text, record, index) => (<Dropdown menu={{items: getContextItems(), onClick: onClickMenu}} trigger={['contextMenu']}>
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
      (userSession.pipelines||[]).filter((pipeline) => {
        return pipeline.name.includes(keyword) || (pipeline.tags&&pipeline.tags.join(',').includes(keyword));
      })
    )
  }, [userSession]);

  const selectRow = (record, isContextMenu) => {
    if(editable&&multipleSelect) {
      if(selectedRowKeys.includes(record.key)) {
        setSelectedRowKeys(selectedRowKeys.filter((key) => key !== record.key));
      } else {
        setSelectedRowKeys(selectedRowKeys.concat([record.key]));
      }
    } else {
      if(selectedRowKeys.includes(record.key) && !isContextMenu) {
        setSelectedRowKeys([]);
      }else{
        setSelectedRowKeys([record.key]);
      }
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
    const findItem = tabItems.find((item) => item.pipelineKey === tabKey);
    if(findItem) {
      setTabActiveKey(findItem.key);
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
    hideSidebarIfNeed();
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
          }else if(data && data.pipelines) {
            setUserSession({...userSession, pipelines: data.pipelines});
            setShowPipelines(showPipelines.filter((pipeline) => pipeline.key !== pipelineKey));
          }
        })
      },
      onCancel() {
        // console.log('Cancel');
      },
    });
  }
  const callThisPipeline = (pipelineKey) => {
    const pipelineObj = userSession.pipelines.find((pipeline) => pipeline.key === pipelineKey)||{};
    if(pipelineObj&&pipelineObj.name){
      window.fillSearchPipeline(pipelineObj.name);
    }
    hideSidebarIfNeed();
  }

  useEffect(() => {
    filterPipelines(searchKeyword);
  }, [searchKeyword, filterPipelines]);

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
          selectRow(record, true);
        },
        onDoubleClick: () => {
          callThisPipeline(record.key);
        },
      })}
      expandable={{ showExpandColumn: false, expandRowByClick: true, expandedRowKeys: selectedRowKeys,
        expandedRowRender: (record) => <Space style={{ padding: '8px', width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
          {getContextItems().map((item) => {
            return item.type!=='divider' ? <Tooltip title={item.label}><Button type="text" size="large" icon={item.icon} onClick={(e) => {onClickMenu({key:item.key});}} ></Button></Tooltip> : null
          })}
        </Space>
      }}
    />
    </>
  )
}

export default PipelineList;