import React from 'react';
import { ConfigProvider, App, theme, Layout } from 'antd';

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, uniqueClientID, setClientId, delTokenFromCookie } from '../Common/global';
import BodyContainer from './BodyContainer';
import SignIn from './SignIn';


const AppRoot = () => {
  const { customTheme, userSession, setUserSession } = useCustomContext();

  const reloadUserSession = (token) => {
    callApi('getUserSession', {refresh: true, token:token}).then((data) => {
      console.log('getUserSession', data);
      if(data?.uid) {
        setUserSession(data);
        if(!uniqueClientID) {
          setClientId(data.clientId);
        }
      }else if(data?.errinfo) {
        window.showMessageOnSigninPage && window.showMessageOnSigninPage(data.errinfo);
        delTokenFromCookie();
      }else{
        window.showMessageOnSigninPage && window.showMessageOnSigninPage('Unknown error', 'error');
        delTokenFromCookie();
      }
    });
  };
  window.reloadUserSession = reloadUserSession;

  return (
    <ConfigProvider
      theme={{
        algorithm: customTheme.isDark?theme.darkAlgorithm:theme.defaultAlgorithm,
        token: {
          borderRadius: 4
        },
        components: {
          Layout: {
            headerBg: customTheme.colors["sideBar.background"],
            footerBg: customTheme.colors["sideBar.background"],
            footerPadding: '2px',
            headerHeight: '56px',
            algorithm: true,
          },
          Tabs: {
            verticalItemPadding: '8px 16px'
          },
          Collapse: {
            contentBg: customTheme.colors["sideBar.background"],
            // headerBg: customTheme.colors["collapse.headerBackground"],
          },
          Tree: {
            directoryNodeSelectedBg: customTheme.colors["list.activeSelectionBackground"],
          }
        }
      }}
    >
      <App style={{ height: '100vh' }}>
        <Layout style={{ height: '100%' }}>
          { userSession && userSession.uid ?
            <BodyContainer></BodyContainer> :
            <SignIn></SignIn>
          }
        </Layout>
      </App>
    </ConfigProvider>
  )
}
export default AppRoot;
