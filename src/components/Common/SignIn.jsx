import React, { useEffect, useState } from 'react';

import { Layout, Button, Image, Alert, } from 'antd';
import { GithubOutlined, GoogleOutlined, GlobalOutlined, LoadingOutlined } from "@ant-design/icons";

import { isDesktopVersion, setClientId, callApi, getTokenFromCookie, setTokenToCookie } from '../Common/global';

export default function BodyContainer() {
  const [ messageType, setMessageType ] = useState('info');
  const [ messageContent, setMessageContent ] = useState('');
  const [ loading, setLoading ] = useState(true);

  const handleSigninWithEmail = () => {
    setLoading(true);
    callApi('signInWithEmail', {srh: (window.OYSAPE_BACKEND_HOST||'')}).then((data) => {
      callWaitForSigninResult(data);
    });
  }
  const handleSigninWithGithub = () => {
    setLoading(true);
    callApi('signInWithGithub', {srh: (window.OYSAPE_BACKEND_HOST||'')}).then((data) => {
      callWaitForSigninResult(data);
    });
  }
  const handleSigninWithGoogle = () => {
    setLoading(true);
    callApi('signInWithGoogle', {srh: (window.OYSAPE_BACKEND_HOST||'')}).then((data) => {
      callWaitForSigninResult(data);
    });
  }
  const callWaitForSigninResult = (waitData) => {
    if(waitData?.errinfo) {
      showMessageOnSigninPage(waitData.errinfo, 'error');
      setLoading(false);
    } else {
      if(waitData?.clientId) {
        setClientId(waitData.clientId);
        const waitForSigninResultTimer = setInterval(() => {
          callApi('querySigninResult', {}).then((loginData) => {
            if(loginData && loginData.token) {
              clearInterval(waitForSigninResultTimer);
              setTokenToCookie(loginData.token);
              window.reloadUserSession(loginData.token);
            }else if(loginData && loginData.errinfo) {
              clearInterval(waitForSigninResultTimer);
              showMessageOnSigninPage(loginData.errinfo, 'error');
            }
          })
        }, 1000);
      }
      if(waitData?.url) {
        if(isDesktopVersion){
          window.open(waitData.url);
        } else {
          window.location.href = waitData.url;
        }
      }
    }
  }

  const showMessageOnSigninPage = (message, type) => {
    setMessageType(type);
    setMessageContent(message);
    setLoading(false);
  };
  window.showMessageOnSigninPage = showMessageOnSigninPage;

  useEffect(() => {
    const runMeFirst = () => {
      const token = getTokenFromCookie();
      if(token) {
        window.reloadUserSession(token);
      } else if (loading) {
        setLoading(false);
      }
    }

    if(isDesktopVersion) {
      const waitForPywebivewTimer = setInterval(() => {
        if(window.pywebview && window.pywebview.token) {
          clearInterval(waitForPywebivewTimer);
          runMeFirst();
        }
      })
    } else {
      runMeFirst();
    }
  }, [loading]);

  return (
    <>
      <Layout className='disableHighlight' style={{ height: '100%' }}>
        <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', paddingBottom: '60px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}><Image src="/logo192.png" width={128} height={128} preview={false} /><br />Oysape</div>
            <div style={{ marginBottom: '8px' }} hidden={loading}><Button type="default" size='large' onClick={handleSigninWithEmail} icon={<GlobalOutlined />} style={{ width: '200px' }}>Sign in with Email&nbsp;&nbsp;</Button></div>
            <div style={{ marginBottom: '8px' }} hidden={loading}><Button type="default" size='large' onClick={handleSigninWithGithub} icon={<GithubOutlined />} style={{ width: '200px' }}>Sign in with Github</Button></div>
            <div style={{ marginBottom: '8px' }} hidden={loading}><Button type="default" size='large' onClick={handleSigninWithGoogle} icon={<GoogleOutlined />} style={{ width: '200px' }}>Sign in with Google</Button></div>
            <div style={{ fontSize: '92px' }} hidden={!loading}><LoadingOutlined /></div>
            <div style={{ marginBottom: '8px' }} hidden={!messageContent}><Alert type={messageType||'info'} message={messageContent}></Alert></div>
          </div>
        </div>
      </Layout>
    </>
  )
}
