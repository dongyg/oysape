import React, { useState } from 'react'
import { App, Dropdown, Button, Typography, Steps, Tabs, Checkbox, Divider } from 'antd';

import { DeleteOutlined, QuestionCircleFilled } from '@ant-design/icons';
import { SolutionOutlined, } from "@ant-design/icons";
import { RiInstallLine, RiUninstallLine } from "react-icons/ri";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi } from '../Common/global';

const CheckboxGroup = Checkbox.Group;
const { Title } = Typography;

const WebsiteManage = ({ uniqueKey, websiteKey, websiteObject}) => {
  const { message, modal } = App.useApp();
  const { customTheme, userSession, setUserSession } = useCustomContext();
  const [webhostObject, setWebHostObject] = useState(websiteObject);
  const [currentWorkKey, setCurrentWorkKey] = useState('webhost_teams');

  const plainOptions = Object.values(userSession.teams).map(item => item.tname);
  const defaultCheckedList = Object.values(userSession.teams).map(item => item.allow_sites.includes(websiteObject.obh) ? item.tname : null).filter(x => x);
  const [checkedList, setCheckedList] = useState(defaultCheckedList);
  const checkAll = plainOptions.length === checkedList.length;
  const indeterminate = checkedList.length > 0 && checkedList.length < plainOptions.length;
  const onChange = (list) => {
    setCheckedList(list);
  };
  const onCheckAllChange = (e) => {
    setCheckedList(e.target.checked ? plainOptions : []);
  };

  const comingSoon = <Title style={{ textAlign: 'center', marginTop: '60px' }}>Coming soon</Title>;
  const unavailable = <Title style={{ textAlign: 'center', marginTop: '60px' }}>Please install and verify first</Title>;

  const execVerify = (obh) => {
    modal.confirm({
      title: 'Confirm to Verify Webhost',
      icon: <QuestionCircleFilled />,
      content: 'Are you sure you want to verify webhost ' + obh + '?',
      onOk() {
        callApi('verifyWebHost', {obh: obh}).then((data) => {
          if(data && data.errinfo) {
            message.error(data.errinfo);
          }else if(data && data.sites){
            message.success('Verified successfully');
            setUserSession({...userSession, sites: data.sites});
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
      title: 'Confirm to Uninstall Webhost',
      icon: <QuestionCircleFilled />,
      content: 'Are you sure you want to uninstall webhost ' + obh + ' from ' + target + '?',
      onOk() {
        callApi('uninstallWebHost', {obh: obh}).then((data) => {
          if(data && data.errinfo) {
            message.error(data.errinfo);
          }else if(data && data.sites){
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
  const execInstall = (obh, target) => {
    callApi('installWebHost', {obh: obh, target: target}).then((data) => {
      if(data && data.errinfo) {
        message.error(data.errinfo);
      }else if(data && data.sites){
        setUserSession({...userSession, sites: data.sites});
        setWebHostObject( data.sites.filter((item) => item.key === obh)[0] );
      }
    })
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

  return (
    <div className={customTheme.className+' withScrollContent'} style={{ backgroundColor: customTheme.colors["editor.background"], color: customTheme.colors["editor.foreground"], height: '100%', padding: '24px', overflowY: 'auto', overflowX: 'hidden', }}>
      <Steps labelPlacement="vertical"
        items={[
          { title: 'Install', icon: <RiInstallLine />,
            description: !webhostObject.target ?
              <Dropdown menu={{ items: userSession.servers.map((item) => {return {key: item.key, label: item.name}}), onClick: ({key}) => execInstall(webhostObject.obh, key) }} trigger={['click']}>
                <Button size='small'>Install on</Button>
              </Dropdown>
              : webhostObject.target,
            status: 'finish',
          },
          { title: 'Verify', icon: <SolutionOutlined />,
            description: webhostObject.target&&!webhostObject.verified ? <Button size='small' onClick={() => execVerify(webhostObject.obh)}>Verify</Button> : (webhostObject.verified?'Verified':null),
            status: 'finish',
          },
          { title: 'Uninstall', icon: <RiUninstallLine />,
            description: webhostObject.target ? <Button size='small' onClick={() => execUninstall(webhostObject.obh, webhostObject.target)}>Uninstall</Button> : null,
            status: 'finish',
          },
          { title: 'Delete', icon: <DeleteOutlined />,
            description: !webhostObject.target&&!webhostObject.verified ? <Button size='small' onClick={() => execDelete(webhostObject.obh)}>Delete</Button> : null,
            status: 'finish',
          },
        ]}
      />
      <Tabs  activeKey={currentWorkKey} onChange={(key) => { setCurrentWorkKey(key); }}
        items={[
          { key: 'webhost_teams', label: 'Applied Teams', children: <>
            {webhostObject.target && webhostObject.verified ?
              <div style={{ marginTop: '40px' }}>
                <Checkbox indeterminate={indeterminate} onChange={onCheckAllChange} checked={checkAll}>
                  Select all
                </Checkbox>
                <Divider />
                <CheckboxGroup options={plainOptions} value={checkedList} onChange={onChange} />
                <Divider />
                <Button type="primary" onClick={() => execApplyToTeams()}>Apply</Button>
              </div>
            : unavailable}
          </> },
          { key: 'webhost_scheduled', label: 'Scheduled Works', children: comingSoon },
          { key: 'webhost_github', label: 'Github webhook', children: comingSoon },
          { key: 'webhost_bitbucket', label: 'Bitbucket hook', children: comingSoon },
        ]}
      />
    </div>
  );
}

export default WebsiteManage;
