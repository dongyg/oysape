import { Button } from 'antd';
import { BsSun, BsMoon, BsFiles, BsPcDisplay, BsClockHistory } from "react-icons/bs";

import { useCustomContext } from '../Contexts/CustomContext'

const ToggleTheme = () => {
  const { customTheme, toggleCustomTheme } = useCustomContext();
  return <div style={{
    color: customTheme.colors["editor.foreground"],
    width: '100%',
    textAlign: 'center',
  }}>
    <span style={{ fontSize: '2em', lineHeight: '2em' }} >
      Toggling Light/Dark Theme
      <BsFiles style={{ marginRight: '0px' }} />
      <BsPcDisplay style={{ marginRight: '0px' }} />
      <BsClockHistory style={{ marginRight: '0px' }} />
      <BsMoon style={{ marginRight: '0px' }} />
      <BsSun style={{ marginRight: '0px' }} />
    </span>
    <br />
    <Button onClick={toggleCustomTheme}>
      Switch to { customTheme.isDark ? <BsSun /> : <BsMoon /> } { customTheme.isDark ? 'Light' : 'Dark' } mode
    </Button>
  </div>
}

export default ToggleTheme;
