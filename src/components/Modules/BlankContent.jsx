import { useRef } from 'react';
import { useCustomContext } from '../Contexts/CustomContext'
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'
import ToggleTheme from '../Common/ToggleTheme';

const BlankContent = () => {
  const { customTheme } = useCustomContext();
  const divContainer = useRef(null);
  const onKeyPress = (event) => {
    console.log(`key pressed: ${event.ctrlKey||event.metaKey} ${event.key}`);
    event.preventDefault(); return;
  };
  useKeyPress(keyMapping["execCommand"], onKeyPress, divContainer.current);

  return (
    <div ref={divContainer} style={{ backgroundColor: customTheme.colors["editor.background"], height: '100%', }}>
      <ToggleTheme />
    </div>
  );
}

export default BlankContent;
