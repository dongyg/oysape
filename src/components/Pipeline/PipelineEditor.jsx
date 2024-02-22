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
  const { customTheme, tabActiveKey, pipelineItems, setPipelineItems, tabItems, setTabItems, setFooterStatusText } = useCustomContext();
  const pipelineKey = React.useRef(props.pipelineKey)
  const uniqueKey = props.uniqueKey;
  // tags
  const [tags, setTags] = useState([]);
  // steps
  const [steps, setSteps] = useState([]);
  // form
  const [form] = Form.useForm();

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
    callApi('addPipeline', newobj).then((data) => {
      if(data && data.errinfo) {
        message.error(data.errinfo);
      }else if(data && data.pipelines) {
        pipelineKey.current = newobj.key;
        setPipelineItems(data.pipelines);
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
      if(tabItems.filter((item) => item.key === uniqueKey && item.hasSomethingNew).length > 0) form.submit();
      if(window.fillSearchPipeline) window.fillSearchPipeline(form.getFieldValue('name'));
    }
  }

  // init form
  useEffect(() => {
    const pipelineObj = (pipelineItems||[]).filter((item) => item.key === pipelineKey.current)[0]||{};
    setTags(pipelineObj.tags||[]);
    setSteps(JSON.parse(JSON.stringify(pipelineObj.steps||[])));
    form.setFieldsValue(pipelineObj);
  }, [form, pipelineKey, pipelineItems]);

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
        labelCol={{ span: 6, }}
        wrapperCol={{ span: 18, }}
        style={{ maxWidth: 800, }}
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
        <Form.Item wrapperCol={{ offset: 6, span: 18, }}>
          <Button type="primary" htmlType="submit">Save</Button>
          <Button onClick={onSaveAsNew}>Save as New</Button>
          <Button onClick={onRunIt}>Run it</Button>
        </Form.Item>
      </Form>
    </div>
  )
}
