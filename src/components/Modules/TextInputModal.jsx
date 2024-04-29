import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input } from 'antd';

const TextInputModal = ({ visible, onCreate, onCancel, defaultValue, title, placeholder, rules }) => {
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
      <Input
        placeholder={placeholder||"Enter here"}
        value={inputValue}
        onChange={handleChange}
        onPressEnter={handleOk}
        ref={inputRef}
        autoComplete='off' autoCapitalize='off' autoCorrect='off'
      />
    </Modal>
  );
};

export default TextInputModal;
