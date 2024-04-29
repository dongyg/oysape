import React, { useImperativeHandle, forwardRef } from 'react';
import { App, Form, Input, DatePicker, Radio, Row, Col } from 'antd';
import dayjs from 'dayjs';

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi } from '../Common/global';

const ScheduleForm = (props, ref) => {
  const { message } = App.useApp();
  const { userSession, setUserSession } = useCustomContext();
  const [scheduleFormRef] = Form.useForm();
  const [ oldKey, setOldKey ] = React.useState(null);

  useImperativeHandle(ref, () => ({
    submitForm: async (callback) => {
      try {
        const values = await scheduleFormRef.validateFields();
        values['oldkey'] = oldKey;
        values['interval'] = parseInt(values.interval);
        values.start = values.start.toDate().getTime(); // get time stamp
        if(values.end) values.end = values.end.toDate().getTime();  // get time stamp
        values['team'] = userSession.tname;
        callApi('setSchedule', {obh: props.obh, schedule: values}).then((data) => {
          console.log(data);
          if(data && data.errinfo) {
            message.error(data.errinfo);
          }else if(data && data.sites){
            setUserSession({...userSession, sites: data.sites});
            message.success((oldKey ? 'Updated' : 'Added') + ' successfully');
            if(callback) callback(data.sites);
          }
        })
      } catch (errorInfo) {
        console.log('Failed:', errorInfo);
      }
    },
    setFormValues: (values) => {
      setOldKey(values.oldkey);
      scheduleFormRef.setFieldsValue({
        title: values.title||'',
        type: values.type||'interval',
        interval: values.interval||60,
        action: values.action||'',
        start: values.start ? dayjs(values.start) : null,
        end: values.end ? dayjs(values.end) : null,
      });
    }
  }));

  const onFinish = (values) => {
    console.log('Received values from form:', values);
  };

  return (
    <Form
      form={scheduleFormRef}
      onFinish={onFinish}
      initialValues={{ type: 'interval' }}
      layout="vertical"
    >
      <Form.Item name="title" label="Title" tooltip="Identical Name of the schedule" rules={[{ required: true, message: 'Please input the title!' }]}>
        <Input />
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
                  <Input type="number" min={1} addonAfter="&nbsp;seconds&nbsp;" />
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

      <Form.Item name="action" label="Action" rules={[{ required: true, message: 'Please input the action!' }]} >
        <Input />
      </Form.Item>

    </Form>
  );
};

export default forwardRef(ScheduleForm);
