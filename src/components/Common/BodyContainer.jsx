import { Layout, Button, } from 'antd';
import { useCustomContext } from '../Contexts/CustomContext'
import SideFrame from '../Frames/SideFrame';
import MainFrame from '../Frames/MainFrame';

import './BodyContainer.less';

const { Content, Footer } = Layout;

export default function BodyContainer() {
  const { sideAlign, sideSplitterMoving, setSideSplitterMoving, setSideWidthUse, footerStatusText, codeEditRowColText, codeEditCurrentLang, setSearchMode } = useCustomContext();
  const bodyDirection = sideAlign==='left'?'row':'row-reverse';

  return (
    <>
      <Layout style={{ WebkitFlexDirection: bodyDirection, flexDirection: bodyDirection, msFlexDirection: bodyDirection }}
        className={sideSplitterMoving?'disableHighlight colResizeCursor':''}
        onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}>
        <SideFrame></SideFrame>
        <Content style={{ height: '100%' }}><MainFrame/></Content>
      </Layout>
      <Footer className='disableHighlight' style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ padding: '0 4px'}}>{footerStatusText}</div>
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
    </>
  )

  function handleMouseUp(event) {
    setSideSplitterMoving(false);
  }

  function handleMouseMove(event) {
    if(sideSplitterMoving) {
      if(sideAlign==='left'){
        if(event.clientX > 260 && event.clientX < event.view.innerWidth/2){
          setSideWidthUse(event.clientX);
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
          }, 20);
        }
      } else {
        if(event.clientX < event.view.innerWidth-260 && event.clientX > event.view.innerWidth/2){
          setSideWidthUse(event.view.innerWidth-event.clientX);
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
          }, 20);
        }
      }
    }
  }
}
