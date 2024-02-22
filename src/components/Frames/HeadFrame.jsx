import React from 'react';
import { App, Dropdown, Space, Col, Row, Button, Switch, theme } from 'antd';
import { CheckOutlined } from "@ant-design/icons";
import { BsThreeDots } from "react-icons/bs";

import { useCustomContext } from '../Contexts/CustomContext'

import SearchInput from './SearchInput';
import SearchLanguage from './SearchLanguage';

import './HeadFrame.css';
import { callApi } from '../Common/global';

const { useToken } = theme;
const HeadFrame = () => {
  const { message } = App.useApp();
  const { searchMode, customTheme, toggleCustomTheme, userSession } = useCustomContext();
  const { token } = useToken();
  const contentStyle = {
    backgroundColor: token.colorBgElevated,
    borderRadius: token.borderRadiusLG,
    boxShadow: token.boxShadowSecondary,
  };
  const menuStyle = {
    boxShadow: 'none',
  };

  const getTeamMenus = function() {
    const menus = [];
    if(userSession){
      menus.push({ key: 'menuManageTeams', label: ( 'Manage Teams' ), } )
      menus.push({ key: 'menuReloadTeams', label: ( 'Refresh Teams' ), } )
      menus.push({ type: 'divider', } )
    }
    if(userSession && userSession.teams) {
      for (const teamId in userSession.teams) {
        const team = userSession.teams[teamId];
        const teamMenu = {
          key: teamId,
          type: "group",
          label: team.tname,
          children: []
        };
        for (const workspaceId in team.workspaces) {
          const workspace = team.workspaces[workspaceId];
          const workspaceMenu = {
            key: workspaceId,
            label: workspace.wname,
            icon: userSession.work0 === workspaceId ? <CheckOutlined /> : undefined
          };
          teamMenu.children.push(workspaceMenu);
        }
        menus.push(teamMenu);
      }
    }
    if(menus.length > 0) {
      menus.push({ type: 'divider', });
    }
    return menus;
  };

  const reloadEverything = () => {
    window.reloadUserSession && window.reloadUserSession();
    window.reloadServerList && window.reloadServerList();
    window.reloadTaskList && window.reloadTaskList();
    window.reloadPipelineList && window.reloadPipelineList();
  }
  const menuItems = [
    ...getTeamMenus(),
    // { key: 'menuTest3', label: ( 'testApi' ), },
  ];
  const onClickMenu = ({ key }) => {
    if(key === 'menuManageTeams') {
    }else if(key === 'menuReloadTeams') {
      callApi('reloadUserSession', {}).then((res) => {
        reloadEverything();
        message.success('Your teams has been refreshed');
      });
    }else if(key === 'menuTest3') {
      callApi('testApi', {}).then((res) => {
        message.info(JSON.stringify(res));
      })
    }else{
      // If key is workspaceId, switch workspace
      let existsInWorkspaces = false;
      if(userSession && userSession.teams){
        for (const teamId in userSession.teams) {
          const team = userSession.teams[teamId];
          const workspaces = team.workspaces;
          if (key !== userSession.work0 && workspaces && key in workspaces) {
            existsInWorkspaces = true;
            break;
          }
        }
        if (existsInWorkspaces) {
          callApi('switchToWorkspace', {wid: key}).then((res) => {
            reloadEverything();
            message.success('Switched to ' + userSession.teams[userSession.team0].workspaces[key].wname);
          });
        } else {
          // Workspace not found
        }
      }
    }
  };

  return (
    <Row wrap={false} className='ant-layout-header' style={{ position: 'relative', overflow: 'visible', zIndex: 3 }}>
      <Col flex="auto" style={{ textAlign: 'center' }}>
        {searchMode === 'language'
          ? <SearchLanguage style={{ width: '100%' }}></SearchLanguage>
          : <SearchInput style={{ width: '100%' }}></SearchInput>
        }
      </Col>
      <Col flex="none">
        <Dropdown menu={{ items: menuItems, onClick: onClickMenu }} placement="topLeft" trigger={['click']}
          dropdownRender={(menu) => (
            <div style={contentStyle}>
              {React.cloneElement(menu, { style: menuStyle })}
              <Space style={{ padding: '8px 16px' }}>
                Theme: <Switch checkedChildren="Light" unCheckedChildren="Dark" defaultChecked={!customTheme.isDark} onChange={toggleCustomTheme} />
              </Space>
            </div>
          )}
        >
          <Button type='text' icon={<BsThreeDots />}></Button>
        </Dropdown>
      </Col>
    </Row>
  )
};
export default HeadFrame;
