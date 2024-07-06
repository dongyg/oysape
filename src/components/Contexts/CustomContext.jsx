import React, { useState, useContext, useEffect } from "react";

import { callApi, isDesktopVersion, OYSAPE_DESKTOP_NAME } from '../Common/global';
import { StyleDark } from "./StyleDark";
import { StyleLight } from "./StyleLight";

export const customThemes = {
  light: Object.assign(StyleLight, { type: 'light', isDark: false, className: 'light-theme'}),
  dark: Object.assign(StyleDark, { type: 'dark', isDark: true, className: 'dark-theme'}),
};
const ThemeContext = React.createContext({
  customTheme: customThemes.dark,
  toggleCustomTheme: () => {},
});

const statusDefaultText = (isDesktopVersion ? OYSAPE_DESKTOP_NAME : 'OysapeWebhost') + ' 2.7.6';

export const ThemeProvider = ({ children }) => {
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [currentTheme, setCurrentTheme] = useState(customThemes.light);
  const [userSession, setUserSession] = useState({});
  const [browserInfo, setBrowserInfo] = useState({});
  const [currentSideKey, setCurrentSideKey] = useState('sideServer');
  const [sideAlign, setSideAlign] = useState('left');
  const [sideSplitterMoving, setSideSplitterMoving] = useState(false);
  const [sideWidthUse, setSideWidthUse] = useState("400");
  const [sideWidthBak, setSideWidthBak] = useState("400");
  const [tabItems, setTabItems] = useState([]);
  const [tabActiveKey, setTabActiveKey] = useState('workspace');
  const [folderFiles, setFolderFiles] = useState([]);
  const [footerStatusText, setFooterStatusText] = useState(statusDefaultText);
  const [codeEditRowColText, setCodeEditRowColText] = useState(null);
  const [codeEditCurrentLang, setCodeEditCurrentLang] = useState(null);
  const [searchMode, setSearchMode] = useState('');
  const [hideSidebar, setHideSidebar] = useState(window.innerWidth<=800);

  let menuWidth = 60;

  useEffect(() => {
    // Set the first color theme
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setCurrentTheme(customThemes.dark);
      // callApi('setTheme', customThemes.dark).then((data) => {});
    } else {
      setCurrentTheme(customThemes.light);
      // callApi('setTheme', customThemes.light).then((data) => {});
    }
    // Monitoring system color theme changes
    const handleColorSchemeChange = (event) => {
      if (event.matches) {
        setCurrentTheme(customThemes.dark);
        callApi('setTheme', customThemes.dark).then((data) => {});
      } else {
        setCurrentTheme(customThemes.light);
        callApi('setTheme', customThemes.light).then((data) => {});
      }
    }
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", handleColorSchemeChange)
    // Monitoring screen size changes
    const handleResize = () => {
      if(sideWidthUse!==menuWidth) {
        if(window.innerWidth <= 768) {
          setSideWidthUse('100%');
        } else if(sideWidthUse === '100%') {
          setSideWidthUse(400);
        }
      }
      setScreenWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('change', handleColorSchemeChange);
      window.removeEventListener('resize', handleResize);
    }
  }, [setSideWidthUse, sideWidthUse, setScreenWidth, menuWidth]);

  const hideSidebarIfNeed = () => {
    if(sideWidthUse === '100%' && !hideSidebar) {
      setHideSidebar(true);
    }
  }

  const context = {
    screenWidth, setScreenWidth, hideSidebarIfNeed, menuWidth,
    customTheme: currentTheme,
    toggleCustomTheme: () => {
      setCurrentTheme(currentTheme === customThemes.dark ? customThemes.light : customThemes.dark);
      callApi('setTheme', currentTheme === customThemes.dark ? customThemes.light : customThemes.dark).then((data) => {});
    },
    userSession, setUserSession,
    browserInfo, setBrowserInfo,
    currentSideKey, setCurrentSideKey,
    sideAlign, setSideAlign,
    sideSplitterMoving, setSideSplitterMoving,
    sideWidthUse, setSideWidthUse,
    sideWidthBak, setSideWidthBak,
    tabItems, setTabItems,
    tabActiveKey, setTabActiveKey: (key) => {
      setCodeEditRowColText(null); setCodeEditCurrentLang(null);
      setTabActiveKey(key);
      window.oypaseTabs = window.oypaseTabs || {};
      window.oypaseTabs.tabActiveKey = key;
      setTimeout(() => {window.dispatchEvent(new Event('resize'));}, 10);
      setTimeout(() => {
        if(window.oypaseTabs[key] && window.oypaseTabs[key].focus) {
          try{window.oypaseTabs[key].focus();}catch(e){}
        }
        if(window.oypaseTabs[key] && window.oypaseTabs[key].editor && window.oypaseTabs[key].editor.focus) {
          try{window.oypaseTabs[key].editor.querySelector('.cm-content').focus();}catch(e){}
        }
      }, 10);
    },
    folderFiles, setFolderFiles,
    footerStatusText, setFooterStatusText: (text) => {
      setFooterStatusText(text);
      setTimeout(() => {
        setFooterStatusText(statusDefaultText);
      }, 3500);
    },
    codeEditRowColText, setCodeEditRowColText, codeEditCurrentLang, setCodeEditCurrentLang,
    searchMode, setSearchMode,
    hideSidebar, setHideSidebar,
  }

  return (
    <ThemeContext.Provider value={context}>
      { children }
    </ThemeContext.Provider>
  )
}

export const useCustomContext = () => {
  const context = useContext(ThemeContext);
  return context;
};