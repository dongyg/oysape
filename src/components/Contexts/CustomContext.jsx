import React, { useState, useContext, useEffect } from "react";

import { callApi } from '../Common/global';
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

const statusDefaultText = 'Oysape';

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(customThemes.light);
  const [sideAlign, setSideAlign] = useState('left');
  const [sideSplitterMoving, setSideSplitterMoving] = useState(false);
  const [sideWidthUse, setSideWidthUse] = useState(400);
  const [sideWidthBak, setSideWidthBak] = useState(400);
  const [tabItems, setTabItems] = useState([]);
  const [tabActiveKey, setTabActiveKey] = useState('0');
  const [serverItems, setServerItems] = useState([]);
  const [taskItems, setTaskItems] = useState([]);
  const [pipelineItems, setPipelineItems] = useState([]);
  const [projectFiles, setProjectFiles] = useState([]);
  const [footerStatusText, setFooterStatusText] = useState(statusDefaultText);
  const [codeEditRowColText, setCodeEditRowColText] = useState(null);
  const [codeEditCurrentLang, setCodeEditCurrentLang] = useState(null);
  const [searchMode, setSearchMode] = useState('');
  useEffect(() => {
    // Set the first color theme
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setCurrentTheme(customThemes.dark)
    } else {
      setCurrentTheme(customThemes.light)
    }
    // Monitoring system color theme changes
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (event) => {
        if (event.matches) {
          setCurrentTheme(customThemes.dark)
        } else {
          setCurrentTheme(customThemes.light)
        }
      })
  }, [])
  const context = {
    customTheme: currentTheme,
    toggleCustomTheme: () => {
      setCurrentTheme(currentTheme === customThemes.dark ? customThemes.light : customThemes.dark);
      callApi('setTheme', currentTheme === customThemes.dark ? customThemes.light : customThemes.dark).then((data) => {});
    },
    sideAlign, setSideAlign,
    sideSplitterMoving, setSideSplitterMoving,
    sideWidthUse, setSideWidthUse,
    sideWidthBak, setSideWidthBak,
    tabItems, setTabItems,
    tabActiveKey, setTabActiveKey: (key) => {
      setCodeEditRowColText(null); setCodeEditCurrentLang(null);
      setTabActiveKey(key);
    },
    serverItems, setServerItems,
    taskItems, setTaskItems,
    pipelineItems, setPipelineItems,
    projectFiles, setProjectFiles,
    footerStatusText, setFooterStatusText: (text) => {
      setFooterStatusText(text);
      setTimeout(() => {
        setFooterStatusText(statusDefaultText);
      }, 3500);
    },
    codeEditRowColText, setCodeEditRowColText, codeEditCurrentLang, setCodeEditCurrentLang,
    searchMode, setSearchMode,
  }
  return <ThemeContext.Provider value={context}>
    { children }
  </ThemeContext.Provider>
}

export const useCustomContext = () => {
  const context = useContext(ThemeContext);
  return context;
};