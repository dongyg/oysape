import React, {useState} from 'react';

import { App, Dropdown, Select, Tree, Button, Tooltip, Space } from 'antd';

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, } from '../Common/global';
import AntIcon from '../Common/AntIcon';
import CommandInputModal from './TextInputModal';

const { DirectoryTree } = Tree; // 把 Tree 赋值给 DirectoryTree, 然后使用 DirectoryTree 就是出现整行选中效果, 否则就不出现整行选中效果

export default function ProjectsPanel() {
  const { message, modal } = App.useApp();
  const { hideSidebarIfNeed, customTheme, setTabActiveKey, userSession } = useCustomContext();
  const [dockerTarget, setDockerTarget] = useState('');
  const [dockerTree, setDockerTree] = useState({});
  const [contextMenuItems, setContextMenuItems] = React.useState([]);
  const [dockerCommandInputVisible, setDockerCommandInputVisible] = React.useState(false);
  const [dockerComposeInputVisible, setDockerComposeInputVisible] = React.useState(false);
  const headerHeight = 56;
  const filetree = React.useRef(null);
  const time1 = React.useRef(0);
  const path1 = React.useRef('');
  const node1 = React.useRef(null);
  const miReloadAll = {label: 'Refresh', key: 'tree_menu_reload_all', icon: <AntIcon name="ReloadOutlined" />, }
  const miReloadOne = {label: 'Refresh', key: 'tree_menu_reload_one', icon: <AntIcon name="ReloadOutlined" />, }
  const miDivider = {'type': 'divider' };
  const miSetDockerCommand = {key: 'tree_menu_set_docker_command', label: 'Set Docker Command', icon: <AntIcon name="SettingOutlined" />};
  const miSetComposeCommand = {key: 'tree_menu_set_compose_command', label: 'Set Docker Compose Command', icon: <AntIcon name="SettingOutlined" />};

  const switchDockerTarget = (value) => {
    if(!value || !userSession.servers.map((item) => item.key).includes(value)) return;
    // 第1级节点使用一个 json 结构来定义有哪些 docker 操作. 可以包含: docker, container, image, compose
    setDockerTarget(value);
    if(!dockerTree[value]){
      reloadDockerServer(value);
    }
  }

  // const openTerminalWithCommand = (serverKey, command) => {
  //   const newIdx = tabItems.filter((item) => item.serverKey === serverKey).length + 1;
  //   const uniqueKey = getUniqueKey();
  //   setTabItems([...tabItems || [], {
  //     key: uniqueKey,
  //     serverKey: serverKey,
  //     label: serverKey+'('+newIdx+')',
  //     children: <Terminal uniqueKey={uniqueKey} serverKey={serverKey} withCommand={command} />,
  //   }]);
  //   setTabActiveKey(uniqueKey);
  // };

  const onClickMenu = (menuItem) => {
    if(!node1.current) return;
    const fullItem = contextMenuItems.find(i => i.key === menuItem.key);
    if(menuItem.key === 'tree_menu_reload_all') {
      reloadDockerServer(dockerTarget);
    }else if(menuItem.key === 'tree_menu_set_docker_command') {
      setDockerCommandInputVisible(true);
    }else if(menuItem.key === 'tree_menu_set_compose_command') {
      setDockerComposeInputVisible(true);
    }else if(menuItem.key === 'tree_menu_reload_one') {
      reloadThisFolder(node1.current);
    }else if(menuItem.key.startsWith('tree_menu_command_')) {
      const parentNode = dockerTree[dockerTarget].find(node => node.key === node1.current.parent);
      const execThis = () => {
        const commandString = fullItem.command.replace(/{theName}/g, node1.current.theName);
        if(fullItem.terminal){
          window.openServerTerminal && window.openServerTerminal(dockerTarget, null, commandString);
          if(fullItem.hideSide) hideSidebarIfNeed();
        } else {
          setTabActiveKey('workspace');
          callApi('dockerExecCommand', {'target': dockerTarget, 'command': commandString}).then((resp) => {
            if(parentNode&&fullItem.refresh) reloadThisFolder(parentNode);
            if(fullItem.hideSide) hideSidebarIfNeed();
          }).catch((err) => {
            message.error(err.message);
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
    // console.log(anode);
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
    }).catch((err) => {
      message.error(err.message);
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
    }).catch((err) => {
      message.error(err.message);
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
    }).catch((err) => {
      message.error(err.message);
    });
  }
  const handleDockerComposeOk = (value) => {
    setDockerComposeInputVisible(false);
    callApi('dockerSetComposeCommand', {'target': dockerTarget, 'command': value}).then((resp) => {
      reloadDockerServer(dockerTarget);
    }).catch((err) => {
      message.error(err.message);
    });
  }

  const setContextMenus = (anode) => {
    if(anode.key === dockerTarget+'_docker_version') {
      var items = [];
      if (anode.title.includes('not found')||anode.title.includes('no such')||anode.title.includes('Cannot connect')){
        items.push(miSetDockerCommand);
        items.push(miSetComposeCommand);
      }else if(anode.menus){
        items = items.concat(anode.menus.map((item) => {return {...item, icon: <AntIcon name={item.icon} />}}));
      }
      if(items.length>0) items.push(miDivider);
      items.push(miReloadAll);
      setContextMenuItems(items);
    }else if (anode.isLeaf){
      const parentNode = dockerTree[dockerTarget].find(node => node.key === anode.parent);
      setContextMenuItems(parentNode && parentNode.subMenus ? parentNode.subMenus.map((item) => {return {...item, icon: <AntIcon name={item.icon} />}}) : []);
    }else{
      setContextMenuItems([miReloadOne]);
    }
  }

  return (
    <>
      <div style={{ height: headerHeight+'px', padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', justifyContent: 'space-between' }}>
        <span style={{ flex: 'auto', paddingTop: '4px', width: '100px', }}>Docker</span>
        <Select options={[{value:'', label: 'Choose a Server'}].concat(userSession.servers.map((item) => {return {value: item.key, label: item.name}}))} value={dockerTarget} onChange={(value) => switchDockerTarget(value)} style={{ width: '100%'}}></Select>
      </div>
      <div style={{ height: 'calc(100% - ' + (headerHeight+(node1.current?48:0))+'px)', overflow: 'auto' }} className='withScrollContent'>
        <Dropdown menu={{items: contextMenuItems, onClick: onClickMenu}} trigger={['contextMenu']}>
          <DirectoryTree ref={filetree} treeData={dockerTree[dockerTarget]||[]} switcherIcon={<AntIcon name="DownOutlined" />} className={customTheme.className}
            onSelect={(selectedKeys, info) => {
              node1.current = info.node;
              setContextMenus(node1.current);
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
              setContextMenus(node1.current);
            }}
          />
        </Dropdown>
      </div>
      <Space style={{ padding: '8px', width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
        {contextMenuItems.map((item) => {
          return item.type!=='divider' ? <Tooltip title={item.label}><Button type="text" icon={item.icon} onClick={(e) => {onClickMenu({key:item.key});}} ></Button></Tooltip> : null
        })}
      </Space>
      <CommandInputModal visible={dockerCommandInputVisible} onCreate={handleDockerCommandOk} onCancel={()=>setDockerCommandInputVisible(false)} title={"Give the docker command prefix"} placeholder={"Such as: /usr/local/bin/, sudo"} />
      <CommandInputModal visible={dockerComposeInputVisible} onCreate={handleDockerComposeOk} onCancel={()=>setDockerComposeInputVisible(false)} title={"Give the docker compose command prefix"} placeholder={"Such as: /usr/local/bin/, sudo"} />
    </>
  );
}