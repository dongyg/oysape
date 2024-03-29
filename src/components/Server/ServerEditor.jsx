import React, { useState, useEffect, useCallback } from 'react'
import { App, Button, Form, Input, InputNumber, AutoComplete, Tag } from 'antd';
import { FolderOpenOutlined } from "@ant-design/icons";

import { useCustomContext } from '../Contexts/CustomContext'
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'
import { callApi, getUniqueKey } from '../Common/global';
import TagsComponent from '../Modules/TagsComponent';

import './ServerEditor.css';

export default function ServerEditor(props) {
  const { message } = App.useApp();
  const { customTheme, tabActiveKey, tabItems, setTabItems, setFooterStatusText, userSession, setUserSession } = useCustomContext();
  const serverKey = React.useRef(props.serverKey)
  const uniqueKey = props.uniqueKey;
  // tags
  const [tags, setTags] = useState([]);
  // form
  const [form] = Form.useForm();
  // tasks
  const [tasks, setTasks] = useState([]);
  const [indexEditTaskIndex, setIndexEditTaskIndex] = useState(-1);
  // form validation
  const [passStatus, setPassStatus] = useState('success');
  const [passHint, setPassHint] = useState('');

  // tasks
  const onClickTask = (idxTask) => {
    console.log('onClickTask', idxTask);
    setIndexEditTaskIndex(idxTask);
  }
  const onChangeTask = useCallback((idxTask, value) => {
    console.log('onChangeTask', idxTask, value);
    const newItems = [...tasks];
    newItems[idxTask] = value;
    setTasks(newItems);
    setIndexEditTaskIndex(-1);
  }, [tasks]);
  const onCloseTask = useCallback((idxTask) => {
    console.log('onCloseTask', tasks);
    const newItems = [...tasks];
    newItems.splice(idxTask, 1);
    setTasks(newItems);
    console.log('onCloseTask', newItems);
  }, [tasks]);

  // form
  const checkAuthFields = (values) => {
    if(true || values.prikey || values.password) {
      // No Private key and password is allowed. The application will try to use ~/.ssh/id_rsa, ~/.ssh/id_ecdsa, ~/.ssh/id_dsa, and ~/.ssh/id_ed25519
      setPassStatus('success');
      setPassHint('');
      return true;
    } else {
      setPassStatus('error');
      setPassHint('Please input private key or password!');
      return false;
    }
  }
  const onFinish = (values) => {
    if(!checkAuthFields(values)) return;
    const port = values.port||22;
    const newobj = {
      oldkey: serverKey.current, key: values.name, name: values.name, tags: tags||undefined,
      address: values.address, username: values.username||undefined, port: port===22?undefined:port,
      prikey: values.prikey||undefined, passphrase: values.passphrase||undefined, password: values.password||undefined, tasks: tasks||undefined,
    }
    saveServer(newobj);
  }
  const onFinishFailed = (errorInfo) => {
    checkAuthFields(errorInfo.values);
  }
  const openFile = (e) => {
    callApi('choose_file_read').then((data) => {
      if(data) {
        form.setFieldsValue({prikey: data});
      }
    })
  }
  const onValuesChange = (changedFields, allFields) => {
    if('prikey' in changedFields || 'password' in changedFields) {
      checkAuthFields(allFields);
    }
    var hasSomethingNew = false;
    const newItems = tabItems.map((item) => {
      if(item.key === uniqueKey && item.label.indexOf('* ') !== 0) {
        hasSomethingNew = true;
        item.hasSomethingNew = true;
        item.label = (item.label.indexOf('* ') === 0 ? '' : '* ') + item.label;
      }
      return item;
    });
    if(hasSomethingNew) setTabItems(newItems);
  }
  const saveServer = (newobj) => {
    callApi('addServer', newobj).then((data) => {
      if(data && data.errinfo) {
        message.error(data.errinfo);
      }else if(data && data.servers) {
        serverKey.current = newobj.key;
        setUserSession({...userSession, servers: data.servers});
        const newItems = tabItems.map((item) => {
          if(item.key === uniqueKey) {
            item.hasSomethingNew = false;
            item.label = newobj.name;
          }
          return item;
        });
        setTabItems(newItems);
        message.success('Server ['+form.getFieldValue('name')+'] saved');
        setFooterStatusText('Server ['+form.getFieldValue('name')+'] saved');
      }
    })
  }
  const onRunIt = () => {
    if(form.getFieldValue('name')) {
      if(tabItems.filter((item) => item.key === uniqueKey && item.hasSomethingNew).length > 0) form.submit();
      if(window.fillSearchServer) window.fillSearchServer(form.getFieldValue('name'));
    }
  }
  const filterOption = (input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase());

  // init form
  useEffect(() => {
    const serverObj = (userSession.servers||[]).filter((item) => item.key === serverKey.current)[0]||{};
    setTags(serverObj.tags||[]);
    setTasks(serverObj.tasks||[]);
    form.setFieldsValue(serverObj);
  }, [form, serverKey, userSession]);

  // shortcuts
  useKeyPress(keyMapping["shortcutSave"], (event) => {
    if(tabActiveKey === uniqueKey) form.submit();
    event.preventDefault(); return;
  });

  return (
    <div className={customTheme.className+' withScrollContent'} style={{ backgroundColor: customTheme.colors["editor.background"], color: customTheme.colors["editor.foreground"], height: '100%', padding: '24px', overflowY: 'auto', overflowX: 'hidden', }}>
      <Form
        name={uniqueKey}
        form={form}
        labelCol={{ span: 6, }}
        wrapperCol={{ span: 18, }}
        style={{ maxWidth: 800, }}
        initialValues={{ }}
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
        onValuesChange={onValuesChange}
        autoComplete="off"
      >
        <Form.Item label="Server Name" name="name" rules={[{required: true, message: 'Please input server name!',},]} tooltip="Give a unique name">
          <Input placeholder='Server Name' autoCapitalize='off' autoComplete='off' autoCorrect='off' autoFocus={true} />
        </Form.Item>
        <Form.Item label="Username" name="username" tooltip="The OS username will be used if not specified">
          <Input placeholder='Username' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
        </Form.Item>
        <Form.Item label="Hostname" name="address" rules={[{required: true, message: 'Please input hostname!',},]} tooltip="The hostname or IP address">
          <Input placeholder='Hostname (IP Address)' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
        </Form.Item>
        <Form.Item label="Port" name="port" tooltip="The port number ( default: 22 )">
          <InputNumber min={1} max={65535} placeholder='22' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
        </Form.Item>
        <Form.Item label="Password" name="password" validateStatus={passStatus} help={passHint} tooltip="Use the password to log in">
          <Input placeholder='Password' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
        </Form.Item>
        <Form.Item label="Private Key" name="prikey" validateStatus={passStatus} help={passHint} tooltip="Give the private key file. It can start with ~/. If it is not given, password will be used, or the default ssh private key will be used.">
          <Input placeholder='Private Key' autoCapitalize='off' autoComplete='off' autoCorrect='off' addonAfter={<Button type="text" onClick={openFile} icon={<FolderOpenOutlined />} style={{ height: "30px", borderTopLeftRadius: "0px", borderBottomLeftRadius: "0px" }}></Button>} />
        </Form.Item>
        <Form.Item label="Passphrase" name="passphrase" tooltip="The passphrase for the private key">
          <Input placeholder='Passphrase' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
        </Form.Item>
        <Form.Item label="Tags" name="tags">
          <TagsComponent tags={tags} onChange={setTags} backgroundColor={customTheme.colors["editor.background"]} />
        </Form.Item>
        <Form.Item label="Startup tasks" name="tasks" tooltip="The tasks to run when you connect to the server">
          {(tasks||[]).concat('').map((task, idxTask) => {
            return indexEditTaskIndex === idxTask ? (
              // <Select size='small' defaultValue={task} defaultOpen={true} style={{marginLeft: "3px"}}
                // options={userSession.tasks.map((item) => {return {value: item.name, label: item.name}})}
              <AutoComplete autoFocus={true} popupMatchSelectWidth={'100%'} defaultActiveFirstOption={true} open={true} style={{marginLeft: "3px"}} size='small'
                options={userSession.tasks.map((item) => {return {value: item.name, label: item.name}})} filterOption={filterOption}
                onSelect={(value) => onChangeTask(idxTask, value)} onBlur={() => {setIndexEditTaskIndex(-1);}}>
                <Input placeholder="Select a Task" size='small' autoComplete='off' autoCapitalize='off' autoCorrect='off' spellCheck='false' />
              </AutoComplete>
            ) : (
              <Tag key={getUniqueKey()} closable={!!task} style={{ userSelect: 'none', }} onClose={() => onCloseTask(idxTask)} onClick={() => onClickTask(idxTask)}>
                {task||'+'}
              </Tag>
            )
          })}
        </Form.Item>
        <Form.Item wrapperCol={{ offset: 6, span: 18, }}>
          <Button type="primary" htmlType="submit">Save</Button>
          <Button onClick={onRunIt}>Run it</Button>
        </Form.Item>
      </Form>
    </div>
  )
}
