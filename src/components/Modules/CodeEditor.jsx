import React from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { CodeiumEditor } from "@codeium/react-code-editor";
import { Base64 } from 'js-base64';
import { App } from 'antd';
import { solarizedLight, solarizedDark } from '@uiw/codemirror-theme-solarized';
import { loadLanguage } from '@uiw/codemirror-extensions-langs';

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, getCodeMirrorLanguages, getMonacoLanguages } from '../Common/global';
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'

import './CodeEditor.css';

export default function CodeEditor(props) {
  const { message } = App.useApp();
  const { customTheme, tabActiveKey, tabItems, setTabItems, setCodeEditRowColText, setCodeEditCurrentLang, setFooterStatusText, setFolderFiles, editorType } = useCustomContext();
  const [value, setValue] = React.useState('');
  const [langExts, setLangExts] = React.useState([]);
  const [langCurr, setLangCurr] = React.useState(null);
  const langCurrRef = React.useRef(null);
  const inputCode = React.useRef(null);
  const uniqueKey = props.uniqueKey;

  const updateStatusBar = (editor) => {
    if(tabActiveKey !== uniqueKey) return;
    const selection = editor.getSelection();
    if(selection) {
      const selectionLength = editor.getModel().getValueInRange(selection).length;
      if (selectionLength > 0) {
        let rowColText = `${selectionLength} characters selected`;
        const secondarySelections = editor.getSelections();
        if (secondarySelections && secondarySelections.length > 0) {
          rowColText = `${secondarySelections.length} selections (${selectionLength*secondarySelections.length} characters selected)`;
        }
        setCodeEditRowColText(rowColText);
      }else{
        const position = editor.getPosition();
        let rowColText = `Ln ${position.lineNumber}, Col ${position.column}`;
        setCodeEditRowColText(rowColText);
      }
    }
    setCodeEditCurrentLang(langCurrRef.current);
  }

  const handleEditorDidMount = React.useCallback((editor, monaco) => {
    inputCode.current = editor;
    window.oypaseTabs = window.oypaseTabs || {};
    window.oypaseTabs[uniqueKey] = editor;
    updateStatusBar(editor);
    editor.onDidFocusEditorWidget((e) => {
      updateStatusBar(editor);
    })
    editor.onDidChangeCursorPosition((e) => {
      updateStatusBar(editor);
    });
    editor.onDidChangeCursorSelection((e) => {
      updateStatusBar(editor);
    });
  }, []);

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
    const v1 = editorType==='monaco'?getMonacoLanguages(props.filename):getCodeMirrorLanguages(props.filename);
    const v2 = v1&&v1.length>0?v1[0]:'plaintext';
    setLangCurr(v2);
    setCodeEditCurrentLang(v2);
    const v3 = v1.map(lang=>loadLanguage(lang));
    setLangExts(v3);
  }, [editorType, props.filename, setCodeEditCurrentLang, setLangCurr, setLangExts, uniqueKey]);

  React.useEffect(() => {
    langCurrRef.current = langCurr;
  }, [langCurr]);

  React.useEffect(() => {
    if(props.filebody){
      setValue(props.filebody);
    }else if(props.filename) {
      if(props.target) {
        callApi('open_remote_file', {target: props.target, path:props.filename}).then((resp)=>{
          setTabItems(tabItems.map((item) => {
            if(item.key === uniqueKey) {
              item.label = props.tabTitle;
            }
            return item;
          }));
          if(resp && resp.errinfo) {
            message.error(resp.errinfo);
          } else if(resp && resp.hasOwnProperty('content')) {
            const fileBody = Base64.decode(resp.content);
            setValue(fileBody);
          }
        })
      } else {
        callApi('read_file', {path:props.filename}).then((data)=>{
          setTabItems(tabItems.map((item) => {
            if(item.key === uniqueKey) {
              item.label = props.tabTitle;
            }
            return item;
          }));
          if(typeof data === 'string') {
            setValue(data);
          }else if(data && data.errinfo) {
            message.error(data.errinfo);
          }
        })
      }
    }
    window.oypaseTabs = window.oypaseTabs || {}; window.oypaseTabs[uniqueKey] = inputCode.current;
  }, [setCodeEditCurrentLang, props, uniqueKey, message, setTabItems]); // Donot include tabItems,editorType, to avoid loop reload value

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
    <>{
      editorType==='monaco' ?
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
        }}
      /> :
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
    }</>
  )
}
