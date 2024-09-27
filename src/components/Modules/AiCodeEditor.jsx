import React from 'react'
import { CodeiumEditor } from "@codeium/react-code-editor";
import { Base64 } from 'js-base64';
import { App } from 'antd';

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, getMonacoLanguages } from '../Common/global';
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'

import './CodeEditor.css';

export default function CodeEditor(props) {
  const { message } = App.useApp();
  const { customTheme, tabActiveKey, tabItems, setTabItems, setCodeEditRowColText, setCodeEditCurrentLang, setFooterStatusText, setFolderFiles } = useCustomContext();
  const [value, setValue] = React.useState('');
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

  const handleEditorDidMount = (editor, monaco) => {
    inputCode.current = editor;
    window.oypaseTabs = window.oypaseTabs || {};
    window.oypaseTabs[uniqueKey] = editor;
    editor.onDidChangeCursorPosition((e) => {
      if(tabActiveKey !== uniqueKey) return;
      const position = e.position;
      let rowColText = `Ln ${position.lineNumber}, Col ${position.column}`;
      setCodeEditRowColText(rowColText);
    });

    editor.onDidChangeCursorSelection((e) => {
      if(tabActiveKey !== uniqueKey) return;
      const selection = e.selection;
      const selectionLength = editor.getModel().getValueInRange(selection).length;
      if (selectionLength > 0) {
        let rowColText = `${selectionLength} characters selected`;
        if (e.secondarySelections && e.secondarySelections.length > 0) {
          rowColText = `${e.secondarySelections.length + 1} selections (${selectionLength} characters selected)`;
        }
        setCodeEditRowColText(rowColText);
      }
    });
  }

  React.useEffect(() => {
    // console.log(props);
    const v1 = getMonacoLanguages(props.filename);
    setLangCurr(v1&&v1.length>0?v1[0]:'plaintext');
    setCodeEditCurrentLang(v1&&v1.length>0?v1[0]:'plaintext');
    if(props.filebody){
      setValue(props.filebody);
    }else if(props.filename) {
      if(props.target) {
        callApi('open_remote_file', {target: props.target, path:props.filename}).then((resp)=>{
          if(resp && resp.errinfo) {
            message.error(resp.errinfo);
          } else if(resp && resp.hasOwnProperty('content')) {
            const fileBody = Base64.decode(resp.content);
            setValue(fileBody);
          }
        }).catch((err) => {
          message.error(err.message);
        })
      } else {
        callApi('read_file', {path:props.filename}).then((data)=>{
          if(typeof data === 'string' && data.length>0) {
            setValue(data);
          }else if(data && data.errinfo) {
            message.error(data.errinfo);
          }
        }).catch((err) => {
          message.error(err.message);
        })
      }
    }
    window.oypaseTabs = window.oypaseTabs || {}; window.oypaseTabs[uniqueKey] = inputCode.current;
  }, [setCodeEditCurrentLang, props, props.filebody, props.filename, uniqueKey, message]);

  const chooseLang = (lang) => {
    setLangCurr(lang);
    setCodeEditCurrentLang(lang);
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
      }).catch((err) => {
        message.error(err.message);
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
      }).catch((err) => {
        message.error(err.message);
      });
    }
  }
  useKeyPress(keyMapping["shortcutSave"], (event) => {
    if(tabActiveKey === uniqueKey) saveFile(props.filename, props.tabTitle, value, props.target);
    event.preventDefault(); return;
  });

  return (
    <CodeiumEditor ref={inputCode} height={'100%'}
      theme={customTheme.isDark?'vs-dark':'light'}
      language={langCurr}
      value={value}
      autoFocus={true}
      onChange={onValuesChange}
      onMount={handleEditorDidMount}
      options={{
        minimap: { enabled: false },
        wordWrap: 'off',
        scrollbar: {
          vertical: 'visible',
          horizontal: 'visible',
        },
        automaticLayout: true,
        readOnly: false,
      }}
    />
  )
}
