import React, {useCallback} from 'react'
import { App, Tree, Dropdown } from 'antd';
import { DownOutlined, QuestionCircleFilled } from '@ant-design/icons';

import { useCustomContext } from '../Contexts/CustomContext'

import './ProjectFileTree.css';
import { callApi } from '../Common/global';

const { DirectoryTree } = Tree; // 把 Tree 赋值给 DirectoryTree, 然后使用 DirectoryTree 就是出现整行选中效果, 否则就不出现整行选中效果

export default function ProjectFileTree() {
  const { message, modal } = App.useApp();
  const { hideSidebarIfNeed, customTheme, folderFiles, setFolderFiles } = useCustomContext();
  const [contextMenuItems, setContextMenuItems] = React.useState([]);
  const filetree = React.useRef(null);
  const time1 = React.useRef(0);
  const path1 = React.useRef('');
  const node1 = React.useRef(null);
  const miDivider = {type: 'divider', }
  // const miCollapse = {label: 'Collapse', key: 'tree_menu_collapse', }
  // const miExpand = {label: 'Expand', key: 'tree_menu_expand', }
  const miOpenfile = {label: 'Open', key: 'tree_menu_openfile', }
  const miCopyPath = {label: 'Copy Name', key: 'tree_menu_copy_name', }
  const miCopyAbsolutePath = {label: 'Copy Path', key: 'tree_menu_copy_path', }
  const miRemoveFromWorkspace = {label: 'Remove from workspace', key: 'tree_menu_remove_from_workspace', }
  const miAddToExclude = {label: 'Add to exclude', key: 'tree_menu_add_to_exclude', }
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
    }else if(key === 'tree_menu_remove_from_workspace') {
      modal.confirm({
        title: node1.current.path,
        icon: <QuestionCircleFilled />,
        content: 'Will be removed from the workspace.',
        onOk() {
          callApi('removeFolder', {path: node1.current.path}).then((data) => {
            if(data && data.errinfo) {
              message.error(data.errinfo);
            }else if(data && data.folderFiles) {
              setFolderFiles(data.folderFiles);
            }
          })
        },
        onCancel() {
          console.log('Cancel');
        },
      });
    }else if(key === 'tree_menu_add_to_exclude') {
      modal.confirm({
        title: 'This will be added to the exclude list',
        icon: <QuestionCircleFilled />,
        content: node1.current.path,
        onOk() {
          callApi('addExcludeToFolder', {path: node1.current.path}).then((data) => {
            if(data && data.errinfo) {
              message.error(data.errinfo);
            }else if(data && data.folderFiles) {
              setFolderFiles(data.folderFiles);
            }
          })
        },
        onCancel() {
          console.log('Cancel');
        },
      });
    }
  }

  const handleDoubleClick = (anode) => {
    if(window.openProjectFile) {
      window.openProjectFile(anode.path, anode.title);
      hideSidebarIfNeed();
    }
  }

  const reloadFolderFiles = useCallback(() => {
    callApi('getFolderFiles', {refresh: true}).then((data) => {
      console.log('getFolderFiles', data)
      setFolderFiles(data);
    });
  }, [setFolderFiles]);
  window.reloadFolderFiles = reloadFolderFiles;

  return (
    <Dropdown menu={{items: contextMenuItems, onClick: onClickMenu}} trigger={['contextMenu']}>
      <DirectoryTree ref={filetree} treeData={folderFiles} switcherIcon={<DownOutlined />} className={customTheme.className}
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
          if(!event.node.isLeaf) {
            var items = [miCopyPath, miCopyAbsolutePath];
            // items.push(miDivider, event.node.expanded ? miCollapse : miExpand);
            items.push(miDivider, event.node.root ? miRemoveFromWorkspace : miAddToExclude);
            setContextMenuItems(items);
          }else{
            setContextMenuItems([miCopyPath, miCopyAbsolutePath, miDivider, miOpenfile, miDivider, miAddToExclude]);
          }
        }}
      />
    </Dropdown>
  )
}
