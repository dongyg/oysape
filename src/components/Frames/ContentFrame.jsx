import { useEffect } from 'react';
import { App, Tabs } from 'antd';
import { QuestionCircleFilled } from "@ant-design/icons";

import { useCustomContext } from '../Contexts/CustomContext'
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'
import Workspace from '../Modules/Workspace';
// import BlankContent from '../Modules/BlankContent';
// import CodeEditor from '../Modules/CodeEditor';
// import ServerEditor from '../Server/ServerEditor';

import './ContentFrame.css';

const defaultPanes = [
  {label: 'Workspace', key: '0', children: <Workspace inTabKey='0' />},
  // {label: 'CodeEditor', key: '1', children: <CodeEditor inTabKey='1' filename='/Users/Shared/Projects/oysape/requirements.txt' />},
  // {label: 'ServerEditor', key: '2', children: <ServerEditor />},
  // {label: 'Tab 3', key: '3', children: <BlankContent />},
];

const ContentFrame = () => {
  const { modal, notification } = App.useApp();
  const { customTheme, tabItems, setTabItems, tabActiveKey, setTabActiveKey } = useCustomContext();

  const getTabTitle = (key) => {
    const { label } = tabItems.find((pane) => pane.key === key) || '';
    return label;
  }
  const onChange = (key) => {
    setTabActiveKey(key); window.xterms.tabActiveKey = key; setTimeout(() => {window.dispatchEvent(new Event('resize'));}, 10);
  };
  const closeThisTab = (targetKey, force) => {
    // console.log('closeThisTab', targetKey, force);
    const tabTitle = getTabTitle(targetKey);
    if (targetKey === '0') {
      notification.error({
        message: 'Workspace',
        description: 'Workspace tab cannot be closed.',
      });
    } else if (tabTitle) {
      const hasSomethingNew = tabItems.filter((pane) => pane.key === targetKey)[0].hasSomethingNew;
      if (force || !hasSomethingNew) {
        removeTab(targetKey);
      } else {
        modal.confirm({
          title: 'Confirm to close',
          icon: <QuestionCircleFilled />,
          content: tabTitle + ' will be closed.',
          onOk() {
            removeTab(targetKey);
          },
          onCancel() {
            console.log('Cancel');
          },
        });
      }
    }
  }
  window.closeThisTab = closeThisTab;
  const removeTab = (targetKey) => {
    const targetIndex = tabItems.findIndex((pane) => pane.key === targetKey);
    const newPanes = tabItems.filter((pane) => pane.key !== targetKey);
    if (newPanes.length && targetKey === tabActiveKey) {
      const { key } = newPanes[targetIndex === newPanes.length ? targetIndex - 1 : targetIndex];
      setTabActiveKey(key); window.xterms.tabActiveKey = key; setTimeout(() => {window.dispatchEvent(new Event('resize'));}, 10);
    }
    setTabItems(newPanes);
  }
  const onEdit = (targetKey, action) => {
    if (action === 'add') {
    } else {
      closeThisTab(targetKey);
    }
  }

  useEffect(() => {
    setTabItems(defaultPanes)
  }, [setTabItems]);

  useKeyPress(keyMapping["closeTab"], (event) => {
    closeThisTab(tabActiveKey);
    event.preventDefault(); return;
  });
  useKeyPress(keyMapping["gotoTabWithNumber"], (event) => {
    const idx = (parseInt(event.key)+9)%10;
    if(tabItems.length > idx) {
      const key = tabItems[idx].key;
      setTabActiveKey(key); window.xterms.tabActiveKey = key; setTimeout(() => {window.dispatchEvent(new Event('resize'));}, 10);
    }
    event.preventDefault(); return;
  });

  return (
    <Tabs
      hideAdd
      size="small"
      animated={{ inkBar: false, tabPane: false }}
      tabBarGutter={0}
      onChange={onChange}
      activeKey={tabActiveKey}
      type="editable-card"
      onEdit={onEdit}
      items={tabItems||[]}
      className={customTheme.className}
      style={{ height: 'calc(100% - 56px)' }}
    />
  )
};
export default ContentFrame;
