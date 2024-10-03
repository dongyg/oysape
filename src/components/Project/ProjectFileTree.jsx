import React, {useEffect, useState, useCallback} from 'react'
import { App, Tree, Dropdown, Space, Tooltip, Button } from 'antd';
import { QuestionCircleFilled } from '@ant-design/icons';

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, isTabletOrPhone } from '../Common/global';

import AntIcon from '../Common/AntIcon';
import './ProjectFileTree.css';

const { DirectoryTree } = Tree; // 把 Tree 赋值给 DirectoryTree, 然后使用 DirectoryTree 就是出现整行选中效果, 否则就不出现整行选中效果

export default function ProjectFileTree() {
  const { message, modal } = App.useApp();
  const { hideSidebarIfNeed, customTheme, folderFiles, setFolderFiles, userSession, setUserSession, currentLocalProject, setCurrentLocalProject } = useCustomContext();
  const headerHeight = 56;
  const [contextMenuItems, setContextMenuItems] = React.useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const filetree = React.useRef(null);
  const time1 = React.useRef(0);
  const path1 = React.useRef('');
  const node1 = React.useRef(null);
  const miDivider = {type: 'divider', }
  // const miCollapse = {label: 'Collapse', key: 'tree_menu_collapse', }
  // const miExpand = {label: 'Expand', key: 'tree_menu_expand', }
  const miReload = {label: 'Reload', key: 'tree_menu_reload', icon: <AntIcon name="ReloadOutlined" />, }
  const miNewFile = {label: 'New', key: 'tree_menu_newfile', icon: <AntIcon name="FileAddOutlined" />, }
  const miOpenfile = {label: 'Open', key: 'tree_menu_openfile', icon: <AntIcon name="EditOutlined" />, }
  const miCopyPath = {label: 'Copy Name', key: 'tree_menu_copy_name', icon: <AntIcon name="CopyOutlined" />, }
  const miCopyAbsolutePath = {label: 'Copy Path', key: 'tree_menu_copy_path', icon: <AntIcon name="FolderViewOutlined" />, }
  const miRemoveFromProject = {label: 'Remove from project', key: 'tree_menu_remove_from_project', icon: <AntIcon name="DeleteOutlined" />, }
  const miAddToExclude = {label: 'Add to exclude', key: 'tree_menu_add_to_exclude', icon: <AntIcon name="StopOutlined" />, }
  const miAddLocalFolder = {label: 'Add a folder to project', key: 'tree_menu_add_local_folder', icon: <AntIcon name="PlusCircleOutlined" />, }
  const miDelLocalProject = {label: 'Delete project', key: 'tree_menu_del_local_project', icon: <AntIcon name="MinusCircleOutlined" />, }

  const onClickMenu = ({ key }) => {
    // if(!node1.current) return;
    if(key === 'tree_menu_newfile') {
      createNewFile(node1.current.path);
    }else if(key === 'tree_menu_copy_name') {
      message.info(node1.current.title);
      navigator.clipboard.writeText(node1.current.title);
    }else if(key === 'tree_menu_copy_path') {
      message.info(node1.current.path);
      navigator.clipboard.writeText(node1.current.path);
    }else if(key === 'tree_menu_openfile') {
      handleDoubleClick(node1.current);
    }else if(key === 'tree_menu_remove_from_project') {
      let lpname = currentLocalProject.replace('LOCALPPROJECT_', '');
      modal.confirm({
        title: node1.current.path,
        icon: <QuestionCircleFilled />,
        content: 'Will be removed from this project.',
        onOk() {
          callApi('delLocalProjectItem', {tid: userSession.team0, label: lpname, folder: node1.current.path}).then((resp) => {
            if(resp && resp.errinfo) {
              message.error(resp.errinfo);
            }else if(resp && resp.local_projects) {
              setUserSession({...userSession, local_projects: resp.local_projects});
              setFolderFiles(resp.folderFiles[lpname]);
              setContextMenus(null);
            }
          }).catch((err) => { message.error(err.message); })
          // callApi('removeFolder', {path: node1.current.path}).then((data) => {
          //   if(data && data.errinfo) {
          //     message.error(data.errinfo);
          //   }else if(data && data.folderFiles) {
          //     setFolderFiles(data.folderFiles);
          //   }
          // }).catch((err) => { message.error(err.message); })
        },
        onCancel() {
          // console.log('Cancel');
        },
      });
    }else if(key === 'tree_menu_add_to_exclude') {
      let lpname = currentLocalProject.replace('LOCALPPROJECT_', '');
      modal.confirm({
        title: 'This will be added to the exclude list',
        icon: <QuestionCircleFilled />,
        content: node1.current.path,
        onOk() {
          callApi('addExcludeToFolder', {path: node1.current.path, label: lpname}).then((data) => {
            if(data && data.errinfo) {
              message.error(data.errinfo);
            }else if(data && data.folderFiles) {
              setFolderFiles(data.folderFiles[lpname]);
            }
          }).catch((err) => { message.error(err.message); })
        },
        onCancel() {
          // console.log('Cancel');
        },
      });
    } else if(key === 'tree_menu_add_local_folder') {
      addLocalProjectFolder();
    } else if(key === 'tree_menu_del_local_project') {
      modal.confirm({
        title: 'Confirm to delete project?',
        icon: <QuestionCircleFilled />,
        content: '',
        onOk() {
          callApi('delLocalProjectItem', {tid: userSession.team0, label: currentLocalProject.replace('LOCALPPROJECT_', '')}).then((resp) => {
            if(resp && resp.errinfo) {
              message.error(resp.errinfo);
            }else if(resp && resp.local_projects) {
              setUserSession({...userSession, local_projects: resp.local_projects});
              setCurrentLocalProject(null);
              setContextMenuItems([]);
              setFolderFiles([]);
            }
          }).catch((err) => { message.error(err.message); })
        },
        onCancel() {
          // console.log('Cancel');
        },
      });
    } else if(key === 'tree_menu_reload') {
      reloadFolderFiles();
    }
  }

  const addLocalProjectFolder = () => {
    let lpname = currentLocalProject.replace('LOCALPPROJECT_', '');
    callApi('addLocalProjectItem', {tid: userSession.team0, label: lpname}).then((resp) => {
      if(resp && resp.errinfo) {
        message.error(resp.errinfo);
      } else {
        setUserSession({...userSession, local_projects: resp.local_projects||[]});
        setFolderFiles(resp.folderFiles[lpname]||[]);
      }
    }).catch((err) => {
      message.error(err.message);
    })
    // callApi('addFolder', {lpname: currentProject}).then((data) => {
    //   if(data && data.errinfo) {
    //     message.error(data.errinfo);
    //   }else if(data && data.folderFiles) {
    //     setFolderFiles(data.folderFiles);
    //   }
    // }).catch((err) => { message.error(err.message); })
  }
  const handleDoubleClick = (anode) => {
    if(window.openProjectFile && anode.isLeaf) {
      window.openProjectFile(anode.path, anode.title);
      hideSidebarIfNeed();
    }
  }

  const createNewFile = (path) => {
    let lpname = currentLocalProject.replace('LOCALPPROJECT_', '');
    callApi('createNewFile', {path:path}).then((data) => {
      if(data && data.errinfo) {
        message.error(data.errinfo);
      }else if(data && data.folderFiles) {
        setFolderFiles(data.folderFiles[lpname]||[]);
      }
    }).catch((err) => { message.error(err.message); })
  }

  const reloadFolderFiles = useCallback(() => {
    if(!currentLocalProject) return;
    let lpname = currentLocalProject.replace('LOCALPPROJECT_', '');
    callApi('getFolderFiles', {lpname: lpname, refresh: true}).then((data) => {
      if(data && data.errinfo) {
        message.error(data.errinfo);
      } else if(data && data[lpname]) {
        setFolderFiles(data[lpname]);
      }
    });
  }, [setFolderFiles, currentLocalProject, message]);
  window.reloadFolderFiles = reloadFolderFiles;

  const setContextMenus = (anode) => {
    if(anode && !anode.isLeaf) {
      var items = [miNewFile, miDivider, miCopyPath, miCopyAbsolutePath];
      // items.push(miDivider, anode.expanded ? miCollapse : miExpand);
      items.push(miDivider, anode.root ? miRemoveFromProject : miAddToExclude);
      setContextMenuItems(items);
    }else if(anode && anode.isLeaf) {
      setContextMenuItems([miOpenfile, miDivider, miCopyPath, miCopyAbsolutePath, miDivider, miAddToExclude]);
    }else if (currentLocalProject){
      setContextMenuItems([miAddLocalFolder, miDivider, miDelLocalProject, miDivider, miReload]);
    }else{
      setContextMenuItems([]);
    }
  }

  useEffect(() => {
    setContextMenus(null);
    window.reloadFolderFiles();
  }, [currentLocalProject]);

  return (
    <>
      <div style={{ height: 'calc(100% - ' + (headerHeight+(contextMenuItems.length>0?56:0))+'px)', overflow: 'auto' }} className='withScrollContent' onClick={(e) => {
        setSelectedKeys([]);
        time1.current = 0;
        path1.current = '';
        node1.current = null;
        setContextMenus(null);
      }}>
        {/* 因为 ProjectFileTree 会是 100% 高度, 所以需要在它外面包一层 div, 并且高度是 100% 去掉上面的 header div 的高度 */}
        <Dropdown menu={{items: contextMenuItems, onClick: (e) => {
            e.domEvent.stopPropagation();
            onClickMenu(e);
        }}} trigger={['contextMenu']}>
          <DirectoryTree ref={filetree} treeData={folderFiles} switcherIcon={null} className={['no-switcher',customTheme.className]}
            expandAction={isTabletOrPhone?"click":"doubleClick"}
            selectedKeys={selectedKeys}
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
    </>
  )
}
