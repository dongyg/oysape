import React, { useEffect, useState } from 'react';

import { Layout, Button, Image, Alert, } from 'antd';
import { GithubOutlined, GoogleOutlined, GlobalOutlined, LoadingOutlined } from "@ant-design/icons";

import { useCustomContext } from '../Contexts/CustomContext'
import { isDesktopVersion, callApi, setTokenToCookie, delTokenFromCookie } from '../Common/global';

export default function BodyContainer() {
  const { setUserSession } = useCustomContext();
  const queryParams = new URLSearchParams(window.location.search);
  const [ messageType, setMessageType ] = useState('error');
  const [ messageContent, setMessageContent ] = useState(queryParams.get('msg')||'');
  const [ loading, setLoading ] = useState(true);

  const handleSigninWithEmail = () => {
    setLoading(true);
    showMessageOnSigninPage('');
    callApi('signInWithEmail', {obh: (window.OYSAPE_BACKEND_HOST||'')}).then((data) => {
      callWaitForSigninResult(data);
    });
  }
  const handleSigninWithGithub = () => {
    setLoading(true);
    showMessageOnSigninPage('');
    callApi('signInWithGithub', {obh: (window.OYSAPE_BACKEND_HOST||'')}).then((data) => {
      callWaitForSigninResult(data);
    });
  }
  const handleSigninWithGoogle = () => {
    setLoading(true);
    showMessageOnSigninPage('');
    callApi('signInWithGoogle', {obh: (window.OYSAPE_BACKEND_HOST||'')}).then((data) => {
      callWaitForSigninResult(data);
    });
  }
  const callWaitForSigninResult = (waitData) => {
    let secondPassed = 0;
    if(waitData?.errinfo) {
      showMessageOnSigninPage(waitData.errinfo, 'error');
      setLoading(false);
    } else {
      if(waitData?.clientId) {
        // Won't be here in web version
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
          });
          secondPassed += 1;
          if (secondPassed >= 60) {
            clearInterval(waitForSigninResultTimer);
            showMessageOnSigninPage('Timeout', 'error');
            setLoading(false);
          }
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
    setMessageContent(message);
    if(type) setMessageType(type);
    setLoading(false);
  };
  window.showMessageOnSigninPage = showMessageOnSigninPage;

  const reloadUserSession = () => {
    callApi('reloadUserSession', {refresh: true}).then((data) => {
      console.log('reloadUserSession', data);
      if(data?.uid) {
        setUserSession(data);
      }else if(data?.errinfo) {
        window.showMessageOnSigninPage && window.showMessageOnSigninPage(data.errinfo);
        delTokenFromCookie();
      }else{
        window.showMessageOnSigninPage && window.showMessageOnSigninPage('');
        // delTokenFromCookie();
      }
    });
  };
  window.reloadUserSession = reloadUserSession;

  useEffect(() => {
    const runMeFirst = () => {
      window.reloadUserSession();
    }

    if(isDesktopVersion) {
      const waitForPywebivewTimer = setInterval(() => {
        if(window.pywebview && window.pywebview.token) {
          clearInterval(waitForPywebivewTimer);
          callApi('get_token').then((data) => {
            runMeFirst();
          });
        }
      })
    } else {
      runMeFirst();
    }
  }, []);

  return (
    <>
      <Layout className='disableHighlight' style={{ height: '100%' }}>
        <div style={{ height: '100%', display: 'flex', justifyContent: 'center', paddingTop: 'calc(50vh - 200px)' }}>
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
