import { ConfigProvider, App, theme, Layout, Button } from 'antd';

import { useCustomContext } from '../Contexts/CustomContext'
import BodyContainer from './BodyContainer';

const { Footer} = Layout;

const AppRoot = () => {
  const { customTheme, footerStatusText, codeEditRowColText, codeEditCurrentLang, setSearchMode } = useCustomContext();
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
            algorithm: true, // 启用算法
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
      <App style={{ height: '100%' }}>
        <Layout style={{ height: '100%' }}>
          <BodyContainer></BodyContainer>
          <Footer className='disableHighlight' style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>{footerStatusText}</div>
            <div style={{ display: (codeEditRowColText ? 'flex' : 'none') }}>
              <div style={{ paddingRight: '4px' }}>{codeEditRowColText}</div>
              <div style={{ paddingRight: '0px' }}>
                <Button type='text'
                  style={{ height: '23px', padding: '0 4px', borderRadius: '0px', marginTop: '-1px' }}
                  onClick={ () => { setSearchMode('language'); } }
                >{codeEditCurrentLang}</Button>
              </div>
            </div>
          </Footer>
        </Layout>
      </App>
    </ConfigProvider>
  )
}
export default AppRoot;
