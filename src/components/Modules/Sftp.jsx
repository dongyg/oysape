import React, {useEffect, useState} from 'react';
import { Base64 } from 'js-base64';

import { App, Tree, Select, Dropdown, Button, Tooltip, Space } from 'antd';
import { VscServerEnvironment } from "react-icons/vsc";
import { BsTerminal } from "react-icons/bs";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, getCodeMirrorLanguages, calculateMD5, isDesktopVersion, isTabletOrPhone } from '../Common/global';
import AntIcon from '../Common/AntIcon';
import TextInputModal from './TextInputModal';
import ChooseRemotePath from './ChooseRemotePath';
import CodeEditor from '../Modules/CodeEditor';

const { DirectoryTree } = Tree; // 把 Tree 赋值给 DirectoryTree, 然后使用 DirectoryTree 就是出现整行选中效果, 否则就不出现整行选中效果

export default function Sftp(props) {
  const { message, modal } = App.useApp();
  const { hideSidebarIfNeed, customTheme, tabItems, setTabItems, setTabActiveKey, userSession, setUserSession } = useCustomContext();
  const [sftpTarget, setSftpTarget] = useState(null);
  const [sftpFileTree, setSftpFileTree] = useState({});
  const [contextMenuItems, setContextMenuItems] = React.useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [showFilenameInput, setShowFilenameInput] = React.useState(false);
  const [showProjectInput, setShowProjectInput] = React.useState(false);
  const [showChooseRemotePath, setShowChooseRemotePath] = React.useState(false);
  const headerHeight = 56;
  const filetree = React.useRef(null);
  const time1 = React.useRef(0);
  const path1 = React.useRef('');
  const node1 = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const miDivider = {type: 'divider', }
  const miOpenTermial = {label: 'Open in Terminal', key: 'tree_menu_open_terminal', icon: <BsTerminal />, }
  const miNewFile = {label: 'New', key: 'tree_menu_newfile', icon: <AntIcon name="FileAddOutlined" />, }
  const miOpenfile = {label: 'Open', key: 'tree_menu_openfile', icon: <AntIcon name="EditOutlined" />, }
  const miCopyPath = {label: 'Copy Name', key: 'tree_menu_copy_name', icon: <AntIcon name="CopyOutlined" />, }
  const miCopyAbsolutePath = {label: 'Copy Path', key: 'tree_menu_copy_path', icon: <AntIcon name="FolderViewOutlined" />, }
  const miDownload = {label: 'Download', key: 'tree_menu_download', icon: <AntIcon name="DownloadOutlined" />, }
  const miUploadFolder = {label: 'Upload a folder', key: 'tree_menu_upload_folder', icon: <AntIcon name="UploadOutlined" />, }
  const miUploadFile = {label: 'Upload a file', key: 'tree_menu_upload_file', icon: <AntIcon name="CloudUploadOutlined" />, }
  const miReload = {label: 'Refresh', key: 'tree_menu_refresh', icon: <AntIcon name="ReloadOutlined" />, }
  // const miRefreshWholeTree = {label: 'Reload', key: 'tree_menu_reload', icon: <AntIcon name="ReloadOutlined" />, }
  const miAddSftpFolder = {label: 'Add a folder to project', key: 'tree_menu_add_sftp_folder', icon: <AntIcon name="PlusCircleOutlined" />, }
  const miDelSftpFolder = {label: 'Remove from project', key: 'tree_menu_del_sftp_folder', icon: <AntIcon name="MinusCircleOutlined" />, }
  const miDelSftpProject = {label: 'Delete project', key: 'tree_menu_del_sftp_project', icon: <AntIcon name="DeleteOutlined" />, }

  const switchSftpTarget = (value, force, projects) => {
    setSftpTarget(value);
    // if(!value || (!value.startsWith('SFTPPROJECT_') && value!=='NEWSFTPPROJECT' && !userSession.servers.map((item) => item.key).includes(value))) return;
    if(value === 'NEWSFTPPROJECT') {
      setShowProjectInput(true);
    } else if(value && value.startsWith('SFTPPROJECT_')) {
      const sftProject = (projects||userSession.remote_projects).find((item) => item.label === value.replace('SFTPPROJECT_', ''));
      if(sftProject) {
        setSftpTarget(value);
        if(!sftpFileTree[value] || force){
          setSftpFileTree({...sftpFileTree, [value]:Object.keys(sftProject.folders||{}).map(target => ({
              title: target, key: `target_${target}`, isLeaf: false, icon: <VscServerEnvironment />, target: target,
              children: (sftProject.folders[target]||[]).map(path => ({
                title: path, key: `${target}:${path}`, isLeaf: false, target: target, path: path
              }))
            }))
          });
        }
        setContextMenuItems([miAddSftpFolder, miDivider, miDelSftpProject]);
      }
    } else if (value && userSession.servers.map((item) => item.key).includes(value)) {
      setContextMenuItems([]);
      if(!sftpFileTree[value] || force) {
        setSftpFileTree({...sftpFileTree, [value]:[{'title': 'Loading...', 'key': value+'_error', isLeaf: true, icon: <AntIcon name="LoadingOutlined" />}]});
        callApi('sftpGetFileTree', {target: value, path: '/'}).then((resp) => {
          if(resp && resp.errinfo) {
            message.error(resp.errinfo);
            setSftpFileTree({...sftpFileTree, [value]:[{'title': resp.errinfo, 'key': value, isLeaf: true, icon: <AntIcon name="ExclamationOutlined" />, failed: true}]});
          } else if(resp && resp.fileList) {
            setSftpFileTree({...sftpFileTree, [value]: resp.fileList});
          }
        }).catch((err) => {
          message.error(err.message);
        })
      }
    }else{
      setContextMenuItems([]);
    }
  }

  const onClickMenu = ({ key }) => {
    // if(!node1.current) return;
    const serverKey = (node1.current && node1.current.target) || sftpTarget;
    if(node1.current && key === 'tree_menu_open_terminal') {
      window.openServerTerminal && window.openServerTerminal(serverKey, null, node1.current.path?'cd '+node1.current.path:null);
    }else if(node1.current && key === 'tree_menu_newfile') {
      setShowFilenameInput(true);
    }else if(node1.current && key === 'tree_menu_copy_name') {
      message.info(node1.current.title);
      navigator.clipboard.writeText(node1.current.title);
    }else if(node1.current && key === 'tree_menu_copy_path') {
      message.info(node1.current.path);
      navigator.clipboard.writeText(node1.current.path);
    }else if(node1.current && key === 'tree_menu_openfile') {
      handleDoubleClick(node1.current);
    }else if(node1.current && key === 'tree_menu_download') {
      callApi('download_remote_file', {target: serverKey, path:node1.current.path}).then((resp)=>{
        if(resp && resp.errinfo) {
          message.error(resp.errinfo);
        }else if(resp && resp.content) {
          const fileBody = Base64.decode(resp.content);
          const blob = new Blob([fileBody], {type: 'application/octet-stream'});
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = node1.current.title;
          link.setAttribute('download', node1.current.title);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }).catch((err) => {
        message.error(err.message);
      });
    }else if(node1.current && key === 'tree_menu_upload_folder') {
      callApi('upload_remote_folder', {target: serverKey, path:node1.current.path}).then((resp)=>{
        if(resp && resp.errinfo) {
          message.error(resp.errinfo);
        } else if (!node1.current.isLeaf && node1.current.expanded && resp && resp.count && resp.size) {
          reloadThisFolder(node1.current);
        }
      }).catch((err) => {
        message.error(err.message);
      });
    }else if(node1.current && key === 'tree_menu_upload_file') {
      if(!isDesktopVersion) {
        fileInputRef.current.click();
      } else {
        callApi('upload_remote_file', {target: serverKey, path:node1.current.path}).then((resp)=>{
          if(resp && resp.errinfo) {
            message.error(resp.errinfo);
          } else if (!node1.current.isLeaf && node1.current.expanded && resp && resp.count && resp.size) {
            reloadThisFolder(node1.current);
          }
        }).catch((err) => {
          message.error(err.message);
        });
      }
    }else if(node1.current && key === 'tree_menu_refresh') {
      reloadThisFolder(node1.current);
    }else if(key === 'tree_menu_reload') {
      reloadWholeTree();
    }else if(key === 'tree_menu_add_sftp_folder') {
      setShowChooseRemotePath(true);
    }else if(key === 'tree_menu_del_sftp_folder') {
      modal.confirm({
        title: 'Confirm to remove '+(node1.current.path?'folder':'server'),
        icon: <AntIcon name="QuestionCircleFilled" />,
        content: 'Are you sure to remove '+(node1.current.path?'folder':'server')+' ['+(node1.current.path||serverKey)+'] ?',
        onOk() {
          let params = {tid: userSession.team0, label: sftpTarget.replace('SFTPPROJECT_', ''), target: serverKey, folder: node1.current.path}
          callApi('delSftpProjectItem', params).then((resp)=>{
            if(resp && resp.errinfo) {
              message.error(resp.errinfo);
            } else {
              setUserSession({...userSession, remote_projects: resp.remote_projects||[]});
              switchSftpTarget(sftpTarget, true, resp.remote_projects||[]);
            }
          }).catch((err) => {
            message.error(err.message);
          });
        },
        onCancel() {
        },
      });
    }else if(key === 'tree_menu_del_sftp_project') {
      modal.confirm({
        title: 'Confirm to delete project',
        icon: <AntIcon name="QuestionCircleFilled" />,
        content: 'Are you sure to delete project ['+(sftpTarget.replace('SFTPPROJECT_', ''))+'] ?',
        onOk() {
          let params = {tid: userSession.team0, label: sftpTarget.replace('SFTPPROJECT_', '')}
          callApi('delSftpProjectItem', params).then((resp)=>{
            if(resp && resp.errinfo) {
              message.error(resp.errinfo);
            } else {
              setUserSession({...userSession, remote_projects: resp.remote_projects||[]});
              switchSftpTarget(null, true, resp.remote_projects||[]);
            }
          }).catch((err) => {
            message.error(err.message);
          });
        },
        onCancel() {
        },
      });
    }
  }

  const reloadWholeTree = (anode) => {
    const value = (anode || node1.current).key.replace('_error', '');
    setSftpFileTree({...sftpFileTree, [value]:null});
    switchSftpTarget(value, true);
  }
  const handleDoubleClick = (anode) => {
    const serverKey = anode.target || sftpTarget;
    const openIt = () => {
      const uniqueKey = calculateMD5(serverKey+':'+anode.path);
      if (tabItems.find((item) => item.key === uniqueKey)) {
      } else {
        setTabItems([...tabItems || [], {
          key: uniqueKey,
          label: <><AntIcon name="LoadingOutlined" /> {serverKey+':'+anode.title}</>,
          children: <CodeEditor uniqueKey={uniqueKey} target={serverKey} filename={anode.path} tabTitle={serverKey+':'+anode.title} />,
        }]);
      }
      setTabActiveKey(uniqueKey);
      hideSidebarIfNeed();
    }
    if(anode.isLeaf) {
      if(anode.key.indexOf('_error') !== -1 || anode.failed){
        reloadThisFolder(node1.current);
      } else {
        openIt();
        const v1 = getCodeMirrorLanguages(anode.path);
        if(!(v1&&v1.length>0)) {
          modal.confirm({
            title: anode.title,
            content: 'Unknown file type. Do you want to edit this file?',
            onOk() {
              openIt();
            },
            onCancel() {},
          })
        } else {
          openIt();
        }
      }
    }
  }

  const reloadThisFolder = (anode) => {
    if(anode.target && !anode.path){
      switchSftpTarget(sftpTarget, true);
      return;
    }
    const serverKey = anode.target || sftpTarget;
    if(!anode.isLeaf) {
      setSftpFileTree({...sftpFileTree, [sftpTarget]: updateTreeData(sftpFileTree[sftpTarget], anode.key, undefined, true, serverKey)});
      callApi('sftpGetFileTree', {target: serverKey, path: anode.path}).then((resp) => {
        if(resp && resp.errinfo) {
          message.error(resp.errinfo);
          setSftpFileTree({...sftpFileTree, [sftpTarget]: updateTreeData(sftpFileTree[sftpTarget], anode.key, [{'title': resp.errinfo, 'key': anode.key+'_error', isLeaf: true, icon: <AntIcon name="ExclamationOutlined" />}], false, serverKey)});
        } else if(resp && resp.fileList) {
          setSftpFileTree({...sftpFileTree, [sftpTarget]: updateTreeData(sftpFileTree[sftpTarget], anode.key, resp.fileList, false, serverKey)});
        }
      }).catch((err) => {
        message.error(err.message);
      });
    } else if (anode.key && userSession.servers.map((item) => item.key).includes(anode.key)){
      reloadWholeTree(anode);
    } else {
      console.log('reloadThisFolder', anode);
    }
  }

  const handleExpand = (expandedKeys, e) => {
    if (e.expanded && !e.node.isLeaf && expandedKeys.includes(e.node.key) && !e.node.children) {
      reloadThisFolder(e.node);
    }
  }
  const updateTreeData = (list, key, children, isLoading, serverKey) => {
    return list.map(node => {
      if (node.key === key) {
        return { ...node, target: serverKey, children, icon: isLoading ? <AntIcon name="LoadingOutlined" /> : undefined };
      } else if (node.children) {
        return { ...node, target: serverKey, children: updateTreeData(node.children, key, children, isLoading, serverKey) };
      }
      return {...node, target: serverKey};
    });
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = function() {
        const base64content = reader.result.split(',')[1]; // Remove the data URI scheme part
        callApi('upload_remote_file', {target: sftpTarget, path:node1.current.path, filename:file.name, filebody:base64content}).then((resp)=>{
          if(resp && resp.errinfo) {
            message.error(resp.errinfo);
          } else if (!node1.current.isLeaf && node1.current.expanded) {
            reloadThisFolder(node1.current);
          }
        }).catch((err) => {
          message.error(err.message);
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const createRemoteFile = (path) => {
    setShowFilenameInput(false);
    const serverKey = node1.current.target || sftpTarget;
    let sudo = false;
    let handleResponse = (resp) => {
      if(resp && resp.errinfo) {
        if(!sudo && resp.errinfo.indexOf('Permission denied')>=0) {
          modal.confirm({
            title: 'Permission denied',
            content: 'Do you want to try with sudo?',
            onOk() {
              sudo = true;
              callApi('create_remote_file', {target: serverKey, path:node1.current.path, filename:path, sudo:sudo}).then((r2)=>{
                handleResponse(r2);
              }).catch((err) => {
                message.error(err.message);
              })
            },
            onCancel() {},
          })
        } else {
          message.error(resp.errinfo);
        }
    } else {
        reloadThisFolder(node1.current);
      }
    }
    callApi('create_remote_file', {target: serverKey, path:node1.current.path, filename:path, sudo:sudo}).then((resp)=>{
      handleResponse(resp);
    }).catch((err) => {
      message.error(err.message);
    })
  }

  const setContextMenus = (anode) => {
    console.log(anode);
    if(anode) {
      if(anode.isLeaf) {
        if(anode.key.indexOf('_error')>=0 || anode.failed) {
          setContextMenuItems([miReload]);
        } else {
          var items = [miOpenfile, miDivider, miCopyPath, miCopyAbsolutePath, miDivider, miDownload];
          setContextMenuItems(items);
        }
      }else{
        let preItems = (userSession.accesses.terminal?[miOpenTermial, miDivider]:[]);
        if(anode.target && anode.key.startsWith('target_')) {
          setContextMenuItems(preItems.concat([miAddSftpFolder, miDivider, miDelSftpFolder]));
        } else if (anode.target && anode.key.startsWith(anode.target+':')) {
          setContextMenuItems(preItems.concat([miNewFile, miDivider, miCopyPath, miDivider, miDownload, miDivider, miUploadFolder, miUploadFile, miDivider, miReload, miDivider, miDelSftpFolder]));
        }else if(isDesktopVersion){
          setContextMenuItems(preItems.concat([miNewFile, miDivider, miCopyPath, miCopyAbsolutePath, miDivider, miDownload, miDivider, miUploadFolder, miUploadFile, miDivider, miReload, ]));
        }else{
          setContextMenuItems(preItems.concat([miNewFile, miDivider, miCopyPath, miCopyAbsolutePath, miDivider, miUploadFile, miDivider, miReload, ]));
        }
      }
    }else if(sftpTarget&&sftpTarget.startsWith('SFTPPROJECT_')){
      setContextMenuItems([miAddSftpFolder, miDivider, miDelSftpProject]);
    }else{
      setContextMenuItems([]);
    }
  }

  const createSftpProject = (projectLabel) => {
    callApi('addSftpProjectItem', {tid: userSession.team0, label: projectLabel}).then((resp) => {
      setShowProjectInput(false);
      if(resp && resp.errinfo) {
        message.error(resp.errinfo);
      } else {
        setUserSession({...userSession, remote_projects: resp.remote_projects||[]});
        switchSftpTarget('SFTPPROJECT_'+projectLabel, true, resp.remote_projects||[]);
      }
    }).catch((err) => {
      message.error(err.message);
    })
  }

  const handleChooseRemotePath = (params) => {
    setShowChooseRemotePath(false);
    if(params && params.server && params.currentPath) {
      // Add SFTP folder
      callApi('addSftpProjectItem', {tid: userSession.team0, label: sftpTarget.replace('SFTPPROJECT_', ''), target: params.server, folder: params.currentPath}).then((resp)=>{
        if(resp && resp.errinfo) {
          message.error(resp.errinfo);
        } else {
          setUserSession({...userSession, remote_projects: resp.remote_projects||[]});
          switchSftpTarget(sftpTarget, true, resp.remote_projects||[]);
        }
      }).catch((err) => {
        message.error(err.message);
      })
    }
  }

  useEffect(() => {
    switchSftpTarget(null, true, []);
  }, [userSession.team0]);

  return (
    <>
      <div style={{ height: headerHeight+'px', padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', justifyContent: 'space-between' }}>
        <span style={{ flex: 'auto', paddingTop: '4px', width: '100px', }}>SFTP</span>
        <Select options={[
            // {title: 'Servers', label: 'Choose a Server or Project'},
            {title: 'Servers', label: 'Servers', options: userSession.servers.map((item) => {return {value: item.key, label: item.name}})},
            {title: 'Projects', label: 'Projects', options: userSession.remote_projects.map((item) => {return {value: 'SFTPPROJECT_'+item.label, label: item.label}}).concat([{value: 'NEWSFTPPROJECT', label: <><AntIcon name="PlusOutlined" />&nbsp;New Project</>}])},
          ]} placeholder="Choose a Server or Project"
          value={sftpTarget} onSelect={(value) => switchSftpTarget(value)} style={{ width: '100%'}}>
        </Select>
      </div>
      <div style={{ height: 'calc(100% - ' + (headerHeight+(contextMenuItems.length>0?56:0))+'px)', overflow: 'auto' }} className='withScrollContent' onClick={(e) => {
        setSelectedKeys([]);
        time1.current = 0;
        path1.current = '';
        node1.current = null;
        setContextMenus(null);
      }}>
        <Dropdown menu={{items: contextMenuItems, onClick: (e) => {
          e.domEvent.stopPropagation();
          onClickMenu(e);
        }}} trigger={['contextMenu']}>
          <DirectoryTree ref={filetree} treeData={sftpFileTree[sftpTarget]||[]} switcherIcon={null} className={['no-switcher',customTheme.className]}
            expandAction={isTabletOrPhone?"click":"doubleClick"}
            selectedKeys={selectedKeys}
            onExpand={handleExpand}
            onSelect={(keys, info) => {
              setSelectedKeys(keys);
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
            onClick={(e, node) => {
              e.stopPropagation();
            }}
          />
        </Dropdown>
      </div>
      <Space style={{ padding: '8px', width: '100%', display: 'flex', justifyContent: 'flex-start' }} size={0}>
        {contextMenuItems.map((item) => {
          return item.type!=='divider' ? <Tooltip title={item.label}><Button type="text" size="large" icon={item.icon} onClick={(e) => {onClickMenu({key:item.key});}} ></Button></Tooltip> : null
        })}
      </Space>
      {/* For uploading files */}
      <input type="file" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} />
      {/* For create new file */}
      <TextInputModal visible={showFilenameInput} defaultValue={""} title={"Create a new file"} onCreate={createRemoteFile} onCancel={() => setShowFilenameInput(false)} placeholder={"Please input a file name"}></TextInputModal>
      {/* For create new project */}
      <TextInputModal visible={showProjectInput} defaultValue={""} title={"Create a new project"} onCreate={createSftpProject} onCancel={() => setShowProjectInput(false)} placeholder={"Please input a project name"}></TextInputModal>
      <ChooseRemotePath visible={showChooseRemotePath} serverKey={(node1.current&&node1.current.target)||null} serverVisible={'visible'} chooseType={"folder"} onOk={handleChooseRemotePath} onCancel={() => setShowChooseRemotePath(false)}></ChooseRemotePath>
    </>
  );
}

