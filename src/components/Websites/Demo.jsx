import React, { useState } from 'react';
import { Form, DatePicker } from 'antd';
import dayjs from 'dayjs';

const Demo = () => {
  const [form] = Form.useForm();

  // 在组件加载时设置一个固定的时间值
  useState(() => {
    form.setFieldsValue({
      start: dayjs(1714503482156),
    });
  }, [form]);

  return (
    <Form form={form}>
      <Form.Item
        name="start"
        label="Start Time"
        rules={[{ required: true, message: 'Please select the start time!' }]}
      >
        <DatePicker showTime use12Hours format="YYYY-MM-DD HH:mm:ss" />
      </Form.Item>
    </Form>
  );
};

export default Demo;
