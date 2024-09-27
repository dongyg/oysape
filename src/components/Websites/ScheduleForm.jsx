import React, { useImperativeHandle, forwardRef, useRef, useState } from 'react';
import { App, Form, Input, DatePicker, Radio, Row, Col, AutoComplete, Tag, Select } from 'antd';
import dayjs from 'dayjs';

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, getShowTitle, getUniqueKey } from '../Common/global';

const ScheduleForm = (props, ref) => {
  const { message } = App.useApp();
  const { userSession, setUserSession } = useCustomContext();
  const [scheduleFormRef] = Form.useForm();
  const [ oldKey, setOldKey ] = React.useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [options, setOptions] = useState([]);
  const actionInput = useRef(null);
  const searchMode = useRef(''); // '' | '@' | ':' | '!'
  const indexServerSign = '@';
  const indexTaskSign = ':';
  const indexPipelineSign = '!';
  const indexAllSigns = [indexServerSign, indexTaskSign, indexPipelineSign];

  const onSelect = (value, options) => {
    // console.log('onSelect', value, options);
    var lastMode = searchMode.current;
    if(lastMode === indexTaskSign) { // For task
      setTimeout(() => {
        if(actionInput.current.input.value.indexOf(indexServerSign)>=0) {
          setSearchValue(actionInput.current.input.value.split(lastMode)[0]+lastMode+value);
          searchMode.current = '';
        }else{
          setSearchValue(actionInput.current.input.value.split(lastMode)[0]+lastMode+value+' '+indexServerSign);
          searchMode.current = indexServerSign;
        }
        handleSearch(searchMode.current);
      }, 5)
    } else if (lastMode === indexServerSign) { // For server
      setTimeout(() => {
        setSearchValue(actionInput.current.input.value.split(lastMode)[0]+lastMode+value);
        searchMode.current = '';
        handleSearch(searchMode.current);
      }, 5)
    } else if (lastMode === indexPipelineSign) {
      setTimeout(() => {
        setSearchValue(actionInput.current.input.value.split(lastMode)[0]+lastMode+value);
        searchMode.current = '';
        handleSearch(searchMode.current);
      }, 5)
    } else {
      setTimeout(() => {
        if(value&&[indexTaskSign].includes(value[0])) {
          setSearchValue(value+' '+indexServerSign);
          searchMode.current = indexServerSign;
        } else {
          setSearchValue(value);
        }
        handleSearch(searchMode.current);
      }, 5)
    }
  };
  const onChange = (e) => {
    // console.log('onChange', actionInput.current.input.value);
    setSearchValue(actionInput.current.input.value);
    if(actionInput.current.input.value==='') searchMode.current = '';
    // console.log('searchValue', actionInput.current.input.value);
    // console.log('searchMode.current', searchMode.current);
  }
  const onKeyDown = (e) => {
    // console.log('onKeyDown', e.key, e.keyCode);
    if (e.key === indexServerSign) {
      if (searchValue.indexOf(indexServerSign) >= 0 || searchValue.indexOf(indexPipelineSign) >= 0 || indexAllSigns.includes(searchValue[searchValue.length-1])) {e.preventDefault(); return;}
      searchMode.current = indexServerSign;
    } else if (e.key === indexTaskSign) {
      if (searchValue.indexOf(indexTaskSign) >= 0 || searchValue.indexOf(indexPipelineSign) >= 0 || indexAllSigns.includes(searchValue[searchValue.length-1])) {e.preventDefault(); return;}
      searchMode.current = indexTaskSign;
    } else if (e.key === indexPipelineSign) {
      if (searchValue.indexOf(indexServerSign) >= 0 || searchValue.indexOf(indexTaskSign) >= 0 || indexAllSigns.includes(searchValue[searchValue.length-1])) {e.preventDefault(); return;}
      searchMode.current = indexPipelineSign;
    } else if ([9, 13, 27].includes(e.keyCode)) { // 27-Esc, 8-Back, 9-Tab, 13-Enter
      if(indexAllSigns.includes(searchMode.current)){
        searchMode.current = '';
      }
    } else if ([8].includes(e.keyCode)) {
      if (searchValue.indexOf(indexServerSign) >= 0 && searchValue.indexOf(indexServerSign)>searchValue.indexOf(indexTaskSign)) searchMode.current = indexServerSign;
      if (searchValue.indexOf(indexTaskSign) >= 0 && searchValue.indexOf(indexTaskSign)>searchValue.indexOf(indexServerSign)) searchMode.current = indexTaskSign;
      if (searchValue.indexOf(indexPipelineSign) >= 0) searchMode.current = indexPipelineSign;
    }
  }
  const getServersForSearch = (query) => {
    const v1 = query.indexOf(indexServerSign)>=0;
    const prefix = v1 ? '' : indexServerSign;
    query = v1 ? query.toLowerCase().split(indexServerSign)[1] : query;
    return userSession.servers.filter((item) => getShowTitle(item.name).toLowerCase().includes(query) || (item.tags&&item.tags.join(',').toLowerCase().includes(query))).map((item) => {
      return { value: prefix+item.name, label: (
        <div style={{ display: 'flex', justifyContent: 'space-between'}}>
          <div>{prefix+getShowTitle(item.name)}</div>
          <div style={{ textAlign: 'right' }}>
            { item.tags ? item.tags.map((tag) => (<Tag key={getUniqueKey()}>{tag}</Tag>)) : null }
          </div>
        </div>
      )}
    });
  }
  const getTasksForSearch = (query) => {
    const v1 = query.indexOf(indexTaskSign)>=0;
    const prefix = v1 ? '' : indexTaskSign;
    query = v1 ? query.toLowerCase().split(indexTaskSign)[1] : query;
    return userSession.tasks.filter((item) => getShowTitle(item.name).toLowerCase().includes(query) || (item.tags&&item.tags.join(',').toLowerCase().includes(query))).map((item) => {
      return { value: prefix+item.name, label: (
        <div style={{ display: 'flex', justifyContent: 'space-between'}}>
          <div>{prefix+getShowTitle(item.name)}</div><div>
            { item.interaction ? (<Tag key={getUniqueKey()}>{item.interaction}</Tag>) : null }
            { item.tags ? item.tags.map((tag) => (<Tag key={getUniqueKey()}>{tag}</Tag>)) : null }
          </div>
        </div>
      )}
    });
  }
  const getPipelinesForSearch = (query) => {
    const v1 = query.indexOf(indexPipelineSign)>=0;
    const prefix = v1 ? '' : indexPipelineSign;
    query = v1 ? query.toLowerCase().split(indexPipelineSign)[1] : query;
    return userSession.pipelines.filter((item) => item.name.toLowerCase().includes(query) || (item.tags&&item.tags.join(',').toLowerCase().includes(query))).map((item) => {
      return { value: prefix+item.name, label: (
        <div style={{ display: 'flex', justifyContent: 'space-between'}}>
          <div>{prefix+item.name}</div><div>
            { item.tags ? item.tags.map((tag) => (<Tag key={getUniqueKey()}>{tag}</Tag>)) : null }
          </div>
        </div>
      )}
    });
  }
  const searchResult = (query) => {
    // console.log('searchResult: ', query);
    if (searchMode.current === indexServerSign) {
      return getServersForSearch(query);
    } else if (searchMode.current === indexTaskSign) {
      return getTasksForSearch(query);
    } else if (searchMode.current === indexPipelineSign) {
      return getPipelinesForSearch(query);
    } else {
      return getServersForSearch(query).concat(getTasksForSearch(query)).concat(getPipelinesForSearch(query));
    }
  };
  const handleSearch = (value) => {
    const v1 = searchResult(value);
    setOptions(value ? v1 : []);
    // console.log('handleSearch', value, v1.length);
  };

  useImperativeHandle(ref, () => ({
    submitForm: async (callback) => {
      try {
        const values = await scheduleFormRef.validateFields();
        values['oldkey'] = oldKey;
        values['interval'] = parseInt(values.interval);
        values.start = values.start.toDate().getTime(); // get time stamp
        if(values.end) values.end = values.end.toDate().getTime();  // get time stamp
        values['tid'] = userSession.team0;
        values['tname'] = userSession.tname;
        values['action'] = actionInput.current.input.value;
        callApi('setSchedule', {obh: props.obh, schedule: values}).then((data) => {
          if(data && data.errinfo) {
            message.error(data.errinfo);
          }else if(data && data.sites){
            setUserSession({...userSession, sites: data.sites});
            message.success((oldKey ? 'Updated' : 'Added') + ' successfully');
            if(callback) callback(data.sites);
          }
        }).catch((err) => { message.error(err.message); })
      } catch (errorInfo) {
        console.log('Failed:', errorInfo);
      }
    },
    setFormValues: (values) => {
      setOldKey(values.oldkey);
      scheduleFormRef.setFieldsValue({
        title: values.title||'',
        type: values.type||'interval',
        runMode: values.runMode||'terminal',
        interval: values.interval||60,
        start: values.start ? dayjs(values.start) : null,
        end: values.end ? dayjs(values.end) : null,
        recipients: values.recipients||[],
        regex: values.regex||'',
      });
      setSearchValue(values.action);
    }
  }));

  const onFinish = (values) => {
    console.log('Received values from form:', values);
  };

  // const handleMembersChange = (value) => {
    // console.log(`selected ${value}`);
  // };

  return (
    <Form
      form={scheduleFormRef}
      onFinish={onFinish}
      initialValues={{ type: 'interval', runMode: 'terminal' }}
      layout="vertical"
    >
      <Form.Item name="title" label="Title" tooltip="Identical Name of the schedule" rules={[{ required: true, message: 'Please input the title!' }]}>
        <Input autoComplete="off" autoCapitalize="off" autoCorrect="off" />
      </Form.Item>

      <Row>
        <Col span={12}>
          <Form.Item name="type" label="Type" rules={[{ required: true, message: 'Please select the type!' }]} >
            <Radio.Group>
              <Radio value="interval">Interval</Radio>
              <Radio value="one_time">One Time</Radio>
            </Radio.Group>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type} >
            {({ getFieldValue }) =>
              getFieldValue('type') === 'interval' ? (
                <Form.Item name="interval" label="Interval" rules={[{ required: true, message: 'Please input the interval!' }]} >
                  <Input autoComplete="off" autoCapitalize="off" autoCorrect="off" type="number" min={1} addonAfter="&nbsp;seconds&nbsp;" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Col>
      </Row>

      <Row>
        <Col span={12}>
          <Form.Item name="start" label="Start Time" rules={[{ required: true, message: 'Please select the start time!' }]} >
            <DatePicker showTime use12Hours format="YYYY-MM-DD HH:mm:ss" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type} >
            {({ getFieldValue }) =>
              getFieldValue('type') === 'interval' ? (
                <Form.Item name="end" label="End Time" rules={[{ required: true, message: 'Please select the end time!' }]} >
                  <DatePicker showTime use12Hours format="YYYY-MM-DD HH:mm:ss" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Action" rules={[{ required: true, message: 'Please input the action!' }]} >
        <AutoComplete
          popupMatchSelectWidth={'100%'}
          defaultActiveFirstOption={true}
          open={showDropdown}
          style={{ width: '100%', transition: 'none' }}
          value={searchValue}
          options={options}
          onFocus={() => { setShowDropdown(true); }}
          onSelect={onSelect}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onSearch={handleSearch}
        >
          <Input ref={actionInput}
            autoComplete='off'
            autoCapitalize='off'
            autoCorrect='off'
            spellCheck='false'
            placeholder="Type : for choosing a Task, or @ for Server, or ! for Pipeline"
          />
        </AutoComplete>
      </Form.Item>
      <Form.Item name="runMode" label="Run Mode" rules={[{ required: true, message: 'Please select the run mode!' }]} tooltip={<>Terminal: Run all tasks in a login shell, which means it will have the same environment and output as when you log in.<br/><br/>Command: Run commands with exec_command in a non-login shell, which means it won’t have the user environment as when you log in. The output will be cleaner, showing only the command’s results without any extra shell prompts.</>} >
        <Radio.Group>
          <Radio value="terminal">Terminal</Radio>
          <Radio value="command">Command</Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item name="recipients" label="Notification" tooltip="Send a notification if the task output matches the Regex. No notification will be sent if the recipients are not specified.">
        <Select
          mode="multiple"
          allowClear
          style={{
            width: '100%',
          }}
          placeholder="Recipients"
          defaultValue={[]}
          // onChange={handleMembersChange}
          options={[{email:userSession.email, status:'Active'}].concat(userSession.teams[userSession.team0].members.filter(member => member.status==='Active')).map(member => {
            return { label: member.email, value: member.email };
          })}
        />
      </Form.Item>
      <Form.Item name='regex'>
        <Input.TextArea autoComplete="off" autoCapitalize="off" autoCorrect="off" rows={2} autoSize={{ minRows: 1, maxRows: 4 }} placeholder='Regex' />
      </Form.Item>

    </Form>
  );
};

export default forwardRef(ScheduleForm);
