import HeadFrame from './HeadFrame';
import ContentFrame from './ContentFrame';

import './MainFrame.css';

const MainFrame = () => {
  return (
    <div className='main-content'>
      <HeadFrame></HeadFrame>
      <ContentFrame></ContentFrame>
    </div>
  );
};
export default MainFrame;
