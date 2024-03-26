import React, {useState} from 'react';

import { App, Dropdown, Select, Tree, } from 'antd';
import * as AntIcons from '@ant-design/icons';

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, getUniqueKey } from '../Common/global';
import CommandInputModal from './TextInputModal';
import Terminal from '../Modules/UITerminal1';

const { DirectoryTree } = Tree; // 把 Tree 赋值给 DirectoryTree, 然后使用 DirectoryTree 就是出现整行选中效果, 否则就不出现整行选中效果

const AntIcon = ({ name, ...props }) => {
  const IconComponent = AntIcons[name];
  if (!IconComponent) { // 如果找不到对应的图标，则返回 null 或默认图标
    return null;
    // 或者返回一个默认的图标，例如：return <AntIcons.QuestionCircleOutlined {...props} />;
  }
  return <IconComponent {...props} />;
};

export default function ProjectsPanel() {
  const { message, modal } = App.useApp();
  const { customTheme, setTabActiveKey, tabItems, setTabItems, userSession } = useCustomContext();
  const [dockerTarget, setDockerTarget] = useState('');
  const [dockerTree, setDockerTree] = useState({});
  const [contextMenuItems, setContextMenuItems] = React.useState([]);
  const [dockerCommandInputVisible, setDockerCommandInputVisible] = React.useState(false);
  const [dockerComposeInputVisible, setDockerComposeInputVisible] = React.useState(false);
  const headerHeight = '56px';
  const filetree = React.useRef(null);
  const time1 = React.useRef(0);
  const path1 = React.useRef('');
  const node1 = React.useRef(null);
  const miReloadAll = {label: 'Refresh', key: 'tree_menu_reload_all', icon: <AntIcon name="ReloadOutlined" />, }
  const miReloadOne = {label: 'Refresh', key: 'tree_menu_reload_one', icon: <AntIcon name="ReloadOutlined" />, }

  const switchDockerTarget = (value) => {
    if(!value || !userSession.servers.map((item) => item.key).includes(value)) return;
    // 第1级节点使用一个 json 结构来定义有哪些 docker 操作. 可以包含: docker, container, image, compose
    setDockerTarget(value);
    if(!dockerTree[value]){
      reloadDockerServer(value);
    }
  }

  const openTerminalWithCommand = (serverKey, command) => {
    const newIdx = tabItems.filter((item) => item.serverKey === serverKey).length + 1;
    const uniqueKey = getUniqueKey();
    setTabItems([...tabItems || [], {
      key: uniqueKey,
      serverKey: serverKey,
      label: serverKey+'('+newIdx+')',
      children: <Terminal uniqueKey={uniqueKey} serverKey={serverKey} withCommand={command} />,
    }]);
    setTabActiveKey(uniqueKey);
  };

  const onClickMenu = (menuItem) => {
    if(!node1.current) return;
    const fullItem = contextMenuItems.find(i => i.key === menuItem.key);
    if(menuItem.key === 'tree_menu_reload_all') {
      reloadDockerServer(dockerTarget);
    }else if(menuItem.key === 'tree_menu_set_docker_command') {
      setDockerCommandInputVisible(true);
    }else if(menuItem.key === 'tree_menu_reload_one') {
      reloadThisFolder(node1.current);
    }else if(menuItem.key.startsWith('tree_menu_command_')) {
      const parentNode = dockerTree[dockerTarget].find(node => node.key === node1.current.parent);
      const execThis = () => {
        const commandString = fullItem.command.replace(/{theName}/g, node1.current.theName);
        if(fullItem.terminal){
          openTerminalWithCommand(dockerTarget, commandString);
        } else {
          setTabActiveKey('workspace');
          callApi('dockerExecCommand', {'target': dockerTarget, 'command': commandString}).then((resp) => {
            reloadThisFolder(parentNode);
          });
        }
      }
      if(fullItem.confirm) {
        modal.confirm({
          title: 'Delete '+node1.current.title,
          content: fullItem.confirm,
          icon: <AntIcon name="QuestionCircleOutlined" />,
          onOk() {
            execThis();
          },
          onCancel() {
          },
        })
      } else {
        execThis();
      }
    }
  }

  const handleDoubleClick = (anode) => {
    console.log(anode);
  }

  const reloadDockerServer = (serverKey) => {
    setDockerTree({[serverKey]:[{'title': 'Loading...', 'key': serverKey+'_docker', isLeaf: true, icon: <AntIcon name="LoadingOutlined" />}]});
    callApi('dockerGetWholeTree', {target: serverKey}).then((resp) => {
      if(resp && resp.errinfo) {
        message.error(resp.errinfo);
        setDockerTree({[serverKey]:[{'title': resp.errinfo, 'key': serverKey+'_docker_version', isLeaf: true, icon: <AntIcon name="ExclamationOutlined" />}]});
      } else if(resp && resp.version && resp.featureList) {
        setDockerTree({...dockerTree, [serverKey]: resp.featureList});
      }
    })
  }

  const reloadThisFolder = (anode) => {
    setDockerTree({...dockerTree, [dockerTarget]: updateTreeData(dockerTree[dockerTarget], anode.key, anode.children, true)});
    callApi('dockerGetTreeNode', {target: dockerTarget, nodeKey: anode.key}).then((resp) => {
      if(resp && resp.errinfo) {
        message.error(resp.errinfo);
        setDockerTree({...dockerTree, [dockerTarget]: updateTreeData(dockerTree[dockerTarget], anode.key, [{'title': resp.errinfo, 'key': anode.key+'_error', isLeaf: true, icon: <AntIcon name="ExclamationOutlined" />}], false)});
      } else if(resp && resp.children) {
        setDockerTree({...dockerTree, [dockerTarget]: updateTreeData(dockerTree[dockerTarget], anode.key, resp.children, false)});
      }
    });
  }

  const updateTreeData = (list, key, children, isLoading) => {
    return list.map(node => {
      if (node.key === key) {
        return { ...node, children, icon: isLoading ? <AntIcon name="LoadingOutlined" /> : undefined };
      } else if (node.children) {
        return { ...node, children: updateTreeData(node.children, key, children, isLoading) };
      }
      return node;
    });
  };

  const handleDockerCommandOk = (value) => {
    setDockerCommandInputVisible(false);
    callApi('dockerSetDockerCommand', {'target': dockerTarget, 'command': value}).then((resp) => {
      reloadDockerServer(dockerTarget);
    });
  }
  const handleDockerComposeOk = (value) => {
    setDockerComposeInputVisible(false);
    callApi('dockerSetComposeCommand', {'target': dockerTarget, 'command': value}).then((resp) => {

    });
  }

  return (
    <>
      <div style={{ height: headerHeight, padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', justifyContent: 'space-between' }}>
        <span style={{ flex: 'auto', paddingTop: '4px', width: '100px', }}>Docker</span>
        <Select options={[{value:'', label: 'Choose a Server'}].concat(userSession.servers.map((item) => {return {value: item.key, label: item.name}}))} value={dockerTarget} onChange={(value) => switchDockerTarget(value)} style={{ width: '100%'}}></Select>
      </div>
      <div style={{ height: 'calc(100% - ' + headerHeight+')', overflow: 'auto' }} className='withScrollContent'>
        <Dropdown menu={{items: contextMenuItems, onClick: onClickMenu}} trigger={['contextMenu']}>
          <DirectoryTree ref={filetree} treeData={dockerTree[dockerTarget]||[]} switcherIcon={<AntIcon name="DownOutlined" />} className={customTheme.className}
            onSelect={(selectedKeys, info) => {
              if(Date.now() - time1.current < 500 && path1.current === info.node.path) {
                time1.current = Date.now();
                if(info.node.children&&info.node.children.length>0) {
                  return;
                } else{
                  handleDoubleClick(info.node);
                }
              }
              time1.current = Date.now();
              path1.current = info.node.path;
            }}
            onRightClick={(event) => {
              node1.current = event.node;
              if(event.node.key === dockerTarget+'_docker_version') {
                var items = [];
                if (event.node.title.includes('not found')||event.node.title.includes('no such')){
                  items.push({key: 'tree_menu_set_docker_command', label: 'Set Docker Command', icon: <AntIcon name="SettingOutlined" />});
                }else if(event.node.menus){
                  items = items.concat(event.node.menus.map((item) => {return {...item, icon: <AntIcon name={item.icon} />}}));
                }
                if(items.length>0) items.push({'type': 'divider' });
                items.push(miReloadAll);
                setContextMenuItems(items);
              }else if (event.node.isLeaf){
                const parentNode = dockerTree[dockerTarget].find(node => node.key === event.node.parent);
                setContextMenuItems(parentNode.subMenus ? parentNode.subMenus.map((item) => {return {...item, icon: <AntIcon name={item.icon} />}}) : []);
              }else{
                setContextMenuItems([miReloadOne]);
              }
            }}
          />
        </Dropdown>
      </div>
      <CommandInputModal visible={dockerCommandInputVisible} onCreate={handleDockerCommandOk} onCancel={()=>setDockerCommandInputVisible(false)} title={"Give the docker position"} placeholder={"Enter the docker command position, such as: /usr/local/bin/"} />
      <CommandInputModal visible={dockerComposeInputVisible} onCreate={handleDockerComposeOk} onCancel={()=>setDockerComposeInputVisible(false)} title={"Give the docker compose position"} placeholder={"Enter the docker compose command position, such as: /usr/local/bin/"} />
    </>
  );
}