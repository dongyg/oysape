import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input, Typography } from 'antd';

const { Text, } = Typography;

const PassInputModal = ({ visible, onCreate, onCancel, defaultValue, title, placeholder, rules, extra }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
    }
    setInputValue(defaultValue||'');
  }, [visible, defaultValue]);

  const handleOk = () => {
    if (rules && rules.map((rule) => {return rule.test(inputValue); }).indexOf(false) >= 0) {
      return;
    }
    onCreate(inputValue);
    setInputValue('');
  };

  const handleChange = (e) => {
    setInputValue(e.target.value);
  };

  return (
    <Modal
      open={visible}
      title={title||"Enter here"}
      okText="Ok"
      cancelText="Cancel"
      onCancel={onCancel}
      onOk={handleOk}
      afterClose={() => {
        setInputValue('');
      }}
      afterOpenChange={() => {
        if (visible && inputRef.current) {
          inputRef.current.focus();
        }
      }}
    >
      <Input.Password
        placeholder={placeholder||"Enter here"}
        value={inputValue}
        onChange={handleChange}
        onPressEnter={handleOk}
        ref={inputRef}
        autoComplete='off' autoCapitalize='off' autoCorrect='off'
      />
      <Text type="secondary">{extra}</Text>
    </Modal>
  );
};

export default PassInputModal;
