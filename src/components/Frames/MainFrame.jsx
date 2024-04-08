import React, {useEffect} from 'react';

import HeadFrame from './HeadFrame';
import ContentFrame from './ContentFrame';

import './MainFrame.css';

const MainFrame = () => {
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      event.returnValue = 'Are you sure you want to leave?';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <div className='main-content'>
      <HeadFrame></HeadFrame>
      <ContentFrame></ContentFrame>
    </div>
  );
};
export default MainFrame;
