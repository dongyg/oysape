import React, { useState, useRef, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { CodeiumEditor } from "@codeium/react-code-editor";
import { solarizedLight, solarizedDark } from '@uiw/codemirror-theme-solarized';
import { loadLanguage } from '@uiw/codemirror-extensions-langs';
import { App, Dropdown, Button, Typography, Steps, Tabs, Checkbox, Divider, Row, Col, List, Form, Input, Modal, Tooltip, Table } from 'antd';
import { DeleteOutlined, QuestionCircleFilled, EditOutlined, PlusOutlined, ClockCircleOutlined, PlayCircleOutlined, CheckCircleOutlined, RedoOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { SolutionOutlined, CaretRightOutlined, PauseOutlined, DeleteFilled, SettingOutlined } from "@ant-design/icons";
import { RiInstallLine, RiUninstallLine } from "react-icons/ri";
import { TbCalendarRepeat } from "react-icons/tb";
import { RxActivityLog } from "react-icons/rx";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, isDesktopVersion } from '../Common/global';

import ScheduleForm from './ScheduleForm';
import ScheduleLogViewer from './ScheduleLogViewer';
import WebsiteCredentials from './WebsiteCredentials';
import TextInputModal from '../Modules/TextInputModal';

const CheckboxGroup = Checkbox.Group;
const { Title, Paragraph, Link } = Typography;

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

  # WebSocket configuration
  location /websocket {
      proxy_pass          http://192.168.0.1:19790;
      proxy_http_version  1.1;
      proxy_read_timeout  600s;
      # WebSocket specific headers
      proxy_set_header    Upgrade $http_upgrade;
      proxy_set_header    Connection "upgrade";
      # Common proxy headers
      proxy_set_header    Host $host;
      proxy_set_header    X-Real-IP $remote_addr;
      proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_set_header    X-Forwarded-Proto $scheme;
      proxy_set_header    X-Forwarded-Host  $host;
      proxy_set_header    X-Forwarded-Port  $server_port;
  }

  # Default location for all other requests
  location / {
      proxy_pass          http://192.168.0.1:19790;
      proxy_redirect      off;
      # Common proxy headers
      proxy_set_header    Host $host;
      proxy_set_header    X-Real-IP $remote_addr;
      proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_set_header    X-Forwarded-Proto $scheme;
      proxy_set_header    X-Forwarded-Host  $host;
      proxy_set_header    X-Forwarded-Port  $server_port;
  }
}
`;

const githookDemo = `#!/usr/bin/env python
# -*- coding: utf-8 -*-

from helpers import apis

def handle_github_event(headers, payload):
    # Call the user-defined function
    event_type = headers.get('X-Github-Event')
    print(f"GitHub event: {event_type}")
    print(headers)
    print(payload)
    # Get the API object by team name
    apiObj = apis.getApiObjectByTeam('Demo Team')
    if apiObj:
        # Call a task or pipeline if API object is found. runMode=command will get the output synchronously
        print(apiObj.callTask({'runMode':'command', 'taskKey':'hello', 'serverKey':'localhost'}))
        # Send an App notification to specific users
        print(apiObj.sendNotification({'recipients':['abc@example.com'], 'title':"Hello, World!", 'message':"Hello, World!"}))


def handle_bitbucket_event(headers, payload):
    # Call the user-defined function
    event_type = headers.get('X-Event-Key')
    print(f"Bitbucket event: {event_type}")
    print(headers)
    print(payload)
    # Get the API object by team name
    apiObj = apis.getApiObjectByTeam('Demo Team')
    if apiObj:
        # Call a task or pipeline if API object is found. runMode=command will get the output synchronously
        print(apiObj.callPipeline({'runMode':'command', 'pipelineName':'hello world'}))
        # Send an App notification to specific users
        print(apiObj.sendNotification({'recipients':['abc@example.com'], 'title':"Hello, World!", 'message':"Hello, World!"}))
`

const WebsiteManage = ({ uniqueKey, websiteKey, websiteObject}) => {
  const { message, modal } = App.useApp();
  const { customTheme, userSession, setUserSession, editorType } = useCustomContext();
  const [webhostObject, setWebHostObject] = useState(websiteObject);
  const [currentStep, setCurrentStep] = useState(!websiteObject.target ? 0 : (!websiteObject.verified ? 1 : 2));
  const [currentWorkKey, setCurrentWorkKey] = useState('webhost_teams');
  const [installing, setInstalling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeValue, setCodeValue] = useState(websiteObject.initScript||'');
  const [visibleWebsiteCredentials, setVisibleWebsiteCredentials] = useState(false);
  const [showSudoPassword, setShowSudoPassword] = React.useState(false);
  const [sudoAction, setSudoAction] = React.useState(null);
const credForServer = useRef('');
  const credForTeam = useRef('');
  let prevHeight = useRef(58)

  // codemirror
  const onCodeChange = React.useCallback((val, viewUpdate) => {
    setCodeValue(val||'');
  }, [])

  const plainOptions = Object.entries(userSession.teams).filter(([_, team]) => team.is_creator === true).map(([id, team]) => ({label: team.tname, value: id}));
  const defaultCheckedList = Object.entries(userSession.teams).filter(([_, team]) => team.allow_sites && team.allow_sites.includes(websiteObject.obh)).map(([id, _]) => id);
  const [checkedList, setCheckedList] = useState(defaultCheckedList);
  const [credentialMapping, setCredentialMapping] = useState({});
  const [credentialListing, setCredentialListing] = useState([]);
  const checkAll = plainOptions.length === checkedList.length;
  const indeterminate = checkedList.length > 0 && checkedList.length < plainOptions.length;

  const [formInstall] = Form.useForm();
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const scheduleFormRef = useRef();

  const onSelectTeamChange = (list) => {
    setCheckedList(list);
  };
  const onCheckAllChange = (e) => {
    setCheckedList(e.target.checked ? plainOptions : []);
  };

  // const comingSoon = <Title style={{ textAlign: 'center', marginTop: '60px' }}>Coming soon</Title>;
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

  const sudoWithPassword = (sudopass) => {
    setShowSudoPassword(false);
    if (sudoAction) {
      sudoAction(sudopass);
    }
  };
  const execInstall = async (obh, target) => {
    try {
      const values = await formInstall.validateFields();
      if(values.title && values.title.indexOf('"') > -1) {
        message.error('Title cannot contain "');
        return;
      }
      if(values.initScript && values.initScript.indexOf("'") > -1) {
        message.error('Init script cannot contain single quote (\')');
        return;
      }
      setInstalling(true);
      values['obh'] = obh;
      values['target'] = target;
      callApi('installWebHost', values).then((data) => {
        setInstalling(false);
        if(data && data.errinfo) {
          if(data.needPassword) {
            const callMe = (sudopass) => {
              setShowSudoPassword(false);
              callApi('installWebHost', Object.assign({}, values, {sudoPass:sudopass})).then((r2) => {
                if(r2 && r2.errinfo) {
                  message.error(r2.errinfo);
                }else if(r2 && r2.sites) {
                  message.success('Started successfully');
                  setUserSession({...userSession, sites: r2.sites, teams: r2.teams});
                  setWebHostObject( r2.sites.find((item) => item.key === obh) );
                }
              }).catch((err) => {
                message.error(err.message);
              })
            }
            setSudoAction(() => callMe);
            setShowSudoPassword(true);
          }else{
            message.error(data.errinfo);
          }
        }else if(data && data.sites){
          message.success('Started successfully');
          setUserSession({...userSession, sites: data.sites});
          setWebHostObject( data.sites.find((item) => item.key === obh) );
        }
      }).catch((err) => { message.error(err.message); })
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
            setWebHostObject( data.sites.find((item) => item.key === obh) );
          }
        }).catch((err) => { message.error(err.message); })
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
            if(data.needPassword) {
              const callMe = (sudopass) => {
                setShowSudoPassword(false);
                callApi('uninstallWebHost', {obh: obh, containerName: webhostObject.containerName, sudoPass:sudopass}).then((r2) => {
                  if(r2 && r2.errinfo) {
                    message.error(r2.errinfo);
                  }else if(r2 && r2.sites) {
                    message.success('Stopped successfully');
                    setUserSession({...userSession, sites: r2.sites, teams: r2.teams});
                    setWebHostObject( r2.sites.find((item) => item.key === obh) );
                  }
                }).catch((err) => {
                  message.error(err.message);
                })
              }
              setSudoAction(() => callMe);
              setShowSudoPassword(true);
            }else{
              message.error(data.errinfo);
            }
          }else if(data && data.sites){
            message.success('Stopped successfully');
            setUserSession({...userSession, sites: data.sites, teams: data.teams});
            setWebHostObject( data.sites.find((item) => item.key === obh) );
          }
        }).catch((err) => { message.error(err.message); })
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
    callApi('applyToTeams', {obh: webhostObject.obh, target: webhostObject.target, teams: checkedList}).then((data) => {
      if(data && data.errinfo) {
        message.error(data.errinfo);
      }else{
        setUserSession({...userSession, teams: data.teams});
        message.success('Applied successfully');
      }
    }).catch((err) => { message.error(err.message); })
  }

  const handleScheduleCancel = () => {
    setShowScheduleForm(false);
  };

  const handleScheduleOk = () => {
    setFormSaving(true);
    scheduleFormRef.current.submitForm((data) => {
      setFormSaving(false);
      if(data) {
        const record = data.find((item) => item.obh === webhostObject.obh);
        if(record) {
          setWebHostObject(record);
        }
      }
      handleScheduleCancel();
    });
  };

  const handleCredentialsCancel = () => {
    setVisibleWebsiteCredentials(false);
  }

  const handleCredentialsChoose = (data) => {
    callApi('set_credentials', {obh: webhostObject.obh, team_id: credForTeam.current, credentialMapping: { [credForTeam.current]: { [credForServer.current]: data['alias']}}}).then((res) => {
      if(res&&res.credentialMapping) {
        setCredentialMapping(res.credentialMapping);
      }else if(res && res.errinfo) {
        message.error(res.errinfo);
      }
    }).catch((err) => { message.error(err.message); })
  }
  const handleCredentialsRemove = () => {
    callApi('set_credentials', {obh: webhostObject.obh, team_id: credForTeam.current, credentialMapping: { [credForTeam.current]: { [credForServer.current]: null}}}).then((res) => {
      if(res&&res.credentialMapping) {
        setCredentialMapping(res.credentialMapping);
      }else if(res && res.errinfo) {
        message.error(res.errinfo);
      }
    }).catch((err) => { message.error(err.message); })
  }

  useEffect(() => {
    window.getHostObject = () => {
      return websiteObject;
    }
    if(websiteObject.target) {
      const v1 = userSession.servers.find((item) => item.name === websiteObject.target);
      if(v1 && typeof v1.credType === 'undefined') {
        message.error('Server ' + websiteObject.target + ' has no credentials. Please set credentials first.');
      } else {
        callApi('get_credentials', {'obh': websiteObject.obh}).then((res) => {
          if(res) {
            setCredentialMapping(res.credentialMapping || {});
            setCredentialListing(res.credentialListing || []);
            if(res.errinfo) {
              message.error(res.errinfo);
            }
          } else {
            message.error('Failed to load webhost credentials');
          }
        }).catch((err) => { message.error(err.message); })
      }
    }

    return () => {
      delete window.getHostObject;
    }
  }, [websiteObject, message, userSession.servers]);

  return (
    <div className={customTheme.className+' withScrollContent'} style={{ backgroundColor: customTheme.colors["editor.background"], color: customTheme.colors["editor.foreground"], height: '100%', padding: '24px', overflowY: 'auto', overflowX: 'hidden', }}>
      {/* Top bar */}
      <Steps labelPlacement="vertical" current={currentStep} onChange={(value) => {
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
          { title: 'Config', icon: <SettingOutlined />,
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
        <Form name={uniqueKey+'_install_form'} form={formInstall} autoComplete="off" labelCol={{ span: 6, }} wrapperCol={{ span: 18, }} initialValues={webhostObject}>
          <Form.Item label="Title" name="title">
            <Input autoComplete="off" autoCapitalize="off" autoCorrect="off" disabled={!!webhostObject.target} />
          </Form.Item>
          <Form.Item name="containerName" label="Container Name" >
            <Input autoComplete="off" autoCapitalize="off" autoCorrect="off" placeholder="Enter container name. Default: oyhost" disabled={!!webhostObject.target} />
          </Form.Item>
          <Form.Item name="port" label="Port" rules={[ { validator: validatePortMapping }]}>
            <Input autoComplete="off" autoCapitalize="off" autoCorrect="off" placeholder="Enter port mapping. Default: 19790:19790" disabled={!!webhostObject.target} />
          </Form.Item>
          <Form.Item name="initScript" label="Initialization" tooltip={<><p>Initialize the container with this script.</p><p>It will be executed after the container is created.</p><p>Do not include single quote(') in the script</p></>}>
            { editorType==='monaco' ?
              <CodeiumEditor height={'auto'} // autoHeight in Form.Item has a bug
                className='codeCmd withScrollContent'
                theme={customTheme.isDark?'vs-dark':'light'}
                value={codeValue}
                defaultLanguage='shell'
                onChange={onCodeChange}
                options={{
                  minimap: { enabled: false },
                  wordWrap: 'off',
                  scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible',
                  },
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                }}
                onMount={(editor, monaco) => {
                  editor.onDidChangeModelDecorations(() => {
                    updateEditorHeight() // typing
                    requestAnimationFrame(updateEditorHeight) // folding
                  })
                  const updateEditorHeight = () => {
                    const editorElement = editor.getDomNode()
                    if (!editorElement) {
                      return
                    }
                    const padding = 58
                    const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight)
                    const lineCount = editor.getModel()?.getLineCount() || 1
                    const height = editor.getTopForLineNumber(lineCount + 0) + lineHeight + padding
                    if (prevHeight !== height) {
                      prevHeight = height
                      editorElement.style.height = `${height}px`
                      editor.layout()
                    }
                  }
                  updateEditorHeight()
                }}
              /> :
              <CodeMirror className='codeCmd withScrollContent'
                theme={customTheme.isDark?solarizedDark:solarizedLight}
                basicSetup={{highlightActiveLine:false}}
                value={codeValue||''}
                extensions={[loadLanguage('shell')]}
                onChange={onCodeChange}
                onStatistics={(data)=>{
                  // console.log(data)
                }}
                readOnly={!!webhostObject.target}
              />
            }
          </Form.Item>
          <Form.List name="volumes">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <>
                    <Form.Item wrapperCol={{ offset: index === 0 ? 0 : 6, span: 18, }}
                      label={index === 0 ? <>{!!webhostObject.target ? null : <Button type="link" onClick={() => add()} icon={<PlusOutlined />}></Button>}Volumes</> : null}
                      tooltip={<>You probably want to add ~/.ssh so that the container can access your SSH keys{!!webhostObject.target ? null : <Button size='small' hidden={!!webhostObject.target} onClick={() => {add({'volume':'~/.ssh:/root/.ssh'});}}>Add it for me</Button>}</>}
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
                { (formInstall.getFieldValue('volumes')||[]).length !== 0 ? null :
                <Form.Item wrapperCol={{ offset: (formInstall.getFieldValue('volumes')||[]).length === 0 ? 0 : 6, span: 18, }}
                  label={(formInstall.getFieldValue('volumes')||[]).length === 0 ? <>{!!webhostObject.target ? null : <Button type="link" onClick={() => add()} icon={<PlusOutlined />}></Button>}Volumes</> : ''}
                  tooltip={<>You probably want to add ~/.ssh so that the container can access your SSH keys{!!webhostObject.target ? null : <Button size='small' onClick={() => {add({'volume':'~/.ssh:/root/.ssh'});}}>Add it for me</Button>}</>}
                >
                  {!!webhostObject.target ? null : <Button type="link" onClick={() => add()} icon={<PlusOutlined />}>Add Volume</Button>}
                </Form.Item>}
              </>
            )}
          </Form.List>
          <Form.Item label="GitHub Webhook Secret" name="github_hook_secret" tooltip={<>You probably want to mount a Python script to container's <Link component={Typography.Link} onClick={() => {
            setCurrentStep(2);
            setCurrentWorkKey('webhost_github');
          }}>/approot/src/githook.py</Link> to handle webhooks
            {!!webhostObject.target ? null : <Button size='small' onClick={() => {
              let volumes = formInstall.getFieldValue('volumes')||[]
              volumes.push({'volume':'~/githook.py:/approot/src/githook.py'});
              formInstall.setFieldValue('volumes', volumes);
            }}>Add it for me</Button>}</>}>
            <Input autoComplete="off" autoCapitalize="off" autoCorrect="off" disabled={!!webhostObject.target} />
          </Form.Item>
          <Form.Item label="Bitbucket Webhook Secret" name="bitbucket_hook_secret">
            <Input autoComplete="off" autoCapitalize="off" autoCorrect="off" disabled={!!webhostObject.target} />
          </Form.Item>
          <Form.Item wrapperCol={{ offset: 6 }}>
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
            }).catch((err) => { message.error(err.message); })
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
                  <Row justify="space-between">
                    <Col span={12}>
                      <Checkbox indeterminate={indeterminate} onChange={onCheckAllChange} checked={checkAll}>Select all</Checkbox>
                    </Col>
                    <Col span={12} style={{ textAlign: 'right' }}>
                      <Button type="primary" onClick={() => execApplyToTeams()}>Apply</Button>
                    </Col>
                  </Row>
                  <p>The members of the selected teams will be able to sign into this webhost.</p>
                  <CheckboxGroup options={plainOptions} value={checkedList} onChange={onSelectTeamChange} />
                  <Divider />
                  {
                    checkedList.length > 0 ?
                    <>
                      <p>Please set the credentials for each server so that users accessing the webhost (including Apps) can connect to it.</p>
                      <Table size="small" columns={[
                        { title: 'Team', dataIndex: 'tname', key: 'tname', },
                        { title: 'Server', dataIndex: 'serverKey', key: 'serverKey', },
                        { title: 'Credential', dataIndex: 'cred', key: 'cred', width: '120px', },
                        { title: '', key: 'action', width: '40px', render: (text, record) => (
                          <>
                            <Button type="text" icon={<EditOutlined />} onClick={() => {
                              credForServer.current = record.serverKey;
                              credForTeam.current = record.tid;
                              setVisibleWebsiteCredentials(true);
                            }}></Button>
                          </>
                        ) },
                        ]} dataSource={
                          Object.entries(userSession.teams).flatMap(([tid, team]) =>
                            (team.server_items || []).map(server => (checkedList.includes(tid) && {
                                tid: tid,
                                tname: team.tname,
                                serverKey: server.key,
                                serverName: server.name,
                                cred: credentialMapping[tid]&&credentialMapping[tid][server.key],
                            })).filter(x => x)
                          )
                        } rowKey="key">
                      </Table>
                    </> : null
                  }
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
                        <Tooltip title="New schedule"><Button type="text" icon={<PlusOutlined />} onClick={() => {
                          setShowScheduleForm(true);
                          setTimeout(() => {
                            scheduleFormRef.current&&scheduleFormRef.current.setFormValues({});
                          }, 100);
                        } } /></Tooltip>
                        <Tooltip title="Delete all"><Button type="text" icon={<DeleteFilled />} onClick={() => {
                          modal.confirm({
                            title: 'Are you sure you want to delete all schedule?',
                            content: `All schedules will be deleted.`,
                            icon: <QuestionCircleFilled />,
                            onOk: () => {
                              callApi('setSchedule', {obh: webhostObject.obh, schedule: [] }).then((data) => {
                                if(data && data.errinfo) {
                                  message.error(data.errinfo);
                                } else if(data && data.sites){
                                  message.success('Deleted successfully');
                                  setUserSession({...userSession, sites: data.sites});
                                  setWebHostObject( data.sites.find((item) => item.key === webhostObject.key) );
                                }
                              }).catch((err) => { message.error(err.message); })
                            },
                            onCancel() {},
                          })
                        } } /></Tooltip>
                        <Divider type="vertical" />
                        <Tooltip title="Start all"><Button type="text" icon={<CaretRightOutlined />} onClick={() => {
                          if(webhostObject.schedules&&webhostObject.schedules.length) {
                            modal.confirm({
                              title: 'Are you sure you want to start all schedule?',
                              content: `All schedules will be started.`,
                              icon: <QuestionCircleFilled />,
                              onOk: () => {
                                callApi('setSchedule', {obh: webhostObject.obh, schedule: webhostObject.schedules.map((item) => { item.running = true; item.oldkey = item.title; return item; }) }).then((data) => {
                                  if(data && data.errinfo) {
                                    message.error(data.errinfo);
                                  } else if(data && data.sites){
                                    message.success('Started successfully');
                                    setUserSession({...userSession, sites: data.sites});
                                    setWebHostObject( data.sites.find((item) => item.key === webhostObject.key) );
                                  }
                                }).catch((err) => { message.error(err.message); })
                              },
                              onCancel() {},
                            })
                          }else{
                            message.warning('No schedule to start');
                          }
                        } } /></Tooltip>
                        <Tooltip title="Stop all"><Button type="text" icon={<PauseOutlined />} onClick={() => {
                          if(webhostObject.schedules&&webhostObject.schedules.length) {
                            modal.confirm({
                              title: 'Are you sure you want to stop all schedule?',
                              content: `All schedules will be stoped.`,
                              icon: <QuestionCircleFilled />,
                              onOk: () => {
                                callApi('setSchedule', {obh: webhostObject.obh, schedule: webhostObject.schedules.map((item) => { item.running = false; item.oldkey = item.title; return item; }) }).then((data) => {
                                  if(data && data.errinfo) {
                                    message.error(data.errinfo);
                                  } else if(data && data.sites){
                                    message.success('Stoped successfully');
                                    setUserSession({...userSession, sites: data.sites});
                                    setWebHostObject( data.sites.find((item) => item.key === webhostObject.key) );
                                  }
                                }).catch((err) => { message.error(err.message); })
                              },
                              onCancel() {},
                            })
                          }else{
                            message.warning('No schedule to stop');
                          }
                        } } /></Tooltip>
                        <Divider type="vertical" />
                        <Tooltip title="Logs"><Button type="text" icon={<RxActivityLog />} onClick={() => {
                          if(webhostObject.schedules&&webhostObject.schedules.length) {
                            modal.info({
                              title: 'Schedules Log',
                              content: <ScheduleLogViewer obh={webhostObject.obh} sch={''} tid={webhostObject.schedules[0].tid} tname={webhostObject.schedules[0].tname} />,
                              width: '80%',
                              okText: 'Close',
                              icon: null,
                            })
                          }
                        } } /></Tooltip>
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
                                    setWebHostObject( data.sites.find((item) => item.key === webhostObject.key) );
                                  }
                                }).catch((err) => { message.error(err.message); })
                              },
                              onCancel() {},
                            })
                          } }/></Tooltip>
                          <Divider style={{ margin: '10px 0' }} />
                          <Tooltip placement="bottom" title={item.running ? 'Stop' : 'Start'}><Button type={item.running ? "default" : "primary"} danger={item.running ? 'true' : null} icon={item.running ? <PauseOutlined /> : <CaretRightOutlined />} onClick={() => {
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
                                    setWebHostObject( data.sites.find((item) => item.key === webhostObject.key) );
                                  }
                                }).catch((err) => { message.error(err.message); })
                              },
                              onCancel() {},
                            })
                          } }/></Tooltip>&nbsp;
                          <Tooltip placement="bottom" title="View log"><Button icon={<RxActivityLog />} onClick={() => {
                            modal.info({
                              title: 'Schedule Log - ' + item.title,
                              content: <ScheduleLogViewer obh={webhostObject.obh} sch={item.title} tid={item.tid} tname={item.tname} />,
                              width: '80%',
                              okText: 'Close',
                              icon: null,
                            })
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
            { key: 'webhost_github', label: 'Github webhook', children: <>
              <Typography style={{ marginTop: '20px' }} >
                <Link component={Typography.Link} onClick={
                  () => {
                    if(isDesktopVersion){ // Won't have the webhost management in other versions
                      callApi('openUrlInBrowser', {url: 'https://docs.github.com/en/webhooks'}).catch((err) => { message.error(err.message); })
                    }
                  }} >GitHub Webhooks documentation</Link>
                <Paragraph style={{ marginTop: '20px' }}>
                  <ol>
                    <li>URL: <code className='enableHighlight'>{webhostObject.obh}/webhook/github</code></li>
                    <li>Mount a Python script to the container's <code className='enableHighlight'>/approot/src/githook.py</code> like below to handle webhooks</li>
                  </ol>
                </Paragraph>
                <pre className='enableHighlight'><code>{githookDemo}</code></pre>
              </Typography>
            </> },
            { key: 'webhost_bitbucket', label: 'Bitbucket hook', children: <>
              <Typography style={{ marginTop: '20px' }} >
                <Link component={Typography.Link} onClick={
                  () => {
                    if(isDesktopVersion){ // Won't have the webhost management in other versions
                      callApi('openUrlInBrowser', {url: 'https://support.atlassian.com/bitbucket-cloud/docs/manage-webhooks/'}).catch((err) => { message.error(err.message); })
                    }
                  }} >Bitbucket Webhooks documentation</Link>
                <Paragraph style={{ marginTop: '20px' }}>
                  <ol>
                    <li>URL: <code className='enableHighlight'>{webhostObject.obh}/webhook/bitbucket</code></li>
                    <li>Mount a Python script to the container's <code className='enableHighlight'>/approot/src/githook.py</code> like below to handle webhooks</li>
                  </ol>
                </Paragraph>
                <pre className='enableHighlight'><code>{githookDemo}</code></pre>
              </Typography>
            </> },
          ]}
        />
        <Modal title={"Schedule Task (Team: "+userSession.tname+")"} open={showScheduleForm} onOk={handleScheduleOk} onCancel={handleScheduleCancel}
          okText={formSaving ? "Saving..." : "Save"} cancelText="Cancel"
          okButtonProps={{ loading: formSaving }}
          cancelButtonProps={{ disabled: formSaving }}>
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

      {/* Credentials for servers */}
      <WebsiteCredentials obh={webhostObject.obh} visible={visibleWebsiteCredentials} onCancel={handleCredentialsCancel} onChoose={handleCredentialsChoose} onRemove={handleCredentialsRemove} initialMode="choose" credentialListing={credentialListing} setCredentialListing={setCredentialListing} />
      {/* For sudo password */}
      <TextInputModal visible={showSudoPassword} defaultValue={""} title={"Permission denied"} onCreate={sudoWithPassword} onCancel={() => setShowSudoPassword(false)} placeholder={"Enter sudo password"} description='Sudo with the password or Cancel' password={true}></TextInputModal>
    </div>
  );
}

export default WebsiteManage;
