import React from 'react';
import { Col, Row, Button, } from 'antd';
import { MenuUnfoldOutlined, MenuFoldOutlined } from "@ant-design/icons";

import { useCustomContext } from '../Contexts/CustomContext'
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'
import ProfileButton from '../Common/ProfileButton'
import SearchInput from './SearchInput';
import SearchLanguage from './SearchLanguage';

import './HeadFrame.css';

const HeadFrame = () => {
  const { searchMode, hideSidebar, setHideSidebar, currentSideKey, setCurrentSideKey, userSession } = useCustomContext();

  const handleShowSidebar = () => {
    setHideSidebar(!hideSidebar);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }

  useKeyPress(keyMapping["gotoSideServer"], (event) => {
    if((currentSideKey==='sideServer' && !hideSidebar) || hideSidebar){
      handleShowSidebar();
    }
    setCurrentSideKey('sideServer');
    event.preventDefault(); return;
  });
  useKeyPress(keyMapping["gotoSideTask"], (event) => {
    if((currentSideKey==='sideTask' && !hideSidebar) || hideSidebar){
      handleShowSidebar();
    }
    setCurrentSideKey('sideTask');
    event.preventDefault(); return;
  });
  useKeyPress(keyMapping["gotoSidePipeline"], (event) => {
    if((currentSideKey==='sidePipeline' && !hideSidebar) || hideSidebar){
      handleShowSidebar();
    }
    setCurrentSideKey('sidePipeline');
    event.preventDefault(); return;
  });
  useKeyPress(keyMapping["gotoSideSftp"], (event) => {
    if(userSession.accesses.sftp){
      if((currentSideKey==='sideSftp' && !hideSidebar) || hideSidebar){
        handleShowSidebar();
      }
      setCurrentSideKey('sideSftp');
      event.preventDefault(); return;
    }
  });
  useKeyPress(keyMapping["gotoSideDocker"], (event) => {
    if(userSession.accesses.docker){
      if((currentSideKey==='sideDocker' && !hideSidebar) || hideSidebar){
        handleShowSidebar();
      }
      setCurrentSideKey('sideDocker');
      event.preventDefault(); return;
    }
  });
  useKeyPress(keyMapping["gotoSideExplorer"], (event) => {
    if(userSession.accesses.files){
      if((currentSideKey==='sideExplorer' && !hideSidebar) || hideSidebar){
        handleShowSidebar();
      }
      setCurrentSideKey('sideExplorer');
      event.preventDefault(); return;
    }
  });

  return (
    <Row wrap={false} className='ant-layout-header' style={{ position: 'relative', overflow: 'visible', zIndex: 3 }}>
      <Col flex="none" style={{ lineHeight: 'initial' }}>
        <Button type='text' icon={hideSidebar? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={handleShowSidebar}></Button>
      </Col>
      <Col flex="auto" style={{ lineHeight: 'initial', textAlign: 'center' }}>
        {searchMode === 'language'
          ? <SearchLanguage style={{ width: '100%' }}></SearchLanguage>
          : <SearchInput style={{ width: '100%' }}></SearchInput>
        }
      </Col>
      <Col flex="none" style={{ lineHeight: 'initial' }}>
        <ProfileButton />
      </Col>
    </Row>
  )
};
export default HeadFrame;
