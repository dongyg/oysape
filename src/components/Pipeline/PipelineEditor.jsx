import React, { useState, useEffect } from 'react'
import { App, Button, Form, Input } from 'antd';

import { useCustomContext } from '../Contexts/CustomContext'
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'
import { callApi } from '../Common/global';
import TagsComponent from '../Modules/TagsComponent';
import StepsComponent from '../Modules/StepsComponent';

import './PipelineEditor.css';

export default function PipelineEditor(props) {
  const { message } = App.useApp();
  const { customTheme, tabActiveKey, tabItems, setTabItems, setFooterStatusText, userSession, setUserSession, hideSidebar } = useCustomContext();
  const pipelineKey = React.useRef(props.pipelineKey)
  const uniqueKey = props.uniqueKey;
  // tags
  const [tags, setTags] = useState([]);
  // steps
  const [steps, setSteps] = useState([]);
  // form
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // form
  const checkRequiredFields = (values) => {
    return true;
  }
  const onFinish = (values) => {
    if(!checkRequiredFields(values)) return;
    const newobj = {
      oldkey: pipelineKey.current, key: values.name, name: values.name, tags: tags||undefined, steps: (steps||[]).filter((item) => item.target && item.tasks && item.tasks.length > 0),
    }
    savePipeline(newobj);
  }
  const onSaveAsNew = () => {
    const values = form.getFieldsValue();
    if(!checkRequiredFields(values)) return;
    const newobj = {
      oldkey: values.name, key: values.name, name: values.name, tags: tags||undefined, steps: (steps||[]).filter((item) => item.target && item.tasks && item.tasks.length > 0),
    }
    savePipeline(newobj);
  }
  const onFinishFailed = (errorInfo) => {
    checkRequiredFields(errorInfo.values);
  }
  const onValuesChange = (changedFields, allFields) => {
    const newItems = tabItems.map((item) => {
      if(item.key === uniqueKey) {
        item.hasSomethingNew = true;
        item.label = (item.label.indexOf('* ') === 0 ? '' : '* ') + item.label;
      }
      return item;
    });
    setTabItems(newItems);
  }
  const savePipeline = (newobj) => {
    setSaving(true);
    callApi('addPipeline', newobj).then((data) => {
      setSaving(false);
      if(data && data.errinfo) {
        message.error(data.errinfo);
      }else if(data && data.pipelines) {
        pipelineKey.current = newobj.key;
        setUserSession({...userSession, pipelines: data.pipelines});
        const newItems = tabItems.map((item) => {
          if(item.key === uniqueKey) {
            item.hasSomethingNew = false;
            item.label = newobj.name;
          }
          return item;
        });
        setTabItems(newItems);
        message.success('Pipeline ['+form.getFieldValue('name')+'] saved');
        setFooterStatusText('Pipeline ['+form.getFieldValue('name')+'] saved');
      }
    })
  }
  const onRunIt = () => {
    if(form.getFieldValue('name')) {
      if(tabItems.find((item) => item.key === uniqueKey && item.hasSomethingNew)) form.submit();
      if(window.fillSearchPipeline) window.fillSearchPipeline(form.getFieldValue('name'));
    }
  }

  // init form
  useEffect(() => {
    const pipelineObj = (userSession.pipelines||[]).find((item) => item.key === pipelineKey.current)||{};
    setTags(pipelineObj.tags||[]);
    setSteps(JSON.parse(JSON.stringify(pipelineObj.steps||[])));
    form.setFieldsValue(pipelineObj);
  }, [form, userSession]);

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
        labelCol={hideSidebar ? { xs:24, sm:6, md:5, lg:4, xl:3, xxl:2 } : {xs:24, sm:24, md:24, lg:7, xl:5, xxl:4}}
        wrapperCol={hideSidebar ? { xs:24, sm:18, md:19, lg:20, xl:21, xxl:22 } : {xs:24, sm:24, md:24, lg:17, xl:19, xxl:20}}
        style={{ paddingLeft: '20px', paddingRight: '20px', maxWidth: '100%' }}
        initialValues={{ port: 22, }}
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
        onValuesChange={onValuesChange}
        autoComplete="off"
      >
        <Form.Item label="Pipeline Name" name="name" rules={[{required: true, message: 'Please input pipeline name!',},]} tooltip="Give a unique name">
          <Input placeholder='Pipeline Name' autoCapitalize='off' autoComplete='off' autoCorrect='off' autoFocus={true} />
        </Form.Item>
        <Form.Item label="Tags" name="tags">
          <TagsComponent tags={tags} onChange={setTags} backgroundColor={customTheme.colors["editor.background"]} />
        </Form.Item>
        <Form.Item label="Steps" name="steps" tooltip="All steps will be run in serial">
          <StepsComponent steps={steps} onChange={setSteps} />
        </Form.Item>
        <Form.Item label=" " colon={false}>
          <Button type="primary" htmlType="submit" loading={saving}>{saving ? 'Saving...' : 'Save'}</Button>&nbsp;
          <Button onClick={onSaveAsNew}>Save as New</Button>&nbsp;
          <Button onClick={onRunIt}>Run it</Button>
        </Form.Item>
      </Form>
    </div>
  )
}
