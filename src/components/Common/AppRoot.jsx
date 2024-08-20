import { ConfigProvider, App, theme, Layout } from 'antd';

import { useCustomContext } from '../Contexts/CustomContext'
import BodyContainer from './BodyContainer';
import SignIn from './SignIn';

const AppRoot = () => {
  const { message } = App.useApp();
  const { customTheme, userSession } = useCustomContext();

  const showMessageInWebpage = (content, level) => {
    // 本来是想提供给 mobile app 调用的, 以便显示一个提示消息, 没有用到
    const lambda = message[level||'info'];
    if(content && lambda && typeof lambda === 'function') lambda(content);
  };
  window.showMessageInWebpage = showMessageInWebpage;

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
