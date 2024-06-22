import React, { useEffect, useState } from 'react';

import { App, Layout, Button, Image, Alert, } from 'antd';
import { GithubOutlined, GoogleOutlined, GlobalOutlined, LoadingOutlined, AppleFilled } from "@ant-design/icons";

import { useCustomContext } from '../Contexts/CustomContext'
import { isDesktopVersion, callApi, getCredentials, setTokenToCookie, delTokenFromCookie, isMobileVersion } from '../Common/global';

export default function BodyContainer() {
  const { message } = App.useApp();
  const { setUserSession } = useCustomContext();
  const queryParams = new URLSearchParams(window.location.search);
  const [ messageType, setMessageType ] = useState('error');
  const [ messageContent, setMessageContent ] = useState(queryParams.get('msg')||'');
  const [ loading, setLoading ] = useState(true);

  const handleSigninWithEmail = () => {
    setLoading(true);
    showMessageInWebpage(''); // Don't show loading after clicking sign in. Because the user might want to don't sign in and choose another way immediately
    callApi('signInWithEmail', {obh: (window.OYSAPE_BACKEND_HOST||'')}).then((data) => {
      callWaitForSigninResult(data);
    });
  }
  const handleSigninWithGithub = () => {
    setLoading(true);
    showMessageInWebpage(''); // Don't show loading after clicking sign in. Because the user might want to don't sign in and choose another way immediately
    callApi('signInWithGithub', {obh: (window.OYSAPE_BACKEND_HOST||'')}).then((data) => {
      callWaitForSigninResult(data);
    });
  }
  const handleSigninWithGoogle = () => {
    setLoading(true);
    showMessageInWebpage(''); // Don't show loading after clicking sign in. Because the user might want to don't sign in and choose another way immediately
    callApi('signInWithGoogle', {obh: (window.OYSAPE_BACKEND_HOST||'')}).then((data) => {
      callWaitForSigninResult(data);
    });
  }
  const handleSigninWithApple = () => {
    setLoading(true);
    showMessageInWebpage(''); // Don't show loading after clicking sign in. Because the user might want to don't sign in and choose another way immediately
    callApi('signInWithApple', {obh: (window.OYSAPE_BACKEND_HOST||'')}).then((data) => {
      callWaitForSigninResult(data);
    });
  }
  const callWaitForSigninResult = (waitData) => {
    let secondPassed = 0;
    if(waitData?.errinfo) {
      showMessageInWebpage(waitData.errinfo, 'error');
    } else {
      if(isDesktopVersion) {
        // Won't be here in web version
        const waitForSigninResultTimer = setInterval(() => {
          callApi('querySigninResult', {}).then((loginData) => {
            if(loginData && loginData.token) {
              clearInterval(waitForSigninResultTimer);
              setTokenToCookie(loginData.token);
              window.reloadUserSession(loginData.token);
            }else if(loginData && loginData.errinfo) {
              clearInterval(waitForSigninResultTimer);
              showMessageInWebpage(loginData.errinfo, 'error');
            }
          });
          secondPassed += 1;
          if (secondPassed >= 60) {
            clearInterval(waitForSigninResultTimer);
            showMessageInWebpage('Timeout', 'error');
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

  const showMessageInWebpage = (content, level) => {
    setMessageContent(content);
    if(content) message[level||messageType||'info'](content);
    if(level) setMessageType(level);
    setLoading(false);
  };
  window.showMessageInWebpage = showMessageInWebpage;

  const reloadUserSession = () => {
    callApi('reloadUserSession', getCredentials()).then((data) => {
      setLoading(false);
      // console.log('reloadUserSession', data);
      if(data?.uid) {
        setUserSession(data);
      }else if(data?.errinfo) {
        window.showMessageInWebpage && window.showMessageInWebpage(data.errinfo);
        delTokenFromCookie();
      }else{
        window.showMessageInWebpage && window.showMessageInWebpage('');
        if(isMobileVersion && window.cooData && window.cooData.oywebHost) {
          window.location.href = window.cooData.oywebHost;
        }
        // delTokenFromCookie();
      }
    }).catch((err) => {
      setLoading(false);
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
    } else if (isMobileVersion) {
      setLoading(true);
      var runTimes = 0;
      const waitForTokenTimer = setInterval(() => {
        if (window.cooData && window.cooData.client_id) {
          clearInterval(waitForTokenTimer);
          window.showMessageInWebpage && window.showMessageInWebpage('Session loaded', 'success');
          runMeFirst();
        }
        runTimes += 1;
        if(runTimes >= 10) {
          clearInterval(waitForTokenTimer);
          window.showMessageInWebpage && window.showMessageInWebpage('Load session timeout', 'warning');
          setTimeout(() => {
            if(isMobileVersion && window.cooData && window.cooData.oywebHost) {
              window.location.href = window.cooData.oywebHost;
            }
          }, 2000)
        }
      }, 1000);
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
            <div style={{ marginBottom: '8px' }} hidden={loading}><Button type="default" size='large' onClick={handleSigninWithEmail} icon={<GlobalOutlined />} style={{ width: '200px' }}>Sign in with Email&nbsp;&nbsp;&nbsp;</Button></div>
            <div style={{ marginBottom: '8px' }} hidden={loading}><Button type="default" size='large' onClick={handleSigninWithGithub} icon={<GithubOutlined />} style={{ width: '200px' }}>Sign in with Github&nbsp;</Button></div>
            <div style={{ marginBottom: '8px' }} hidden={loading}><Button type="default" size='large' onClick={handleSigninWithGoogle} icon={<GoogleOutlined />} style={{ width: '200px' }}>Sign in with Google</Button></div>
            <div style={{ marginBottom: '8px' }} hidden={loading}><Button type="default" size='large' onClick={handleSigninWithApple} icon={<AppleFilled />} style={{ width: '200px' }}>Sign in with Apple&nbsp;&nbsp;&nbsp;</Button></div>
            <div style={{ fontSize: '92px' }} hidden={!loading}><LoadingOutlined /></div>
            <div style={{ marginBottom: '8px' }} hidden={!messageContent}><Alert type={messageType||'info'} message={messageContent}></Alert></div>
          </div>
        </div>
      </Layout>
    </>
  )
}
