import React, {useEffect, useRef, useState, useCallback} from 'react';
import { App, Dropdown, Space, Switch, Avatar, theme, notification, Button } from 'antd';
import { CheckOutlined, ReloadOutlined, SettingOutlined, LogoutOutlined, QuestionCircleFilled, UserOutlined, KeyOutlined, AppleFilled } from "@ant-design/icons";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, getCredentials, delTokenFromCookie, isDesktopVersion, isMobileVersion } from './global';
import AntIcon from '../Common/AntIcon';
// import CredentialsModal from '../Server/CredentialsModal';
import WebsiteCredentials from '../Websites/WebsiteCredentials';

const { useToken } = theme;

export default function ProfileButton() {
  const { message, modal } = App.useApp();
  const [api, contextHolder] = notification.useNotification();
  const { customTheme, toggleCustomTheme, userSession, setUserSession, editorType, setEditorType } = useCustomContext();
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
    } else if (userSession.last_login_agent === 'Apple') {
      return <Avatar icon={<AppleFilled />} size={size} />;
    } else {
      return <Avatar icon={<UserOutlined />} size={size} />;
    }
  }
  const getTeamMenus = function() {
    const menus = [];
    if(userSession && userSession.teams) {
      for (const teamId in userSession.teams) {
        const teamObj = userSession.teams[teamId];
        const teamMenu = {
          key: teamId,
          // type: "group",
          label: teamObj.tname,
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
    callApi('reloadUserSession', {credentials: getCredentials()}).then((res) => {
      setUserSession(res);
      window.reloadFolderFiles && window.reloadFolderFiles();
      if(callDone) callDone();
    });
  }
  window.reloadEverything = reloadEverything;
  const menuItems = [
    {
      key: 'menuCodeEditors',
      label: 'Code Editors',
      children: [
        { key: 'menuCodeiumAI', label: 'AI Editor', icon: editorType==='monaco'?<CheckOutlined />:null, },
        { key: 'menuCodeMirror5', label: 'Code Mirror', icon: editorType!=='monaco'?<CheckOutlined />:null, },
      ],
    },
    { type: 'divider', },
    ...getTeamMenus(),
    {
      key: 'menuSignIn',
      type: userSession ? 'group' : undefined,
      label: getSignInTitle(),
      children: userSession ? [
        { key: 'menuReloadTeams', label: 'Reload everything', icon: <ReloadOutlined />, },
        { key: 'menuAccount', label: <>My {isMobileVersion?'Dashboard':'Account'}</>, icon: <SettingOutlined />, },
        { key: 'menuCredentials', label: ('My Credentials'), icon: <KeyOutlined />, },
        { type: 'divider', },
        { key: 'menuSignOut', label: ('Sign Out'), icon: <LogoutOutlined />, },
      ] : undefined,
    },
    process.env.NODE_ENV === 'development' ? { type: 'divider', } : undefined,
    process.env.NODE_ENV === 'development' ? { key: 'menuTest3', label: ( 'testApi' ), } : undefined,
  ];
  const onClickMenu = ({ key }) => {
    if(key === 'menuCodeMirror5') {
      setEditorType('codemirror5');
    }else if(key === 'menuCodeiumAI') {
      setEditorType('monaco');
    // }else if(key === 'menuManageTeams') {
    //   window.openWebpageInTab && window.openWebpageInTab('http://localhost:8080/index.html', 'Webpage Demo');
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
      if(isMobileVersion && window.cooData && window.cooData.oywebHost) {
        window.location.href = window.cooData.oywebHost+'/mob/home';
      } else {
        callApi('gotoAccountDashboard', {}).then((res) => {
          if(res?.errinfo) {
            message.error(res.errinfo);
          } else if(res?.url) {
            if(isMobileVersion) {
              window.location.href = res.url;
            } else {
              window.open(res.url);
            }
          }
        })
      };
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
          } else if (isMobileVersion) {
            callApi('signout', {}).then((res) => {
              if(res?.errinfo) {
                message.error(res.errinfo);
              } else if (res?.url) {
                window.location.href = res.url;
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
      console.log(JSON.stringify(userSession.credentials, null, 4));
      console.log(userSession.team0);
      // window.openWebpageInTab && window.openWebpageInTab('https://aifetel.cc', 'aifetel.cc');
      // window.openWebpageInTab && window.openWebpageInTab('https://codeium.com/live/general', 'Codeium');
      // callApi('testApi', {}).then((res) => {
      //   console.log('res', res);
      // })
      // openRemoteNotification(userSession.notifications);
    }else{
      // If key is teamId, switch team
      if(userSession && userSession.teams){
        if (key !== userSession.team0 && key in userSession.teams) {
          callApi('switchToTeam', {tid: key, credentials: getCredentials()}).then((res) => {
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

  const openRemoteNotification = useCallback((notis) => {
    for(let noti of (notis||[])) {
      if(noti && noti.client && ((isDesktopVersion && noti.client.includes('desktop')) || (isMobileVersion && noti.client.includes('mobile')) || (!isDesktopVersion && !isMobileVersion && noti.client.includes('webhost')))) {
        const key = noti.key || ('notification_' + Math.random());
        let option = {
          key: key,
          message: (noti&&noti.title)||'test',
          description: <div dangerouslySetInnerHTML={{ __html: ((noti&&noti.content))||'test' }} />,
          icon: noti&&noti.icon ? <AntIcon name={noti.icon} /> : null,
          placement: 'bottomRight',
          duration: noti.hasOwnProperty('duration') ? noti.duration : 11,
        }
        if(noti.btnText) {
          option.btn = <Space>
            <Button type="primary" onClick={() => {
              if(key==='NewVersionAvailable' && noti.version){
                callApi('downloadNewVersion', {version: noti.version}).then((res) => {
                  console.log(res);
                });
              }else if(key.startsWith('Promotion')){
                callApi('callPromotion', noti).then((res) => {
                  if(res?.errinfo) {
                    message.error(res.errinfo);
                  } else if(res.client && res.title) {
                    openRemoteNotification([res]);
                  }
                })
              }
              api.destroy(key);
            }}>{noti.btnText}</Button>
          </Space>
        } else {
          option.onClick = () => {
            if(noti.intab) {
              window.openWebpageInTab && window.openWebpageInTab(noti.intab, noti.title||noti.intab);
            }else if(noti.url) {
              callApi('openUrlInBrowser', {url: noti.url}).then((res) => {
              });
            }
            api.destroy(key);
          }
        }
        setTimeout(() => {
          api[(noti.type&&['success', 'info', 'warning', 'error'].includes(noti.type)?noti.type:'info')||'info'](option);
        }, noti.delay||(Math.random()*10000));
      }
    }
  }, [api, message]);

  const handleCredentialsCancel = () => {
    setVisibleCredentialsModal(false);
  }

  useEffect(() => {
    openRemoteNotification(userSession.notifications);
  }, [userSession.notifications, openRemoteNotification]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      console.log('before unload');
      if(!isSignOut.current) event.returnValue = 'Are you sure you want to leave?';
    };

    if(!(isDesktopVersion || isMobileVersion)) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <>
      {contextHolder}
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
      {/* <CredentialsModal visible={visibleCredentialsModal} onCancel={handleCredentialsCancel} onChoose={handleCredentialsChoose} initialMode="list" /> */}
      <WebsiteCredentials obh={'localhost'} visible={visibleCredentialsModal} initialMode="list" onCancel={handleCredentialsCancel} initTitle={'My Credentials'} />
    </>
  );
}