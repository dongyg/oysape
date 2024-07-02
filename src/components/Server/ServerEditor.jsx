import React, { useState, useEffect, useCallback } from 'react'
import { App, Button, Form, Input, InputNumber, AutoComplete, Tag, Typography } from 'antd';

import { useCustomContext } from '../Contexts/CustomContext'
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'
import { callApi, getUniqueKey, getCredentials } from '../Common/global';
import TagsComponent from '../Modules/TagsComponent';

import './ServerEditor.css';

export default function ServerEditor(props) {
  const { message } = App.useApp();
  const { customTheme, tabActiveKey, tabItems, setTabItems, setFooterStatusText, userSession, setUserSession, hideSidebar } = useCustomContext();
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
  const [saving, setSaving] = useState(false);

  // tasks
  const onClickTask = (idxTask) => {
    setIndexEditTaskIndex(idxTask);
  }
  const onChangeTask = useCallback((idxTask, value) => {
    const newItems = [...tasks];
    newItems[idxTask] = value;
    setTasks(newItems);
    setIndexEditTaskIndex(-1);
  }, [tasks]);
  const onCloseTask = useCallback((idxTask) => {
    const newItems = [...tasks];
    newItems.splice(idxTask, 1);
    setTasks(newItems);
  }, [tasks]);

  // form
  const onFinish = (values) => {
    const port = values.port||22;
    const newobj = {
      oldkey: serverKey.current, key: values.name, name: values.name, tags: tags||undefined,
      address: values.address, username: values.username||undefined, port: port===22?undefined:port,
      prikey: values.prikey||undefined, passphrase: values.passphrase||undefined, password: values.password||undefined, tasks: tasks||undefined,
    }
    saveServer(newobj);
  }
  const onFinishFailed = (errorInfo) => {
  }
  const onValuesChange = (changedFields, allFields) => {
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
    setSaving(true);
    callApi('addServer', {serverObject: newobj, credentials: getCredentials()}).then((data) => {
      setSaving(false);
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
      if(tabItems.find((item) => item.key === uniqueKey && item.hasSomethingNew)) form.submit();
      if(window.fillSearchServer) window.fillSearchServer(form.getFieldValue('name'));
    }
  }
  const filterOption = (input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase());

  // init form
  useEffect(() => {
    const serverObj = (userSession.servers||[]).find((item) => item.key === serverKey.current)||{};
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
        labelCol={hideSidebar ? { xs:24, sm:6, md:5, lg:4, xl:3, xxl:2 } : {xs:24, sm:24, md:24, lg:6, xl:5, xxl:3}}
        wrapperCol={hideSidebar ? { xs:24, sm:18, md:19, lg:20, xl:21, xxl:22 } : {xs:24, sm:24, md:24, lg:18, xl:19, xxl:21}}
        style={{ paddingLeft: '20px', paddingRight: '20px', maxWidth: '100%' }}
        initialValues={{ }}
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
        onValuesChange={onValuesChange}
        autoComplete="off"
      >
        <Form.Item label="Server Name" name="name" rules={[{required: true, message: 'Please input server name!',},]} tooltip="Give a unique name">
          <Input placeholder='Server Name' autoCapitalize='off' autoComplete='off' autoCorrect='off' autoFocus={true} />
        </Form.Item>
        <Form.Item label="Hostname" name="address" rules={[{required: true, message: 'Please input hostname!',},]} tooltip="The hostname or IP address">
          <Input placeholder='Hostname (IP Address)' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
        </Form.Item>
        <Form.Item label="Port" name="port" tooltip="The port number ( default: 22 )">
          <InputNumber min={1} max={65535} placeholder='22' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
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
        <Form.Item label="Credential">
          <Typography.Text className="ant-form-text" type="secondary" style={{ marginTop: '5px' }}>
            Login credentials are independent of server configurations and are not stored within the server settings. Instead, they are user-specific and managed in [My Credentials]. You can specify a login credential to be used on a particular server. The credentials are only stored on the current device and are never uploaded or stored outside of your device at any time.
          </Typography.Text>
        </Form.Item>
        <Form.Item label=" " colon={false}>
          <Button type="primary" htmlType="submit" loading={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          <Button onClick={onRunIt}>Run it</Button>
        </Form.Item>
      </Form>
    </div>
  )
}
