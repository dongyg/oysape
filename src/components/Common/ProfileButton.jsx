import React from 'react';
import { Dropdown, Space, Divider, Button, Switch, theme } from 'antd';
import { BsPerson, BsGear } from "react-icons/bs";

import { useCustomContext } from '../Contexts/CustomContext'

const { useToken } = theme;

const menuItems = [
  { key: 'profile1', label: ('Settings'), icon: <BsGear />, },
  // { key: '2', label: ( '2nd menu item (disabled)' ), disabled: true, },
  // { key: '3', label: ( '3rd menu item' ), },
];
const onClickMenu = ({ key }) => {
  if(key === 'profile1') {
    if(window.openProjectFile) window.openProjectFile('~/.oysape/workspace.json', 'Settings');
  }
};

export default function ProfileButton() {
  const { token } = useToken();
  const { customTheme, toggleCustomTheme } = useCustomContext();
  const contentStyle = {
    backgroundColor: token.colorBgElevated,
    borderRadius: token.borderRadiusLG,
    boxShadow: token.boxShadowSecondary,
  };
  const menuStyle = {
    boxShadow: 'none',
  };

  return (
    <Dropdown menu={{ items: menuItems, onClick: onClickMenu }} placement="topLeft" trigger={['click']}
      dropdownRender={(menu) => (
        <div style={contentStyle}>
          <Space style={{ padding: '8px 16px' }}>
            Theme: <Switch checkedChildren="Light" unCheckedChildren="Dark" defaultChecked={!customTheme.isDark} onChange={toggleCustomTheme} />
          </Space>
          {/* <Divider style={{ margin: 0 }} />
          <Space style={{ padding: '8px 16px' }}>
            <Button type="primary">Click me!</Button>
          </Space> */}
          <Divider style={{ margin: 0 }} />
          {React.cloneElement(menu, { style: menuStyle })}
        </div>
      )}
    >
      <Button type='text'><BsPerson style={{fontSize:'2em', marginRight: '0px'}} /></Button>
    </Dropdown>
  )
}