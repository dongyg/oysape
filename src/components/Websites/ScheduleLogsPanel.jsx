import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { App, Layout, Button, Dropdown, Input, Table, Space, Tooltip, Typography, Modal } from 'antd';
import { BsThreeDots } from "react-icons/bs";
import { EyeOutlined, DeleteFilled, QuestionCircleFilled, DeleteOutlined, SearchOutlined, CheckOutlined, LoadingOutlined } from '@ant-design/icons';

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, isMobileVersion, callNativeApi, decolorizeText } from '../Common/global';
import AnsiText from './AnsiText';

import '../Server/ServersPanel.css';

const { Content } = Layout;
const { Text } = Typography;

export default function ScheduleLogsPanel() {
  const { message, modal } = App.useApp();
  const { customTheme, userSession, currentSideKey } = useCustomContext();
  const headerHeight = '56px';
  const [schItems, setSchItems] = useState([]);
  const [currentSch, setCurrentSch] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showedItems, setShowedItems] = useState([]);
  const [totalNumber, setTotalNumber] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showScheduleView, setShowScheduleView] = useState(false);
  const [showLogObject, setShowLogObject] = useState({});
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [multipleSelect] = useState(false);
  const [editable] = useState(false);

  const getPanelMenuItems = () => {
    var retval = [];
    if(schItems.length > 0) {
      retval.push({ key: 'menuSch_', label: 'All Schedules', icon: currentSch === '' ? <CheckOutlined /> : undefined, });
      retval.push({
          key: 'menuSchGroup',
          type: 'group',
          label: 'Schedules',
          children: schItems.map((item) => { return { key: 'menuSch_'+item.title, label: item.title, icon: currentSch === item.title ? <CheckOutlined /> : undefined, }}),
      })
      retval = retval.concat({ type: 'divider', });
    }
    retval = retval.concat([
      { key: 'menuDeleteShowed', label: ( 'Remove all showed' ), icon: <DeleteOutlined />, },
      { key: 'menuDeleteAllLogs', label: ( 'Remove all logs' ), icon: <DeleteFilled />, },
    ]);
    return retval;
  };
  const onClickPanelMenu = ({ key }) => {
    if(key === 'menuDeleteShowed') {
      modal.confirm({
        title: 'Confirm to delete',
        icon: <QuestionCircleFilled />,
        content: 'Are you sure to delete showed logs?',
        onOk() {
          callApi('deleteScheduleLogs', {keys: showedItems.map((item) => item.key)}).then((data) => {
            if(data && data.errinfo) {
              message.error(data.errinfo);
            } else if (data.number) {
              message.info('Deleted ' + data.number + ' logs.');
              setTotalNumber(totalNumber - data.number);
              setShowedItems([]);
            }
          })
        },
        onCancel() {
          // console.log('Cancel');
        },
      });
    }else if(key === 'menuDeleteAllLogs') {
      modal.confirm({
        title: 'Confirm to delete',
        icon: <QuestionCircleFilled />,
        content: 'Are you sure to delete all logs?',
        onOk() {
          callApi('deleteScheduleLogs', {keys: '__ALL__'}).then((data) => {
            if(data && data.errinfo) {
              message.error(data.errinfo);
            } else if (data.number) {
              message.info('Deleted ' + data.number + ' logs.');
              setTotalNumber(totalNumber - data.number);
              setShowedItems([]);
            }
          })
        },
        onCancel() {
          // console.log('Cancel');
        },
      });
    }else if(key.startsWith('menuSch_')) {
      let sch = key.replace('menuSch_', '');
      setCurrentPage(1);
      setCurrentSch(sch);
      setShowedItems([]);
      setHasMore(true);
      handleScroll();
    }
  };

  const getContextItems = () => {
    var retval = [
      { key: 'menuViewLog', label: <strong>View log</strong>, icon: <EyeOutlined />, },
    ];
    if(userSession.accesses.writable) {
      retval = retval.concat([
        { type: 'divider', },
        { key: 'deleteItem', label: 'Delete', icon: <DeleteOutlined />, },
      ]);
    }
    return retval;
  };
  const onClickContextMenu = ({ key }) => {
    if(!selectedRowKeys[0]) {
      // message.info(`Click on item ${key} ${selectedRowKeys[0]}`);
      return;
    }
    if(key === 'menuViewLog') {
      viewThisLog(selectedRowKeys[0]);
    }else if(key === 'deleteItem') {
      modal.confirm({
        title: 'Confirm to delete',
        icon: <QuestionCircleFilled />,
        content: 'Are you sure to delete this log?',
        onOk() {
          callApi('deleteScheduleLogOne', {key: selectedRowKeys[0]}).then((data) => {
            if(data && data.errinfo) {
              message.error(data.errinfo);
            } else {
              setShowedItems( showedItems.filter((item) => item.key !== selectedRowKeys[0]) );
              setTotalNumber(totalNumber - 1);
              setSelectedRowKeys([]);
            }
          })
        },
        onCancel() {
          // console.log('Cancel');
        },
      });
    }
  };
  const viewThisLog = (key) => {
    const logItem = showedItems.find((item) => item.key === key)
    if(isMobileVersion) {
      callNativeApi('showScheduleLog', {...logItem, out1: decolorizeText(logItem.out1), tsText: dayjs.unix(logItem.ts).format('YYYY-MM-DD HH:mm:ss')}).then((data) => {
      }).catch((error) => {
      });
    } else {
      setShowLogObject(logItem);
      setShowScheduleView(true);
    }
  }

  const handleScheduleViewOk = () => {
    setShowScheduleView(false);
  };

  const columns = [
    {
      title: "sch",
      dataIndex: "sch",
      render: (text, record, index) => {
        return (<Dropdown menu={{items: getContextItems(), onClick: onClickContextMenu}} trigger={['contextMenu']}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'break-spaces'}}>
            <div>{record.sch}</div>
          </div>
          <div><Text type='secondary'>{ dayjs.unix(record.ts).format('YYYY-MM-DD HH:mm:ss') }</Text></div>
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#666666' }}>{decolorizeText(record.out1)}</div>
        </div>
      </Dropdown>)
      }
    }
  ];

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
  const onSearchKeywordChange = (event) => {
    setSearchKeyword(event.target.value);
    setCurrentPage(1);
    setShowedItems([]);
    setHasMore(true);
    handleScroll();
  }

  const filterItems = () => {
    callApi('execQueryScheduleLogs', {'sch': currentSch, 'qrytxt': searchKeyword.toLowerCase(), 'page': currentPage}).then((resp) => {
      if(resp && resp.errinfo) {
        setHasMore(false);
        message.error(resp.errinfo);
      } else if(resp.list) {
        setTotalNumber(resp.total);
        setHasMore(resp.total > showedItems.length + resp.list.length);
        setShowedItems(showedItems.concat(resp.list));
        setCurrentPage(currentPage + 1);
        if(schItems.length === 0) {
          setSchItems(resp.schs||[]);
        }
      }
    }).catch((error) => {
      setHasMore(false);
      console.log(error);
    })
  }

  const divRef = React.useRef(null);
  const handleScroll = () => {
    // 判断当前显示的边栏面板是否是本面板, 并且要判断 divRef.current.clientHeight > 0 说明不是刚刚切换到当前面板
    if (divRef.current && currentSideKey === 'sideWebhostLogs' && divRef.current.clientHeight > 0) {
      const isBottom = divRef.current.scrollHeight - divRef.current.scrollTop === divRef.current.clientHeight;
      if (isBottom && hasMore) {
        filterItems();
      }
    }
  };

  useEffect(() => {
    handleScroll();
  })

  return (
    <>
    <div style={{ height: headerHeight, padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <span style={{ flex: 'auto', paddingTop: '4px' }}>Schedule Logs ({showedItems.length}/{totalNumber})</span>
      {
        userSession.accesses.writable ?
        <div>
          <Dropdown menu={{ items: getPanelMenuItems(), onClick: onClickPanelMenu }} placement="topRight">
            <Button type='text' icon={<BsThreeDots />}></Button>
          </Dropdown>
        </div> : null
      }
    </div>
    <div style={{ height: 'calc(100% - ' + headerHeight+')', overflow: 'auto' }} className='withScrollContent' ref={divRef} onScroll={handleScroll}>
      <Input prefix={<SearchOutlined />} onChange={onSearchKeywordChange} value={searchKeyword} allowClear={true} placeholder='Search' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
      <Table style={{ overflowX: 'hidden' }}
        className={editable?'':'hide-selection-column'}
        rowSelection={{
          selectedRowKeys,
          hideSelectAll: true,
          type: multipleSelect&&editable?'checkbox':'radio',
          onChange: onSelectedRowKeysChange,
          columnWidth: '0px',
        }}
        showHeader={false}
        pagination={false}
        columns={columns}
        dataSource={showedItems}
        onRow={(record) => ({
          onClick: () => {
            selectRow(record);
          },
          onContextMenu: () => {
            selectRow(record, true);
          },
          onDoubleClick: () => {
            viewThisLog(record.id);
          }
        })}
        expandable={{ showExpandColumn: false, expandRowByClick: true, expandedRowKeys: selectedRowKeys,
          expandedRowRender: (record) => <Space style={{ padding: '8px', width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
            {getContextItems().map((item) => {
              return item.type!=='divider' ? <Tooltip title={item.label}><Button type="text" size="large" icon={item.icon} onClick={(e) => {onClickContextMenu({key:item.key});}} ></Button></Tooltip> : null
            })}
          </Space>
        }}
      />
      <div style={{ textAlign: 'center', margin: '12px 0' }} hidden={!hasMore}><LoadingOutlined /></div>
      <div style={{ textAlign: 'center', margin: '12px 0' }} hidden={hasMore}><Text type="secondary">No more</Text></div>
    </div>
    <Modal title={showLogObject.sch} open={showScheduleView} onOk={handleScheduleViewOk} onCancel={handleScheduleViewOk} style={{ minWidth: '70%'}} footer={null}>
      <Content className='withScrollContent enableHighlight'>
        <Text type='secondary'>{ dayjs.unix(showLogObject.ts).format('YYYY-MM-DD HH:mm:ss')}</Text>
        <div className={customTheme.className} style={{ backgroundColor: customTheme.colors["editor.background"], padding: "4px" }}>
          <AnsiText text={showLogObject.out1} />
        </div>
      </Content>
    </Modal>
    </>
  );
}
