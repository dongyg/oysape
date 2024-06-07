import React, { useState, useEffect } from 'react';
import { App, Modal, Table, Button, Form, Radio, Input, Space, Popconfirm, Row, Col } from 'antd';
import { EditOutlined, DeleteOutlined, QuestionCircleFilled, FolderOpenOutlined, PlusOutlined } from "@ant-design/icons";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, getCredentials, saveCredentialListing } from '../Common/global';

const CredentialsModal = ({ visible, onCancel, onChoose, initialMode = 'list', initTitle = 'My Credentials' }) => {
  const { message } = App.useApp();
  const { userSession } = useCustomContext();
  const [mode, setMode] = useState(initialMode);
  const [credentials, setCredentials] = useState([]);
  const [editingCredential, setEditingCredential] = useState(null);
  const [form] = Form.useForm();

  const loadCredentials = () => {
    setCredentials(getCredentials().credentialListing);
  };

  useEffect(() => {
    loadCredentials();
  }, []);

  const saveCredentialsToCookie = (newCredentials) => {
    saveCredentialListing(newCredentials, userSession.uid);
    setCredentials(newCredentials);
  };

  const handleAdd = () => {
    setEditingCredential(null);
    form.resetFields();
    setMode('new');
  };

  const handleEdit = (record) => {
    setEditingCredential(record);
    form.setFieldsValue(record);
    setMode('edit');
  };

  const handleDelete = (key) => {
    const newCredentials = credentials.filter(cred => cred.key !== key);
    saveCredentialsToCookie(newCredentials);
  };

  const handleSave = () => {
    form.validateFields().then(values => {
      const aliasExists = (mode === 'new') ? credentials.some(cred => cred.key === values.alias) : credentials.some(cred => cred.key === values.alias && cred.key !== editingCredential.key);
      if (aliasExists) {
        form.setFields([{ name: 'alias', errors: ['Alias already exists'], }]);
        return;
      }
      values.key = values.alias;
      const newCredentials = [...credentials];
      if (mode === 'new') {
        newCredentials.push(values);
      } else if (mode === 'edit') {
        const index = newCredentials.findIndex(cred => cred.key === editingCredential.key);
        newCredentials[index] = values;
      }
      saveCredentialsToCookie(newCredentials);
      setMode(initialMode);
      form.resetFields();
    });
  };

  const handleChoose = (record) => {
    onChoose(record);
    onCancel();
  };

  const afterOpenChange = (open) => {
    if (open) {
      loadCredentials();
    }
  };

  const columns = [
    {
      title: 'Alias',
      dataIndex: 'alias',
      key: 'alias',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: '120px',
      render: (text, record) => {
        return record.type === 'password' ? 'Password' : 'Private Key';
      }
    },
    {
      title: 'Action',
      key: 'action',
      width: '100px',
      render: (text, record) => (
        <Space size="middle">
          {mode === 'choose' && (
            <Button onClick={() => handleChoose(record)}>Choose</Button>
          )}
          <Button onClick={() => handleEdit(record)} icon={<EditOutlined />}></Button>
          <Popconfirm title="Sure to delete?" onConfirm={() => handleDelete(record.key)} icon={<QuestionCircleFilled />}>
            <Button icon={<DeleteOutlined />}></Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const openFile = (e) => {
    callApi('choose_file_read').then((data) => {
      if(data && data.filename) {
        form.setFieldsValue({prikey: data.filename});
      }else if(data && data.errinfo) {
        message.error(data.errinfo);
      }
    })
  }

  const renderContent = () => {
    switch (mode) {
      case 'list':
      case 'choose':
        return (
          <>
            <Button type="primary" onClick={handleAdd} style={{ marginBottom: 16 }} icon={<PlusOutlined/>}>Add</Button>
            <Table size='small' columns={columns} dataSource={credentials} rowKey="key" />
          </>
        );
      case 'new':
      case 'edit':
        return (
          <Form form={form} layout="vertical" initialValues={{ type: 'prikey' }} onFinish={handleSave}>
            <Form.Item name="alias" label="Alias" rules={[{ required: true }]}>
              <Input autoComplete='off' autoCapitalize='off' autoCorrect='off' spellCheck='false'/>
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={12} lg={12} xl={12}>
                <Form.Item label="Username" name="username" tooltip="The OS username will be used if not specified">
                  <Input placeholder='Username' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={12} lg={12} xl={12}>
                <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                  <Radio.Group>
                    <Radio value="password">Password</Radio>
                    <Radio value="prikey">Private Key</Radio>
                  </Radio.Group>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type} >
              {({ getFieldValue }) =>
                getFieldValue('type') === 'password' ? (
                  <Form.Item label="Password" name="password" tooltip="Use the password to log in. The password will not be uploaded and will only be stored locally in current session. Servers that rely on password authentication cannot be used for scheduled tasks.">
                    <Input.Password placeholder='Password' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
                  </Form.Item>
                ) : <>
                  <Form.Item label="Private Key" name="prikey" tooltip={<>The private key file. <br/>• The file path can start with ~<br/>• Private key won't be uploaded</>}>
                    <Input placeholder='Private Key File' autoCapitalize='off' autoComplete='off' autoCorrect='off' addonAfter={<Button type="text" onClick={openFile} icon={<FolderOpenOutlined />} style={{ height: "30px", borderTopLeftRadius: "0px", borderBottomLeftRadius: "0px" }}></Button>} />
                  </Form.Item>
                  <Form.Item label="Passphrase" name="passphrase" tooltip="The passphrase for the private key">
                    <Input placeholder='Passphrase' autoCapitalize='off' autoComplete='off' autoCorrect='off' />
                  </Form.Item>
                </>
              }
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  Save
                </Button>
                <Button onClick={() => setMode(initialMode)}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        );
      default:
        return null;
    }
  };

  return (
    <Modal open={visible} title={initTitle} onCancel={onCancel} footer={null} afterOpenChange={afterOpenChange}>
      {renderContent()}
    </Modal>
  );
};

export default CredentialsModal;