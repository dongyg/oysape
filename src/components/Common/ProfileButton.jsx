import React from 'react';
import { Dropdown, Space, Divider, Button, Switch, Avatar, theme } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { BsPerson, BsGear } from "react-icons/bs";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi } from './global';

const { useToken } = theme;

export default function ProfileButton() {
  const { token } = useToken();
  const { customTheme, toggleCustomTheme, userSession } = useCustomContext();
  const contentStyle = {
    backgroundColor: token.colorBgElevated,
    borderRadius: token.borderRadiusLG,
    boxShadow: token.boxShadowSecondary,
  };
  const menuStyle = {
    boxShadow: 'none',
  };

  const getAvatar = (size) => {
    if(userSession && userSession.github_user && userSession.github_user.avatar_url) {
      return <Avatar src={userSession.github_user.avatar_url} size={size} />
    } else if(userSession && userSession.google_user && userSession.google_user.picture) {
      return <Avatar src={userSession.google_user.picture} size={size} />
    } else {
      return <Avatar icon={<UserOutlined />} size={size} />
    }
  }
  const getSignInTitle = () => {
    if(userSession && userSession.email && userSession.github_user) {
      return userSession.email + ' (GitHub)'
    } else if(userSession && userSession.email && userSession.google_user) {
      return userSession.email + ' (Google)'
    } else {
      return 'Sign In'
    }
  }
  const menuItems = [
    { key: 'menuSettings', label: ('Settings'), icon: <BsGear />, },
    // { key: '2', label: ( '2nd menu item (disabled)' ), disabled: true, },
    // { key: '3', label: ( '3rd menu item' ), },
    { type: 'divider', },
    {
      key: 'menuSignIn',
      type: userSession ? 'group' : undefined,
      label: getSignInTitle(),
      // icon: getAvatar('small'),
      children: userSession ? [
        { key: 'menuAccount', label: ('Manage Account'), },
        { key: 'menuSignOut', label: ('Sign Out'), },
      ] : undefined,
    },
  ];
  const onClickMenu = ({ key }) => {
    if(key === 'menuSettings') {
      if(window.openProjectFile) window.openProjectFile('~/.oysape/settings.json', 'Settings');
    } else if(key === 'menuSignIn') {
      callApi('signIn', {}).then((res) => {});
    } else if(key === 'menuAccount') {
    } else if(key === 'menuSignOut') {
      callApi('signIn', {}).then((res) => {});
    }
  };

  return (
    <Dropdown menu={{ items: menuItems, onClick: onClickMenu }} placement="topLeft" trigger={['click']}
      dropdownRender={(menu) => (
        <div style={contentStyle}>
          <Space style={{ padding: '8px 16px' }}>
            Theme: <Switch checkedChildren="Light" unCheckedChildren="Dark" defaultChecked={!customTheme.isDark} onChange={toggleCustomTheme} />
          </Space>
          <Divider style={{ margin: 0 }} />
          {React.cloneElement(menu, { style: menuStyle })}
        </div>
      )}
    >
      { getAvatar() }
      {/* <Button type='text'>
        <BsPerson style={{fontSize:'2em', marginRight: '0px'}} />
      </Button> */}
    </Dropdown>
  )
}