import React, { useState } from 'react';

import { Layout, Button, Image, Alert, } from 'antd';
import { GithubOutlined, GoogleOutlined, GlobalOutlined, LoadingOutlined } from "@ant-design/icons";

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi } from '../Common/global';

export default function BodyContainer() {
  const { userSession, setUserSession } = useCustomContext();
  const [ messageType, setMessageType ] = useState('info');
  const [ messageContent, setMessageContent ] = useState('');

  const handleSigninWithEmail = () => {
    callApi('signInWithEmail', {}).then((data) => {});
  }
  const handleSigninWithGithub = () => {
    callApi('signInWithGithub', {}).then((data) => {});
  }
  const handleSigninWithGoogle = () => {
    callApi('signInWithGoogle', {}).then((data) => {});
  }
  window.showMessageOnSigninPage = (message, type) => {
    setMessageType(type);
    setMessageContent(message);
  };
  window.setShowSigninButtons = (value) => {
    if(value) {
      setUserSession({...userSession, loading: false});
    } else {
      setUserSession({...userSession, loading: true});
    }
  }

  return (
    <>
      <Layout className='disableHighlight' style={{ height: '100%' }}>
        <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', paddingBottom: '60px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}><Image src="/logo192.png" width={128} height={128} preview={false} /><br />Oysape</div>
            <div style={{ marginBottom: '8px' }} hidden={userSession.loading}><Button type="default" size='large' onClick={handleSigninWithEmail} icon={<GlobalOutlined />} style={{ width: '200px' }}>Sign in with Email&nbsp;&nbsp;</Button></div>
            <div style={{ marginBottom: '8px' }} hidden={userSession.loading}><Button type="default" size='large' onClick={handleSigninWithGithub} icon={<GithubOutlined />} style={{ width: '200px' }}>Sign in with Github</Button></div>
            <div style={{ marginBottom: '8px' }} hidden={userSession.loading}><Button type="default" size='large' onClick={handleSigninWithGoogle} icon={<GoogleOutlined />} style={{ width: '200px' }}>Sign in with Google</Button></div>
            <div style={{ fontSize: '92px' }} hidden={!userSession.loading}><LoadingOutlined /></div>
            <div style={{ marginBottom: '8px' }} hidden={!messageContent}><Alert type={messageType||'info'} message={messageContent}></Alert></div>
          </div>
        </div>
      </Layout>
    </>
  )
}
