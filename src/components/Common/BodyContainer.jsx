import { Layout } from 'antd';
import { useCustomContext } from '../Contexts/CustomContext'
import SideFrame from '../Frames/SideFrame';
import MainFrame from '../Frames/MainFrame';

import './BodyContainer.less';

const { Content } = Layout;

export default function BodyContainer() {
  const { sideAlign, sideSplitterMoving, setSideSplitterMoving, setSideWidthUse } = useCustomContext();
  const bodyDirection = sideAlign==='left'?'row':'row-reverse';

  return (
    <Layout style={{ WebkitFlexDirection: bodyDirection, flexDirection: bodyDirection, msFlexDirection: bodyDirection }}
      className={sideSplitterMoving?'disableHighlight colResizeCursor':''}
      onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}>
      <SideFrame></SideFrame>
      <Content style={{ height: '100%' }}>
        <MainFrame></MainFrame>
      </Content>
    </Layout>
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
