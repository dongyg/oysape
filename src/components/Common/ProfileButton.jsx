import React, {useEffect, useRef, useState} from 'react';
import { App, Dropdown, Space, Switch, Avatar, theme } from 'antd';
import { CheckOutlined, ReloadOutlined, SettingOutlined, LogoutOutlined, QuestionCircleFilled, UserOutlined, KeyOutlined } from "@ant-design/icons";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, getCredentials, delTokenFromCookie, isDesktopVersion } from './global';
import CredentialsModal from '../Server/CredentialsModal';

const { useToken } = theme;

export default function ProfileButton() {
  const { message, modal } = App.useApp();
  const { customTheme, toggleCustomTheme, userSession, setUserSession } = useCustomContext();
  const [visibleCredentialsModal, setVisibleCredentialsModal] = useState(false);
  const { token } = useToken();
  const isSignOut = useRef(false);

  const contentStyle = {
    backgroundColor: token.colorBgElevated,
    borderRadius: token.borderRadiusLG,
    boxShadow: token.boxShadowSecondary,
  };
  const menuStyle = {
    boxShadow: 'none',
  };

  const getAvatar = (size) => {
    if (userSession.last_login_agent === 'GitHub') {
      return <Avatar src={userSession.github_user.avatar_url} size={size} />;
    } else if (userSession.last_login_agent === 'Google') {
      return <Avatar src={userSession.google_user.picture} size={size} />;
    } else {
      return <Avatar icon={<UserOutlined />} size={size} />;
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
    return userSession.last_login_agent ? userSession.email + ' (' + userSession.last_login_agent + ')' : 'Sign In';
  }
  const reloadEverything = (callDone) => {
    callApi('reloadUserSession', getCredentials()).then((res) => {
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
        { key: 'menuCredentials', label: ('My Credentials'), icon: <KeyOutlined />, },
        { key: 'menuSignOut', label: ('Sign Out'), icon: <LogoutOutlined />, },
      ] : undefined,
    },
    process.env.NODE_ENV === 'development' ? { type: 'divider', } : undefined,
    process.env.NODE_ENV === 'development' ? { key: 'menuTest3', label: ( 'testApi' ), } : undefined,
  ];
  const onClickMenu = ({ key }) => {
    if(key === 'menuManageTeams') {
      window.openWebpageInTab && window.openWebpageInTab('http://localhost:8080/index.html', 'Webpage Demo');
    }else if(key === 'menuReloadTeams') {
      reloadEverything(() => {
        message.success('Reloaded');
      });
    }else if(key === 'menuSignIn') {
      setUserSession({});
      if(isDesktopVersion){
        delTokenFromCookie();
      } else {
        window.location.href = '/signin';
      }
    } else if(key === 'menuAccount') {
      callApi('gotoAccountDashboard', {}).then((res) => {
        if(res?.errinfo) {
          message.error(res.errinfo);
        } else if(res?.url) {
          window.open(res.url);
        }
      });
    } else if(key === 'menuCredentials') {
      setVisibleCredentialsModal(true);
    } else if(key === 'menuSignOut') {
      modal.confirm({
        title: 'Confirm to Sign Out',
        icon: <QuestionCircleFilled />,
        content: 'Are you sure you want to sign out?',
        onOk() {
          if(isDesktopVersion){
            callApi('signout', {}).then((res) => {
              if(res?.errinfo) {
                message.error(res.errinfo);
              } else {
                delTokenFromCookie();
                setUserSession({});
              }
            });
          } else {
            isSignOut.current = true;
            console.log('signout. Clear user session');
            // setUserSession({});
            window.location.href = '/signout';
          }
        },
        onCancel() {
          // console.log('Cancel');
        },
      });
    }else if(key === 'menuTest3') {
      // callApi('testApi', {}).then((res) => {
      //   message.info(JSON.stringify(res));
      // })
      console.log(userSession)
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

  const handleCredentialsCancel = () => {
    setVisibleCredentialsModal(false);
  }

  const handleCredentialsChoose = (data) => {
    console.log('data', data);
  }

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      console.log('before unload');
      if(!isSignOut.current) event.returnValue = 'Are you sure you want to leave?';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userSession]);

  return (
    <>
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
      <CredentialsModal visible={visibleCredentialsModal} onCancel={handleCredentialsCancel} onChoose={handleCredentialsChoose} initialMode="list" />
    </>
)
}