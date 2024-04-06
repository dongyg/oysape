import React, {useState} from 'react';

import { App, Tree, Select, Dropdown } from 'antd';
import { UploadOutlined, CloudUploadOutlined, DownloadOutlined, DownOutlined, LoadingOutlined, ExclamationOutlined, EditOutlined, CopyOutlined, FolderViewOutlined, ReloadOutlined } from '@ant-design/icons';

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, getLanguages, calculateMD5 } from '../Common/global';
import CodeEditor from '../Modules/CodeEditor';

const { DirectoryTree } = Tree; // 把 Tree 赋值给 DirectoryTree, 然后使用 DirectoryTree 就是出现整行选中效果, 否则就不出现整行选中效果

export default function Sftp(props) {
  const { message, modal } = App.useApp();
  const { customTheme, tabItems, setTabItems, setTabActiveKey, userSession } = useCustomContext();
  const [sftpTarget, setSftpTarget] = useState('');
  const [sftpFileTree, setSftpFileTree] = useState({});
  const [contextMenuItems, setContextMenuItems] = React.useState([]);
  const headerHeight = '56px';
  const filetree = React.useRef(null);
  const time1 = React.useRef(0);
  const path1 = React.useRef('');
  const node1 = React.useRef(null);
  const miDivider = {type: 'divider', }
  const miOpenfile = {label: 'Open', key: 'tree_menu_openfile', icon: <EditOutlined />, }
  const miCopyPath = {label: 'Copy Name', key: 'tree_menu_copy_name', icon: <CopyOutlined />, }
  const miCopyAbsolutePath = {label: 'Copy Path', key: 'tree_menu_copy_path', icon: <FolderViewOutlined />, }
  const miDownload = {label: 'Download', key: 'tree_menu_download', icon: <DownloadOutlined />, }
  const miUploadFolder = {label: 'Upload a folder', key: 'tree_menu_upload_folder', icon: <UploadOutlined />, }
  const miUploadFile = {label: 'Upload a file', key: 'tree_menu_upload_file', icon: <CloudUploadOutlined />, }
  const miReload = {label: 'Refresh', key: 'tree_menu_refresh', icon: <ReloadOutlined />, }
  const miRefreshWholeTree = {label: 'Reload', key: 'tree_menu_reload', icon: <ReloadOutlined />, }

  const switchSftpTarget = (value) => {
    if(!value || !userSession.servers.map((item) => item.key).includes(value)) return;
    setSftpTarget(value);
    if(!sftpFileTree[value]){
      setSftpFileTree({...sftpFileTree, [value]:[{'title': 'Loading...', 'key': value+'_error', isLeaf: true, icon: <LoadingOutlined />}]});
      callApi('sftpGetFileTree', {target: value, path: '/'}).then((resp) => {
        if(resp && resp.errinfo) {
          message.error(resp.errinfo);
          setSftpFileTree({...sftpFileTree, [value]:[{'title': resp.errinfo, 'key': value, isLeaf: true, icon: <ExclamationOutlined />}]});
        } else if(resp && resp.fileList) {
          setSftpFileTree({...sftpFileTree, [value]: resp.fileList});
        }
      })
    }
  }

  const onClickMenu = ({ key }) => {
    if(!node1.current) return;
    if(key === 'tree_menu_copy_name') {
      message.info(node1.current.title);
      navigator.clipboard.writeText(node1.current.title);
    }else if(key === 'tree_menu_copy_path') {
      message.info(node1.current.path);
      navigator.clipboard.writeText(node1.current.path);
    }else if(key === 'tree_menu_openfile') {
      handleDoubleClick(node1.current);
    }else if(key === 'tree_menu_download') {
      callApi('download_remote_file', {target: sftpTarget, path:node1.current.path}).then((resp)=>{
        if(resp && resp.errinfo) {
          message.error(resp.errinfo);
        }
      });
    }else if(key === 'tree_menu_upload_folder') {
      callApi('upload_remote_folder', {target: sftpTarget, path:node1.current.path}).then((resp)=>{
        if(resp && resp.errinfo) {
          message.error(resp.errinfo);
        } else if (!node1.current.isLeaf && node1.current.expanded && resp && resp.count && resp.size) {
          reloadThisFolder(node1.current);
        }
      });
    }else if(key === 'tree_menu_upload_file') {
      callApi('upload_remote_file', {target: sftpTarget, path:node1.current.path}).then((resp)=>{
        if(resp && resp.errinfo) {
          message.error(resp.errinfo);
        } else if (!node1.current.isLeaf && node1.current.expanded && resp && resp.count && resp.size) {
          reloadThisFolder(node1.current);
        }
      });
    }else if(key === 'tree_menu_refresh') {
      reloadThisFolder(node1.current);
    }else if(key === 'tree_menu_reload') {
      reloadWholeTree();
    }
  }

  const reloadWholeTree = () => {
    const value = node1.current.key.replace('_error', '');
    setSftpFileTree({...sftpFileTree, [value]:null});
    switchSftpTarget(value);
  }
  const handleDoubleClick = (anode) => {
    const openIt = () => {
      callApi('open_remote_file', {target: sftpTarget, path:anode.path}).then((fileBody)=>{
        if(typeof fileBody === 'string') {
          const uniqueKey = calculateMD5(anode.path);
          if (tabItems.filter((item) => item.key === uniqueKey)[0]) {
          } else {
            setTabItems([...tabItems || [], {
              key: uniqueKey,
              fileKey: fileBody,
              label: sftpTarget+':'+anode.title,
              children: <CodeEditor uniqueKey={uniqueKey} target={sftpTarget} filename={anode.path} filebody={fileBody} tabTitle={sftpTarget+':'+anode.title} />,
            }]);
          }
          setTabActiveKey(uniqueKey);
        }else if(fileBody && fileBody.errinfo) {
          message.error(fileBody.errinfo);
        }
      })
    }
    if(anode.isLeaf) {
      if(anode.key.indexOf('_error') !== -1){
        reloadWholeTree();
      } else {
        openIt();
        const v1 = getLanguages(anode.path);
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
    if(!anode.isLeaf) {
      setSftpFileTree({...sftpFileTree, [sftpTarget]: updateTreeData(sftpFileTree[sftpTarget], anode.key, undefined, true)});
      callApi('sftpGetFileTree', {target: sftpTarget, path: anode.path}).then((resp) => {
        if(resp && resp.errinfo) {
          message.error(resp.errinfo);
          setSftpFileTree({...sftpFileTree, [sftpTarget]: updateTreeData(sftpFileTree[sftpTarget], anode.key, [{'title': resp.errinfo, 'key': anode.key+'_error', isLeaf: true, icon: <ExclamationOutlined />}], false)});
        } else if(resp && resp.fileList) {
          setSftpFileTree({...sftpFileTree, [sftpTarget]: updateTreeData(sftpFileTree[sftpTarget], anode.key, resp.fileList, false)});
        }
      });
    }
  }

  const handleExpand = (expandedKeys, e) => {
    if (e.expanded && !e.node.isLeaf && expandedKeys.includes(e.node.key) && !e.node.children) {
      reloadThisFolder(e.node);
    }
  }
  const updateTreeData = (list, key, children, isLoading) => {
    return list.map(node => {
      if (node.key === key) {
        return { ...node, children, icon: isLoading ? <LoadingOutlined /> : undefined };
      } else if (node.children) {
        return { ...node, children: updateTreeData(node.children, key, children, isLoading) };
      }
      return node;
    });
  };

  return (
    <>
      <div style={{ height: headerHeight, padding: '12px 16px', display: 'flex', flexWrap: 'nowrap', justifyContent: 'space-between' }}>
        <span style={{ flex: 'auto', paddingTop: '4px', width: '100px', }}>SFTP</span>
        <Select options={[{value:'', label: 'Choose a Server'}].concat(userSession.servers.map((item) => {return {value: item.key, label: item.name}}))} value={sftpTarget} onChange={(value) => switchSftpTarget(value)} style={{ width: '100%'}}></Select>
      </div>
      <div style={{ height: 'calc(100% - ' + headerHeight+')', overflow: 'auto' }} className='withScrollContent'>
        <Dropdown menu={{items: contextMenuItems, onClick: onClickMenu}} trigger={['contextMenu']}>
          <DirectoryTree ref={filetree} treeData={sftpFileTree[sftpTarget]||[]} switcherIcon={<DownOutlined />} className={customTheme.className} expandAction="doubleClick"
            onExpand={handleExpand}
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
              if(event.node.isLeaf) {
                if(event.node.key.indexOf('_error')>=0) {
                  setContextMenuItems([miRefreshWholeTree]);
                } else {
                  var items = [miOpenfile, miDivider, miCopyPath, miCopyAbsolutePath, miDivider, miDownload];
                  setContextMenuItems(items);
                }
              }else{
                setContextMenuItems([miCopyPath, miCopyAbsolutePath, miDivider, miDownload, miDivider, miUploadFolder, miUploadFile, miDivider, miReload, ]);
              }
            }}
          />
        </Dropdown>
      </div>
    </>
  );
}

