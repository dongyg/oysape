import React from 'react';
import { App, Dropdown, Space, Switch, Avatar, theme } from 'antd';
import { CheckOutlined, ReloadOutlined, SettingOutlined, LogoutOutlined, QuestionCircleFilled, UserOutlined } from "@ant-design/icons";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, delTokenFromCookie } from './global';

const { useToken } = theme;

export default function ProfileButton() {
  const { message, modal } = App.useApp();
  const { customTheme, toggleCustomTheme, userSession, setUserSession } = useCustomContext();
  const { token } = useToken();
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
  const getTeamMenus = function() {
    const menus = [];
    if(userSession && userSession.teams) {
      for (const teamId in userSession.teams) {
        const team = userSession.teams[teamId];
        const teamMenu = {
          key: teamId,
          // type: "group",
          label: team.tname,
          icon: userSession.team0 === teamId ? <CheckOutlined /> : undefined,
        };
        menus.push(teamMenu);
      }
    }
    if(menus.length > 0) {
      menus.push({ type: 'divider', });
    }
    return menus;
  };
  const getSignInTitle = () => {
    if(userSession && userSession.email && userSession.github_user) {
      return userSession.email + ' (GitHub)'
    } else if(userSession && userSession.email && userSession.google_user) {
      return userSession.email + ' (Google)'
    } else if(userSession && userSession.email) {
      return userSession.email
    } else {
      return 'Sign In'
    }
  }
  const reloadEverything = (callDone) => {
    callApi('reloadUserSession', {}).then((res) => {
      setUserSession(res);
      window.reloadFolderFiles && window.reloadFolderFiles();
      if(callDone) callDone();
    });
  }
  const menuItems = [
    { type: 'divider', },
    ...getTeamMenus(),
    {
      key: 'menuSignIn',
      type: userSession ? 'group' : undefined,
      label: getSignInTitle(),
      children: userSession ? [
        { key: 'menuReloadTeams', label: 'Reload everything', icon: <ReloadOutlined />, },
        { key: 'menuAccount', label: ('Manage Account'), icon: <SettingOutlined />, },
        { key: 'menuSignOut', label: ('Sign Out'), icon: <LogoutOutlined />, },
      ] : undefined,
    },
    // { type: 'divider', },
    // { key: 'menuTest3', label: ( 'testApi' ), },
  ];
  const onClickMenu = ({ key }) => {
    if(key === 'menuManageTeams') {
      window.openWebpageInTab && window.openWebpageInTab('http://localhost:8080/index.html', 'Webpage Demo');
    }else if(key === 'menuReloadTeams') {
      reloadEverything(() => {
        message.success('Reloaded');
      });
    }else if(key === 'menuSignIn') {
      delTokenFromCookie();
      setUserSession({});
    } else if(key === 'menuAccount') {
      callApi('gotoAccountDashboard', {}).then((res) => {});
    } else if(key === 'menuSignOut') {
      modal.confirm({
        title: 'Confirm to Sign Out',
        icon: <QuestionCircleFilled />,
        content: 'Are you sure you want to sign out?',
        onOk() {
          delTokenFromCookie();
          setUserSession({});
        },
        onCancel() {
          console.log('Cancel');
        },
      });
    }else if(key === 'menuTest3') {
      callApi('testApi', {}).then((res) => {
        message.info(JSON.stringify(res));
      })
    }else{
      // If key is teamId, switch team
      if(userSession && userSession.teams){
        if (key !== userSession.team0 && key in userSession.teams) {
          callApi('switchToTeam', {tid: key}).then((res) => {
            reloadEverything(() => {
              message.success('Switched to ' + userSession.teams[key].tname);
            });
          });
        } else {
          // Team not found
        }
      }
    }
  };

  return (
    <Dropdown menu={{ items: menuItems, onClick: onClickMenu }} placement="topRight" trigger={['click']}
      dropdownRender={(menu) => (
        <div style={contentStyle}>
          <Space style={{ padding: '8px 16px' }}>
            Theme: <Switch checkedChildren="Light" unCheckedChildren="Dark" defaultChecked={!customTheme.isDark} onChange={toggleCustomTheme} />
          </Space>
          {React.cloneElement(menu, { style: menuStyle })}
        </div>
      )}
    >
      { getAvatar() }
    </Dropdown>
)
}