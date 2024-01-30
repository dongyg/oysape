import React from 'react';
import { Dropdown, Space, Divider, Col, Row, Button, Switch, theme } from 'antd';
import { BsThreeDots, BsGear, BsPerson } from "react-icons/bs";

import { useCustomContext } from '../Contexts/CustomContext'

import SearchInput from './SearchInput';
import SearchLanguage from './SearchLanguage';

import './HeadFrame.css';
import { callApi } from '../Common/global';

const { useToken } = theme;
const menuItems = [
  { key: 'menuSignIn', label: ('SignIn'), icon: <BsPerson />, },
  // { key: '2', label: ( '2nd menu item (disabled)' ), disabled: true, },
  { key: 'menuTest3', label: ( 'Open website' ), },
];
const onClickMenu = ({ key }) => {
  if(key === 'menuSignIn') {
    callApi('signInWithGithub', {}, (res) => {
      console.log(res)
    })
  }else if(key === 'menuTest3') {
    callApi('openTestWindow', {}, (res) => {
      console.log(res)
    })
  }
};

const HeadFrame = () => {
  const { searchMode, customTheme, toggleCustomTheme } = useCustomContext();
  const { token } = useToken();
  const contentStyle = {
    backgroundColor: token.colorBgElevated,
    borderRadius: token.borderRadiusLG,
    boxShadow: token.boxShadowSecondary,
  };
  const menuStyle = {
    boxShadow: 'none',
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
              {/* <Divider style={{ margin: 0 }} />
              <Space style={{ padding: '8px 16px' }}>
                <Button type="primary">Click me!</Button>
              </Space> */}
              {React.cloneElement(menu, { style: menuStyle })}
              <Divider style={{ margin: 0 }} />
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
