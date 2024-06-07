import React, { useEffect, useState } from 'react'
import { App, Button, Form, Input, Radio, Alert } from 'antd';
import CodeMirror from '@uiw/react-codemirror'
import { solarizedLight, solarizedDark } from '@uiw/codemirror-theme-solarized';
import { loadLanguage } from '@uiw/codemirror-extensions-langs';

import { useCustomContext } from '../Contexts/CustomContext'
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'
import { callApi } from '../Common/global';
import TagsComponent from '../Modules/TagsComponent';

// import '../Modules/CodeEditor.css';
import './TaskEditor.css';

export default function TaskEditor(props) {
  const { message } = App.useApp();
  const { customTheme, tabActiveKey, tabItems, setTabItems, setFooterStatusText, userSession, setUserSession, hideSidebar } = useCustomContext();
  const [isFileTransfer, setIsFileTransfer] = useState(false);
  const taskKey = React.useRef(props.taskKey);
  const uniqueKey = props.uniqueKey;
  // tags
  const [tags, setTags] = useState([]);
  // form
  const [form] = Form.useForm();
  // codemirror
  const [codeValue, setCodeValue] = useState('');
  const [saving, setSaving] = useState(false);

  // tags
  const handleTagChange = (newTags) => {
    setTags(newTags);
  }

  // codemirror
  const onCodeChange = React.useCallback((val, viewUpdate) => {
    setCodeValue(val)
  }, [])

  // form
  const checkRequiredFields = (values) => {
    return true;
  }
  const onInteractionChange = React.useCallback(() => {
    const interaction = form.getFieldValue('interaction');
    setIsFileTransfer(['upload', 'download'].includes(interaction));
  }, [form]);
  const onFinish = (values) => {
    if(!checkRequiredFields(values)) return;
    const newobj = {
      oldkey: taskKey.current, key: values.name, name: values.name, tags: tags||undefined,
      interaction: (values.interaction==='none'?'':values.interaction)||undefined,
      cmds: !isFileTransfer?values.cmdText.split('\n'):undefined, runmode: !isFileTransfer?values.runmode||undefined:undefined,
      source: isFileTransfer?values.source||undefined:undefined, destination: isFileTransfer?values.destination||undefined:undefined, excludes: isFileTransfer?values.excludes||undefined:undefined,
    }
    saveTask(newobj);
  }
  const onSaveAsNew = () => {
    const values = form.getFieldsValue();
    if(!checkRequiredFields(values)) return;
    const newobj = {
      oldkey: values.name, key: values.name, name: values.name, tags: tags||undefined,
      interaction: (values.interaction==='none'?'':values.interaction)||undefined,
      cmds: !isFileTransfer?values.cmdText.split('\n'):undefined, runmode: !isFileTransfer?values.runmode||undefined:undefined,
      source: isFileTransfer?values.source||undefined:undefined, destination: isFileTransfer?values.destination||undefined:undefined, excludes: isFileTransfer?values.excludes||undefined:undefined,
    }
    saveTask(newobj);
  }
  const onFinishFailed = (errorInfo) => {
    checkRequiredFields(errorInfo.values);
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
  const saveTask = (newobj) => {
    setSaving(true);
    callApi('addTask', newobj).then((data) => {
      setSaving(false);
      if(data && data.errinfo) {
        message.error(data.errinfo);
      }else if(data) {
        if(data.tasks) {
          taskKey.current = newobj.key;
          setUserSession({...userSession, tasks: data.tasks});
          const newItems = tabItems.map((item) => {
            if(item.key === uniqueKey) {
              item.hasSomethingNew = false;
              item.label = newobj.name;
            }
            return item;
          });
          setTabItems(newItems);
          message.success('Task ['+form.getFieldValue('name')+'] saved');
          setFooterStatusText('Task ['+form.getFieldValue('name')+'] saved');
        }
        if(data.pipelines) {
          setUserSession({...userSession, pipelines: data.pipelines});
        }
      }
    })
  }
  const onRunIt = () => {
    if(form.getFieldValue('name')) {
      if(tabItems.find((item) => item.key === uniqueKey && item.hasSomethingNew)) form.submit();
      if(window.fillSearchTask) window.fillSearchTask(form.getFieldValue('name'));
    }
  }

  // init form
  useEffect(() => {
    const taskObj = (userSession.tasks||[]).find((item) => item.key === taskKey.current)||{};
    taskObj.cmdText = (taskObj.cmds||[]).join('\n');
    setTags(taskObj.tags||[]);
    form.setFieldsValue(taskObj);
    onInteractionChange();
  }, [form, taskKey, onInteractionChange, userSession]);

  // shortcuts
  useKeyPress(keyMapping["shortcutSave"], (event) => {
    if(tabActiveKey === uniqueKey) form.submit();
    event.preventDefault(); return;
  });
  useKeyPress(keyMapping["shortcutRun"], (event) => {
    if(tabActiveKey === uniqueKey) onRunIt();
    event.preventDefault(); return;
  });

  return (
    <div className={customTheme.className+' withScrollContent'} style={{ backgroundColor: customTheme.colors["editor.background"], color: customTheme.colors["editor.foreground"], height: '100%', paddingTop: '24px', overflow: 'auto' }}>
      <Form
        name={uniqueKey}
        form={form}
        labelCol={hideSidebar ? { xs:24, sm:6, md:5, lg:4, xl:3, xxl:2 } : {xs:24, sm:24, md:24, lg:6, xl:5, xxl:3}}
        wrapperCol={hideSidebar ? { xs:24, sm:18, md:19, lg:20, xl:21, xxl:22 } : {xs:24, sm:24, md:24, lg:18, xl:19, xxl:21}}
        style={{ paddingLeft: '20px', paddingRight: '20px', maxWidth: '100%' }}
        initialValues={{ interaction: 'none', runmode: 'byline', }}
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
        onValuesChange={onValuesChange}
        autoComplete="off"
      >
        <Form.Item label="Task Name" name="name" rules={[{required: true, message: 'Please input task name!',},]} tooltip="Give a unique name">
          <Input placeholder='Task Name' autoCapitalize='off' autoComplete='off' autoCorrect='off' autoFocus={true} />
        </Form.Item>
        <Form.Item label="Interaction" name="interaction" tooltip={<div>
            <strong>terminal</strong>: A new terminal tab will be opened which can accept user input.<br/><br/>
            <strong>interactive</strong>: All output will be printed in Workspace. User interaction is allowed.<br/><br/>
            <strong>none</strong>: All output will be printed in Workspace. No user interaction is allowed.<br/><br/>
            <Alert message="If the command needs user interaction and the interaction was given 'none', the command will be stuck. You will be not able to stop the command, and the task will be blocked." type="warning" /><br/>
            <strong>upload</strong>: Upload a local file/directory to remote server.<br/><br/>
            <strong>download</strong>: Download a remote file/directory to local.<br/>
          </div>}>
          <Radio.Group onChange={onInteractionChange}>
            <Radio value={'terminal'}>terminal</Radio>
            <Radio value={'interactive'}>interactive</Radio>
            <Radio value={'none'}>none</Radio>
            <Radio value={'upload'}>upload</Radio>
            <Radio value={'download'}>download</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item hidden={!isFileTransfer} label="Source" name="source" rules={isFileTransfer?[{required: true, message: 'Please give a source file/folder!',}]:null} tooltip={<>It can start with ~/. Otherwise must be an absolute path. eg: /path/to/file<br/><br/>Could be a file or folder. If it is a folder, all files in the folder will be transferred except the Excludes ones. If it is a file, the Destination must be a file.</>}>
          <Input placeholder='' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
        </Form.Item>
        <Form.Item hidden={!isFileTransfer} label="Destination" name="destination" rules={isFileTransfer?[{required: true, message: 'Please give a destination!',},]:null} tooltip={<>It can start with ~/. Otherwise must be an absolute path. eg: /path/to/file</>}>
          <Input placeholder='' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
        </Form.Item>
        <Form.Item hidden={!isFileTransfer} label="Excludes" name="excludes">
          <Input placeholder='Give the files/folders to be excluded. eg: .git .DS_Store' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
        </Form.Item>
        <Form.Item hidden={isFileTransfer} label="Commands" name="cmdText" rules={!isFileTransfer?[{required: true, message: 'Please input commands!',},]:null}>
          <CodeMirror className='codeCmd withScrollContent'
            theme={customTheme.isDark?solarizedDark:solarizedLight}
            basicSetup={{highlightActiveLine:false}}
            value={codeValue}
            extensions={[loadLanguage('shell')]}
            onChange={onCodeChange}
            onStatistics={(data)=>{
              // console.log(data)
            }}
          />
        </Form.Item>
        <Form.Item hidden={isFileTransfer} label="Run mode" name="runmode" tooltip={<div><strong>line-by-line</strong>: The commands will be executed line-by-line.<br/><br/><strong>batch-join</strong>: The commands will be joined with '&&' for example in Linux, then executed.<br/><br/><strong>batch-escape</strong>: The commands will be executed as a batch.<br/><br/><strong>script</strong>: The commands will be executed as a script file.</div>}>
          <Radio.Group>
            <Radio value={'byline'}>line-by-line</Radio>
            <Radio value={'batch-join'}>batch:join</Radio>
            <Radio value={'batch-escape'}>batch:escape</Radio>
            <Radio value={'script'}>script</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="Tags" name="tags">
          <TagsComponent tags={tags} onChange={handleTagChange} backgroundColor={customTheme.colors["editor.background"]} />
        </Form.Item>
        <Form.Item label=" " colon={false}>
          <Button type="primary" htmlType="submit" loading={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          <Button onClick={onSaveAsNew}>Save as New</Button>
          <Button onClick={onRunIt}>Run it</Button>
        </Form.Item>
      </Form>
    </div>
  )
}
