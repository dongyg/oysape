import React, { useState, useRef } from 'react'
import { App, Dropdown, Button, Typography, Steps, Tabs, Checkbox, Divider, Row, Col, List, Form, Input, Modal, Tooltip } from 'antd';
import { DeleteOutlined, QuestionCircleFilled, EditOutlined, PlusOutlined, ClockCircleOutlined, PlayCircleOutlined, CheckCircleOutlined, RedoOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { SolutionOutlined, CaretRightOutlined, PauseOutlined } from "@ant-design/icons";
import { RiInstallLine, RiUninstallLine } from "react-icons/ri";
import { TbCalendarRepeat, TbBrandPython } from "react-icons/tb";
import { RxActivityLog } from "react-icons/rx";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi } from '../Common/global';

import ScheduleForm from './ScheduleForm';

const CheckboxGroup = Checkbox.Group;
const { Title, Paragraph } = Typography;

const capitalizeFirstLetter = function(str) {
  if (str.length === 0) return str;
  return (str.charAt(0).toUpperCase() + str.slice(1)).replace('_', ' ');
}

// const schedule_demo = [
  // {"title":"Demo schedule task",     "type": "interval", "team":"Aifetel", "interval": 5, "start": 10, "end": 20, "action": ":Git pull Oysape @myocipro"},
  // {"title":"Demo schedule pipeline", "type": "one_time", "team":"Aifetel", "start": 10, "action": "!Oysape server upgrade",},
// ]

const nginxConfigDemo = `server {
  listen 80;
  listen [::]:80;
  server_name your_domain;
  location /websocket {
      proxy_pass          http://192.168.0.1:19790;
      proxy_http_version  1.1;
      proxy_read_timeout  600s;
      proxy_set_header    Upgrade $http_upgrade;
      proxy_set_header    Connection "upgrade";
      proxy_set_header    Host $host;
      proxy_set_header    X-Real-IP $remote_addr;
      proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_set_header    X-Forwarded-Proto $scheme;
      proxy_set_header    X-Forwarded-Host  $host;
      proxy_set_header    X-Forwarded-Port  $server_port;
  }

  location / {
      proxy_pass          http://192.168.0.1:19790;
      proxy_redirect      off;
      proxy_set_header    Host $host;
      proxy_set_header    X-Real-IP $remote_addr;
      proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_set_header    X-Forwarded-Proto $scheme;
      proxy_set_header    X-Forwarded-Host  $host;
      proxy_set_header    X-Forwarded-Port  $server_port;
  }
}
`;

const WebsiteManage = ({ uniqueKey, websiteKey, websiteObject}) => {
  const { message, modal } = App.useApp();
  const { customTheme, userSession, setUserSession } = useCustomContext();
  const [webhostObject, setWebHostObject] = useState(websiteObject);
  const [currentStep, setCurrentStep] = useState(!websiteObject.target ? 0 : (!websiteObject.verified ? 1 : 2));
  const [currentWorkKey, setCurrentWorkKey] = useState('webhost_teams');
  const [installing, setInstalling] = useState(false);
  const [verifying, setVerifying] = useState(false);

  React.useEffect(() => {
    window.getHostObject = () => {
      return websiteObject;
    }
  })
  const plainOptions = Object.values(userSession.teams).filter(item => item.is_creator).map(item => item.tname);
  const defaultCheckedList = Object.values(userSession.teams).filter(item => item.is_creator).map(item => item.allow_sites&&item.allow_sites.includes(websiteObject.obh) ? item.tname : null).filter(x => x);
  const [checkedList, setCheckedList] = useState(defaultCheckedList);
  const checkAll = plainOptions.length === checkedList.length;
  const indeterminate = checkedList.length > 0 && checkedList.length < plainOptions.length;

  const [formInstall] = Form.useForm();
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const scheduleFormRef = useRef();

  const onChange = (list) => {
    setCheckedList(list);
  };
  const onCheckAllChange = (e) => {
    setCheckedList(e.target.checked ? plainOptions : []);
  };

  const comingSoon = <Title style={{ textAlign: 'center', marginTop: '60px' }}>Coming soon</Title>;
  const unavailable = <Title style={{ textAlign: 'center', marginTop: '60px' }}>Please start and verify first</Title>;

  const validatePortMapping = (_, value) => {
    if (!value) {
      return Promise.resolve();
    }
    const parts = value.split(':');
    if (parts.length === 2 && parts.every(part => {
      const port = parseInt(part, 10);
      return port >= 1 && port <= 65535;
    })) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('Port mapping should be like 19790:19790'));
  };
  const validateVolumeMapping = (_, value) => {
    if (!value) {
      return Promise.resolve();
    }
    const parts = value.split(':');
    if (parts.length === 2 && validatePath(parts[0]) && validatePath(parts[1], false)) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('Volume mapping should be like /host/path:/container/path'));
  };
  const validatePath = (path, isHostPath = true) => {
    if (!path) {
      // If the path is an empty string, consider it valid
      return true;
    }
    // Validate container paths, which are typically in UNIX style. Support for absolute paths, relative paths, and home directory paths starting with '~'
    if (!isHostPath) {
      return /^\/[^\0]*$/.test(path) || /^\.\.?\/[^\0]*$/.test(path) || /^~\/[^\0]*$/.test(path);
    }
    // Validate host paths which can be in UNIX style, Windows style, or start with '~' for home directories
    return /^\/[^\0]*$/.test(path) || /^[a-zA-Z]:\/[^\0]*$/.test(path) || /^\.\.?\/[^\0]*$/.test(path) || /^~\/[^\0]*$/.test(path);
  };
  const execInstall = async (obh, target) => {
    try {
      const values = await formInstall.validateFields();
      if(values.title && values.title.indexOf('"') > -1) {
        message.error('Title cannot contain "');
        return;
      }
      setInstalling(true);
      values['obh'] = obh;
      values['target'] = target;
      callApi('installWebHost', values).then((data) => {
        setInstalling(false);
        if(data && data.errinfo) {
          message.error(data.errinfo);
        }else if(data && data.sites){
          message.success('Started successfully');
          setUserSession({...userSession, sites: data.sites});
          setWebHostObject( data.sites.filter((item) => item.key === obh)[0] );
        }
      })
    } catch (errorInfo) {
      console.log('Failed:', errorInfo);
      setInstalling(false);
    }
  }

  const execVerify = (obh) => {
    modal.confirm({
      title: 'Confirm to Verify Webhost',
      icon: <QuestionCircleFilled />,
      content: 'Are you sure you want to verify webhost ' + obh + '?',
      onOk() {
        setVerifying(true);
        callApi('verifyWebHost', {obh: obh}).then((data) => {
          setVerifying(false);
          if(data && data.errinfo) {
            message.error(data.errinfo);
          }else if(data && data.sites){
            message.success('Verified successfully');
            setUserSession({...userSession, sites: data.sites, teams: data.teams});
            setWebHostObject( data.sites.filter((item) => item.key === obh)[0] );
          }
        })
      },
      onCancel() {
        // console.log('Cancel');
      },
    });
  }
  const execUninstall = (obh, target) => {
    modal.confirm({
      title: 'Confirm to Stop Webhost',
      icon: <QuestionCircleFilled />,
      content: 'Are you sure you want to stop webhost ' + obh + ' from ' + target + '?',
      onOk() {
        callApi('uninstallWebHost', {obh: obh, containerName: webhostObject.containerName}).then((data) => {
          if(data && data.errinfo) {
            message.error(data.errinfo);
          }else if(data && data.sites){
            message.success('Stopped successfully');
            setUserSession({...userSession, sites: data.sites, teams: data.teams});
            setWebHostObject( data.sites.filter((item) => item.key === obh)[0] );
          }
        })
      },
      onCancel() {
        // console.log('Cancel');
      },
    });
  }
  const execDelete = (obh) => {
    modal.confirm({
      title: 'Confirm to Delete Webhost',
      icon: <QuestionCircleFilled />,
      content: 'Are you sure you want to delete webhost ' + obh + '?',
      onOk() {
        callApi('deleteWebHost', {obh: obh}).then((data) => {
          if(data && data.errinfo) {
            message.error(data.errinfo);
          }else if(data && data.sites){
            setUserSession({...userSession, sites: data.sites});
            window.closeThisTab && window.closeThisTab(uniqueKey);
          }
        })
      },
      onCancel() {
        // console.log('Cancel');
      },
    });
  }

  const execApplyToTeams = () => {
    callApi('applyToTeams', {obh: webhostObject.obh, teams: checkedList}).then((data) => {
      if(data && data.errinfo) {
        message.error(data.errinfo);
      }else{
        setUserSession({...userSession, teams: data.teams});
        message.success('Applied successfully');
      }
    })
  }

  const handleScheduleCancel = () => {
    setShowScheduleForm(false);
  };

  const handleScheduleOk = () => {
    scheduleFormRef.current.submitForm((data) => {
      if(data) {
        const record = data.filter((item) => item.obh === webhostObject.obh)[0];
        if(record) {
          setWebHostObject(record);
        }
      }
      handleScheduleCancel();
    });
  };


  return (
    <div className={customTheme.className+' withScrollContent'} style={{ backgroundColor: customTheme.colors["editor.background"], color: customTheme.colors["editor.foreground"], height: '100%', padding: '24px', overflowY: 'auto', overflowX: 'hidden', }}>
      {/* Top bar */}
      <Steps labelPlacement="vertical" current={currentStep} onChange={(value) => {
        console.log(value);
        setCurrentStep(value);
      }}
        items={[
          { title: 'Start', icon: <RiInstallLine />,
            description: !webhostObject.target ? null : webhostObject.target,
            status: currentStep === 0 ? 'process' : 'wait',
          },
          { title: 'Verify', icon: <SolutionOutlined />,
            description: webhostObject.target&&!webhostObject.verified ? null : (webhostObject.verified?'Verified':null),
            status: currentStep === 1 ? 'process' : 'wait',
          },
          { title: 'Config', icon: <SolutionOutlined />,
            description: webhostObject.target&&webhostObject.verified ? 'features' : null,
            status: currentStep === 2 ? 'process' : 'wait',
          },
          { title: 'Stop', icon: <RiUninstallLine />,
            description: null,
            status: currentStep === 3 ? 'process' : 'wait',
          },
          { title: 'Delete', icon: <DeleteOutlined />,
            description: null,
            status: currentStep === 4 ? 'process' : 'wait',
          },
        ]}
      />
      <Divider style={{ margin: '0 24px 0 0' }} />

      {/* Installation */}
      <div hidden={currentStep !== 0} style={{ margin: "0 24px 0 24px"}}>
        { !!webhostObject.target ? <h3>Started on {webhostObject.target}</h3> :
          <><h3>Start</h3><p>Webhost will be run as a Docker container. Please customize your webhost as needed.</p></>
        }
        <Form name={uniqueKey+'_install_form'} form={formInstall} autoComplete="off" labelCol={{ span: 4, }} wrapperCol={{ span: 18, }} initialValues={webhostObject}>
          <Form.Item label="Title" name="title">
            <Input autoComplete="off" autoCapitalize="off" autoCorrect="off" disabled={!!webhostObject.target} />
          </Form.Item>
          <Form.Item name="containerName" label="Container Name" >
            <Input autoComplete="off" autoCapitalize="off" autoCorrect="off" placeholder="Enter container name. Default: oyhost" disabled={!!webhostObject.target} />
          </Form.Item>
          <Form.Item name="port" label="Port" rules={[ { validator: validatePortMapping }]}>
            <Input autoComplete="off" autoCapitalize="off" autoCorrect="off" placeholder="Enter port mapping. Default: 19790:19790" disabled={!!webhostObject.target} />
          </Form.Item>
          <Form.List name="volumes">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <>
                    <Form.Item wrapperCol={{ offset: index === 0 ? 0 : 4, span: 18, }} label={index === 0 ? 'Volumes' : null}
                      tooltip={<>"You probably want to add ~/.ssh so that the container can access your SSH keys"<Button size='small' onClick={() => {add({'volume':'~/.ssh:/root/.ssh'});}}>Add it for me</Button></>}
                      {...field}
                      name={[field.name, 'volume']}
                      rules={[{ validator: validateVolumeMapping }]}
                    >
                      <Input placeholder="Enter volume mapping like /host/path:/container/path" autoComplete="off" autoCapitalize="off" autoCorrect="off" disabled={!!webhostObject.target}
                        addonAfter={!!webhostObject.target ? null : <Button type="text" onClick={() => remove(field.name)} icon={<MinusCircleOutlined />} style={{ height: "30px", borderTopLeftRadius: "0px", borderBottomLeftRadius: "0px" }}></Button>}
                       />
                    </Form.Item>
                  </>
                ))}
                { !!webhostObject.target ? null :
                <Form.Item wrapperCol={{ offset: (formInstall.getFieldValue('volumes')||[]).length === 0 ? 0 : 4, span: 18, }} label={(formInstall.getFieldValue('volumes')||[]).length === 0 ? 'Volumes' : ''}
                  tooltip={<>You probably want to add ~/.ssh so that the container can access your SSH keys{!!webhostObject.target ? null : <Button size='small' onClick={() => {add({'volume':'~/.ssh:/root/.ssh'});}}>Add it for me</Button>}</>}
                >
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>Add Volume</Button>
                </Form.Item>}
              </>
            )}
          </Form.List>
          <Form.Item wrapperCol={{ offset: 4 }}>
            {!webhostObject.target ?
              <Dropdown menu={{ items: userSession.servers.map((item) => {return {key: item.key, label: item.name}}), onClick: ({key}) => { execInstall(webhostObject.obh, key); } }} trigger={['click']}>
                <Button type="primary" loading={installing}>{installing ? 'Starting' : 'Start on ...'}</Button>
              </Dropdown>
              : null}
          </Form.Item>
        </Form>
      </div>

      {/* Verification */}
      <div hidden={currentStep !== 1} style={{ margin: "0 24px 0 24px"}}>
        {webhostObject.target&&webhostObject.verified ? <h3>Verified</h3> : <h3>Verification</h3>}
        {webhostObject.target&&webhostObject.verified ?
          <Button type="primary" onClick={() => {
            callApi('openWebHost', {obh: webhostObject.obh}).then((data) => {
              if(data && data.errinfo) {
                message.error(data.errinfo);
              }
            })
          }}>Open in Browser</Button> : null
        }
        {webhostObject.target&&!webhostObject.verified ?
          <Button type="primary" loading={verifying} onClick={() => { execVerify(webhostObject.obh); }}>{verifying ? 'Verifying' : 'Verify'}</Button>
          : (!webhostObject.target ? 'Please start first.' : null)
        }
        <Typography style={{ marginTop: '20px' }} >
          <Paragraph>Here's an example of how you might configure nginx to expose your webhost to the internet:</Paragraph>
          <pre className='enableHighlight'><code>{nginxConfigDemo}</code></pre>
        </Typography>
      </div>

      {/* Config or Manage */}
      <div hidden={currentStep !== 2} style={{ margin: "0 24px 0 24px"}}>
        <h3>Manage the Webhost</h3>
        <Tabs activeKey={currentWorkKey} onChange={(key) => { setCurrentWorkKey(key); }}
          items={[
            { key: 'webhost_teams', label: 'Applied Teams', children: <>
              {webhostObject.target && webhostObject.verified ?
                <div style={{ marginTop: '20px' }}>
                  <p>Indicates that members of the selected teams will be able to sign into this webhost..</p>
                  <CheckboxGroup options={plainOptions} value={checkedList} onChange={onChange} />
                  <Divider />
                  <Row justify="space-between">
                    <Col span={12}>
                      <Checkbox indeterminate={indeterminate} onChange={onCheckAllChange} checked={checkAll}>Select all</Checkbox>
                    </Col>
                    <Col span={12} style={{ textAlign: 'right' }}>
                      <Button type="primary" onClick={() => execApplyToTeams()}>Apply</Button>
                    </Col>
                  </Row>
                </div>
              : unavailable}
            </> },
            { key: 'webhost_scheduled', label: 'Scheduled Works', children: <>
              {webhostObject.target && webhostObject.verified ?
                <div>
                  <List itemLayout="vertical" size="large" dataSource={webhostObject.schedules} pagination={{onChange: (page) => {console.log(page);}, pageSize: 4, }}
                    header={<Row justify="space-between">
                      <Col span={12}><b>{(webhostObject.schedules&&webhostObject.schedules.length)||0} Scheduled Tasks</b></Col>
                      <Col span={12} style={{ textAlign: 'right' }}>
                        <Button type="text" icon={<PlusOutlined />} onClick={() => {
                          setShowScheduleForm(true);
                          setTimeout(() => {
                            scheduleFormRef.current&&scheduleFormRef.current.setFormValues({});
                          }, 100);
                        } } />
                      </Col>
                    </Row>}
                    renderItem={(item) => (
                      <List.Item
                        key={item.title}
                        actions={[
                          <>{item.type==='interval' ? <TbCalendarRepeat /> : <ClockCircleOutlined />}&nbsp;{capitalizeFirstLetter(item.type)}</>,
                          <>
                            <PlayCircleOutlined />&nbsp;{(new Date(item.start).toLocaleString())}{item.type==='interval' ? <>&nbsp;&nbsp;
                            <RedoOutlined />&nbsp;{item.interval}s&nbsp;&nbsp;
                            <CheckCircleOutlined />&nbsp;{(new Date(item.end).toLocaleString())}</> : null}
                          </>,
                        ]}
                        extra={<>
                          <Tooltip title="Post script"><Button icon={<TbBrandPython />} onClick={() => {
                          } }/></Tooltip>&nbsp;
                          <Tooltip title="Edit"><Button icon={<EditOutlined />} onClick={() => {
                            setShowScheduleForm(true);
                            setTimeout(() => {
                              scheduleFormRef.current&&scheduleFormRef.current.setFormValues({...item, oldkey: item.title});
                            }, 100);
                          } }/></Tooltip>&nbsp;
                          <Tooltip title="Delete"><Button icon={<DeleteOutlined />} onClick={() => {
                            modal.confirm({
                              title: 'Are you sure you want to delete this schedule?',
                              content: `The schedule ${item.title} will be deleted.`,
                              icon: <QuestionCircleFilled />,
                              onOk: () => {
                                callApi('deleteSchedule', {obh: webhostObject.obh, title: item.title}).then((data) => {
                                  if(data && data.errinfo) {
                                    message.error(data.errinfo);
                                  } else if(data && data.sites){
                                    message.success('Deleted successfully');
                                    setUserSession({...userSession, sites: data.sites});
                                    setWebHostObject( data.sites.filter((item) => item.key === webhostObject.key)[0] );
                                  }
                                })
                              },
                              onCancel() {},
                            })
                          } }/></Tooltip>
                          <Divider style={{ margin: '10px 0' }} />
                          <Tooltip title={item.running ? 'Stop' : 'Start'}><Button type={item.running ? "default" : "primary"} danger={item.running ? 'true' : null} icon={item.running ? <PauseOutlined /> : <CaretRightOutlined />} onClick={() => {
                            modal.confirm({
                              title: 'Are you sure you want to ' + (item.running ? 'stop' : 'start') + ' this schedule?',
                              content: `The schedule ${item.title} will be ${item.running ? 'stopped' : 'started'}.`,
                              icon: <QuestionCircleFilled />,
                              onOk: () => {
                                callApi('setSchedule', {obh: webhostObject.obh, schedule: {...item, oldkey: item.title, running: !item.running}}).then((data) => {
                                  if(data && data.errinfo) {
                                    message.error(data.errinfo);
                                  } else if(data && data.sites){
                                    message.success('' + (item.running ? 'Stopped' : 'Started') + ' successfully');
                                    setUserSession({...userSession, sites: data.sites});
                                    setWebHostObject( data.sites.filter((item) => item.key === webhostObject.key)[0] );
                                  }
                                })
                              },
                              onCancel() {},
                            })
                          } }/></Tooltip>&nbsp;
                          <Tooltip title="View log"><Button icon={<RxActivityLog />} onClick={() => {
                          } }/></Tooltip>
                        </>}
                      >
                        <List.Item.Meta title={item.title + ' (' + (item.running ? 'Running' : 'Stopped') + ')'} description={item.team} />
                        {item.action}
                      </List.Item>
                    )}
                  />
                </div>
                : unavailable}
            </> },
            { key: 'webhost_github', label: 'Github webhook', children: comingSoon },
            { key: 'webhost_bitbucket', label: 'Bitbucket hook', children: comingSoon },
          ]}
        />
        <Modal title={"Schedule Task (Team: "+userSession.tname+")"} open={showScheduleForm} onOk={handleScheduleOk} onCancel={handleScheduleCancel} okText="Save" cancelText="Cancel">
          <ScheduleForm ref={scheduleFormRef} obh={webhostObject.obh} />
        </Modal>
      </div>

      {/* Uninstall */}
      <div hidden={currentStep !== 3} style={{ margin: "0 24px 0 24px"}}>
        <h3>Stop</h3>
        <Typography>
          <Paragraph>This will stop and delete the Docker container. The configuration will not be deleted.</Paragraph>
        </Typography>
        {webhostObject.target ? <Button danger onClick={() => execUninstall(webhostObject.obh, webhostObject.target)}>Stop</Button> : 'For started only.'}
      </div>

      {/* Delete */}
      <div hidden={currentStep !== 4} style={{ margin: "0 24px 0 24px"}}>
        <h3>Delete</h3>
        <Typography>
          <Paragraph>This will delete this webhost. All data related to this webhost will be deleted.</Paragraph>
        </Typography>
        {!webhostObject.target&&!webhostObject.verified ? <Button danger onClick={() => execDelete(webhostObject.obh)}>Delete</Button> : 'Please stop first.'}
      </div>

    </div>
  );
}

export default WebsiteManage;
