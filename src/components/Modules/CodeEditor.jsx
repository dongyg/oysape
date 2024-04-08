import React from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { App } from 'antd';
import { solarizedLight, solarizedDark } from '@uiw/codemirror-theme-solarized';
import { loadLanguage } from '@uiw/codemirror-extensions-langs';

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, getLanguages } from '../Common/global';
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'

import './CodeEditor.css';

export default function CodeEditor(props) {
  const { message } = App.useApp();
  const { customTheme, tabActiveKey, tabItems, setTabItems, setCodeEditRowColText, setCodeEditCurrentLang, setFooterStatusText, setFolderFiles } = useCustomContext();
  const [value, setValue] = React.useState('');
  const [langExts, setLangExts] = React.useState([]);
  const [langCurr, setLangCurr] = React.useState(null);
  const inputCode = React.useRef(null);
  const uniqueKey = props.uniqueKey;

  const onValuesChange = React.useCallback((val, viewUpdate) => {
    setValue(val);
    var hasSomethingNew = false;
    const newItems = tabItems.map((item) => {
      if(item.key === uniqueKey && item.label.indexOf('* ') !== 0) {
        hasSomethingNew = true;
        item.hasSomethingNew = true;
        item.label = (item.label.indexOf('* ') === 0 ? '' : '* ') + item.label;
      }
      return item;
    });
    if(hasSomethingNew) setTabItems(newItems);
  }, [uniqueKey, tabItems, setTabItems])

  React.useEffect(() => {
    // console.log(props);
    const v1 = getLanguages(props.filename);
    setLangCurr(v1&&v1.length>0?v1[0]:'plaintext');
    setCodeEditCurrentLang(v1&&v1.length>0?v1[0]:'plaintext');
    const v2 = v1.map(lang=>loadLanguage(lang));
    setLangExts(v2);
    if(props.filebody){
      setValue(props.filebody);
    }else if(props.filename) {
      callApi('read_file', {path:props.filename}).then((data)=>{
        if(typeof data === 'string' && data.length>0) {
          setValue(data);
        }else if(data && data.errinfo) {
          message.error(data.errinfo);
        }
      })
    }
    window.oypaseTabs = window.oypaseTabs || {}; window.oypaseTabs[uniqueKey] = inputCode.current;
  }, [setCodeEditCurrentLang, props.filebody, props.filename, uniqueKey, message]);

  const chooseLang = (lang) => {
    setLangCurr(lang);
    setCodeEditCurrentLang(lang);
    setLangExts([loadLanguage(lang)]);
  }
  React.useEffect(()=>{
    window['chooseLang_'+uniqueKey] = chooseLang;
    return () => {
      delete window['chooseLang_'+uniqueKey];
    }
  })

  const saveFile = (path, title, content, target) => {
    if(path === 'globalExcludes.json') {
      callApi('updateGlobalExcludes', {'excludes':JSON.parse(content)}).then((resp)=>{
        const newItems = tabItems.map((item) => {
          if(item.key === uniqueKey) {
            item.hasSomethingNew = false;
            item.label = title;
          }
          return item;
        });
        setTabItems(newItems);
        if(resp && resp.folderFiles) {
          setFolderFiles(resp.folderFiles);
        }
      })
    } else {
      callApi(target?'save_remote_file':'save_file', {path:path, content:content, target:target}).then((data)=>{
        if(data && data.errinfo){
          message.error(data.errinfo);
        } else  {
          const newItems = tabItems.map((item) => {
            if(item.key === uniqueKey) {
              item.hasSomethingNew = false;
              item.label = title;
            }
            return item;
          });
          setTabItems(newItems);
          setFooterStatusText('Saved. '+(target?target+':':'')+path);
          message.success('Saved');
        }
      });
    }
  }
  useKeyPress(keyMapping["shortcutSave"], (event) => {
    if(tabActiveKey === uniqueKey) saveFile(props.filename, props.tabTitle, value, props.target);
    event.preventDefault(); return;
  });

  return (
    <CodeMirror ref={inputCode}
      style={{ height: '100%' }}
      theme={customTheme.isDark?solarizedDark:solarizedLight}
      basicSetup={{highlightActiveLine:false}}
      value={value}
      extensions={langExts}
      autoFocus={true}
      onChange={onValuesChange}
      onStatistics={(data)=>{
        if(tabActiveKey !== uniqueKey) {
          return;
        }
        setCodeEditCurrentLang(langCurr);
        var rowColText = '';
        if(data.ranges.length>1) {
          rowColText += data.ranges.length + ' selections (' + (data.selections.join('').length) + ' characters selected)';
        }else{
          rowColText += 'Ln '+data.line.number+', Col '+(data.ranges[0].from-data.line.from+1);
          if(data.ranges[0].to !== data.ranges[0].from){
            rowColText += ' (' + (data.ranges[0].to - data.ranges[0].from) + ' selected)'
          }
        }
        setCodeEditRowColText(rowColText);
      }}
    />
  )
}
