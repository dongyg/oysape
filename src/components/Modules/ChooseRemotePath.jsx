import React, { useEffect, useState, useCallback } from 'react';
import { App, Modal, Select, AutoComplete, Input, Button } from 'antd';
import { FolderOutlined, FileOutlined, LoadingOutlined } from '@ant-design/icons';
import { useCustomContext } from '../Contexts/CustomContext';
import { callApi } from '../Common/global';

export default function ChooseRemotePath(props) {
  const { visible, serverKey, serverVisible, chooseType, onOk, onCancel } = props;
  const { message } = App.useApp();
  const { userSession } = useCustomContext();

  const [server, setServer] = useState(serverKey);
  const [currentPath, setCurrentPath] = useState('');
  const [lastPath, setLastPath] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState([]);

  const refreshPathList = useCallback((items, value) => {
    let newOptions = items.map((item) => ( (( chooseType === 'folder' && !item.isLeaf) || (chooseType === 'file' && item.isLeaf) || (chooseType === 'all')) && (value && item.path.startsWith(value)) ? {
      value: item.path,
      label: (
        <>
          {item.isLeaf ? <FileOutlined /> : <FolderOutlined />}
          <span style={{ marginLeft: 8 }}>{item.title}</span>
        </>
      ),
    } : null)).filter(x => x !== null);
    setOptions(newOptions);
  }, [chooseType]);

  const fetchPathChildren = useCallback((thisPath) => {
    setLoading(true);
    callApi('sftpGetFileTree', {target: server, path: thisPath}).then((resp) => {
      if(resp && resp.errinfo) {
        message.error(resp.errinfo);
      }else if(resp && resp.fileList) {
        setFileList(resp.fileList);
        refreshPathList(resp.fileList, currentPath);
      }
    }).catch((error) => {
      message.error('Get remote path error: ' + error.message);
    }).finally(() => {
      setLoading(false);
    });
  }, [server, message, refreshPathList, currentPath]);

  useEffect(() => {
    if (currentPath.endsWith('/') && lastPath.length < currentPath.length) {
      fetchPathChildren(currentPath);
    } else {
      refreshPathList(fileList, currentPath);
    }
  }, [lastPath, currentPath, fetchPathChildren, refreshPathList]);

  const handleServerChange = (value) => {
    setServer(value);
    setCurrentPath(''); // Reset path when server changes
    setOptions([]);
  };

  const handlePathChange = (value) => {
    if (!value.endsWith('/')) {
      refreshPathList(fileList, value);
    }
    setLastPath(currentPath);
    setCurrentPath(value);
  };

  return (
    <Modal
      title="Choose Remote Path"
      open={visible}
      onCancel={onCancel}
      onOk={() => onOk({ server, currentPath })}
      footer={[
        <Button key="cancel" onClick={onCancel}>Cancel</Button>,
        <Button key="ok" type="primary" onClick={() => onOk({ server, currentPath })} disabled={loading}>
          {loading ? <><LoadingOutlined /> </> : ''}Ok
        </Button>,
      ]}
    >
      {serverVisible === 'visible' && (
        <Select
          value={server}
          onChange={handleServerChange}
          disabled={serverVisible === 'disable'}
          placeholder="Choose a server"
          style={{ width: '100%', marginBottom: 16 }}
        >
          {userSession.servers.map((srv) => (
            <Select.Option key={srv.key} value={srv.key}>
              {srv.name}
            </Select.Option>
          ))}
        </Select>
      )}

      <AutoComplete
        value={currentPath}
        onChange={handlePathChange}
        options={options}
        defaultActiveFirstOption={true}
        style={{ width: '100%' }}
        placeholder="Enter path (e.g. /home/)"
      >
        <Input />
      </AutoComplete>
    </Modal>
  );
}
