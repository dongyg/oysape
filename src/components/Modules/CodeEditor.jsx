import React from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { CodeiumEditor } from "@codeium/react-code-editor";
import { Base64 } from 'js-base64';
import { App, Dropdown, Tag } from 'antd';
import { CloseOutlined, SaveOutlined } from '@ant-design/icons';
import { BsThreeDots } from "react-icons/bs";
import { solarizedLight, solarizedDark } from '@uiw/codemirror-theme-solarized';
import { loadLanguage } from '@uiw/codemirror-extensions-langs';

import { useCustomContext } from '../Contexts/CustomContext'
import { callApi, getCodeMirrorLanguages, getMonacoLanguages, isMacOs, isTouchDevice } from '../Common/global';
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'
import TextInputModal from './TextInputModal';

import './CodeEditor.css';

export default function CodeEditor(props) {
  const { message, modal } = App.useApp();
  const { customTheme, tabActiveKey, tabItems, setTabItems, setCodeEditRowColText, setCodeEditCurrentLang, setFooterStatusText, setFolderFiles, editorType, currentLocalProject } = useCustomContext();
  const [showSudoPassword, setShowSudoPassword] = React.useState(false);
  const [sudoAction, setSudoAction] = React.useState(null);
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

  const handleEditorDidMount = (editor, monaco) => {
    inputCode.current = editor;
    window.oypaseTabs = window.oypaseTabs || {};
    window.oypaseTabs[uniqueKey] = inputCode.current;
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
  }

  const onContextClick = (e) => {
    if(e.domEvent) e.domEvent.stopPropagation();
    if(e.key === 'menuCloseTab') {
      window.closeThisTab && window.closeThisTab(uniqueKey);
    }else if(e.key === 'menuOpenQuickCommandPalette') {
      // Codeium Editor
      if (window.oypaseTabs[uniqueKey].getValue) {
        window.oypaseTabs[uniqueKey].focus();
        window.oypaseTabs[uniqueKey].trigger('', 'editor.action.quickCommand', null);
      }
    }else if(e.key === 'menuSaveContent') {
      if(tabActiveKey === uniqueKey) {
        if(window.oypaseTabs[uniqueKey].state && window.oypaseTabs[uniqueKey].state && window.oypaseTabs[uniqueKey].state.doc.toString) {
          // CodeMirror
          saveFile(props.filename, props.tabTitle, window.oypaseTabs[uniqueKey].state.doc.toString(), props.target);
        } else if (window.oypaseTabs[uniqueKey].getValue) {
          // Codeium Editor
          saveFile(props.filename, props.tabTitle, window.oypaseTabs[uniqueKey].getValue(), props.target);
        }
      }
    }
  }
  const contextMenuIconWithDropdown = <Dropdown
    menu={{items: [
        { key: 'menuCloseTab', label: <span>Close <Tag>{isMacOs ? '⌘' : 'Ctrl'}+W</Tag></span>, icon: <CloseOutlined />, },
        { type: 'divider', },
        { key: 'menuSaveContent', label: <span>Save <Tag>{isMacOs ? '⌘' : 'Ctrl'}+S</Tag></span>, icon: <SaveOutlined />, },
        editorType!=='monaco' ? null : { type: 'divider', },
        editorType!=='monaco' ? null : { key: 'menuOpenQuickCommandPalette', label: 'Command Palette', },
      ], onClick: onContextClick}} trigger={['click']}>
    <BsThreeDots />
  </Dropdown>

  const onValuesChange = (val, viewUpdate) => {
    setValue(val);
    var hasSomethingNew = false;
    const newItems = tabItems.map((item) => {
      if(item.key === uniqueKey && item.label.indexOf('* ') !== 0) {
        hasSomethingNew = true;
        item.hasSomethingNew = true;
        item.label = (item.label.indexOf('* ') === 0 ? '' : '* ') + props.tabTitle;
        item.icon = isTouchDevice() ? contextMenuIconWithDropdown : null;
      }
      return item;
    });
    if(hasSomethingNew) setTabItems(newItems);
  }

  React.useEffect(() => {
    const newItems = tabItems.map((item) => {
      if(item.key === uniqueKey) {
        item.label = (item.hasSomethingNew ? '* ' : '') + props.tabTitle;
        item.icon = isTouchDevice() ? contextMenuIconWithDropdown : null;
      }
      return item;
    });
    setTabItems(newItems);
  }, [editorType]); // Change dropdown icon on tab. Don't include tabItems ... to avoid infinite loop

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
              item.icon = isTouchDevice() ? contextMenuIconWithDropdown : null;
            }
            return item;
          }));
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
          setTabItems(tabItems.map((item) => {
            if(item.key === uniqueKey) {
              item.label = props.tabTitle;
              item.icon = isTouchDevice() ? contextMenuIconWithDropdown : null;
            }
            return item;
          }));
          if(typeof data === 'string') {
            setValue(data);
          }else if(data && data.errinfo) {
            message.error(data.errinfo);
          }
        }).catch((err) => {
          message.error(err.message);
        })
      }
    }
    // window.oypaseTabs = window.oypaseTabs || {}; window.oypaseTabs[uniqueKey] = inputCode.current;
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

  const sudoWithPassword = (sudopass) => {
    setShowSudoPassword(false);
    if (sudoAction) {
      sudoAction(sudopass);
    }
  };
  const saveFile = (path, title, content, target) => {
    if(path === 'globalExcludes.json') {
      callApi('updateGlobalExcludes', {'excludes':JSON.parse(content)}).then((resp)=>{
        const newItems = tabItems.map((item) => {
          if(item.key === uniqueKey) {
            item.hasSomethingNew = false;
            item.label = title;
            item.icon = isTouchDevice() ? contextMenuIconWithDropdown : null;
          }
          return item;
        });
        setTabItems(newItems);
        if(resp && resp.folderFiles) {
          let lpname = currentLocalProject.replace('LOCALPPROJECT_', '');
          setFolderFiles(resp.folderFiles[lpname]||[]);
        }
      }).catch((err) => {
        message.error(err.message);
      })
    } else {
      let handleResponse = (data, sudo) => {
        if(data && data.errinfo){
          if(!sudo && data.errinfo.indexOf('Permission denied')>=0) {
            if(data.needPassword) {
              const callMe = (sudopass) => {
                callApi(target?'save_remote_file':'save_file', {path:path, content:content, target:target, sudo:!sudo, password:sudopass}).then((r2)=>{
                  handleResponse(r2, !sudo);
                }).catch((err) => {
                  message.error(err.message);
                })
              }
              setSudoAction(() => callMe);
              setShowSudoPassword(true);
            } else {
              modal.confirm({
                title: 'Permission denied',
                content: 'Do you want to try with sudo?',
                onOk() {
                  callApi(target?'save_remote_file':'save_file', {path:path, content:content, target:target, sudo:!sudo}).then((r2)=>{
                    handleResponse(r2, !sudo);
                  }).catch((err) => {
                    message.error(err.message);
                  });
                },
                onCancel() {},
              })
            }
          }else{
            message.error(data.errinfo);
          }
        } else  {
          const newItems = tabItems.map((item) => {
            if(item.key === uniqueKey) {
              item.hasSomethingNew = false;
              item.label = title;
              item.icon = isTouchDevice() ? contextMenuIconWithDropdown : null;
            }
            return item;
          });
          setTabItems(newItems);
          setFooterStatusText('Saved. '+(target?target+':':'')+path);
          message.success('Saved');
        }
      }
      callApi(target?'save_remote_file':'save_file', {path:path, content:content, target:target, sudo:false}).then((data)=>{
        handleResponse(data);
      }).catch((err) => {
        message.error(err.message);
      });
    }
  }
  useKeyPress(keyMapping["shortcutSave"], (event) => {
    if(tabActiveKey === uniqueKey) {
      if(window.oypaseTabs[uniqueKey].state && window.oypaseTabs[uniqueKey].state && window.oypaseTabs[uniqueKey].state.doc.toString) {
        // CodeMirror
        saveFile(props.filename, props.tabTitle, window.oypaseTabs[uniqueKey].state.doc.toString(), props.target);
      } else if (window.oypaseTabs[uniqueKey].getValue) {
        // Codeium Editor
        saveFile(props.filename, props.tabTitle, window.oypaseTabs[uniqueKey].getValue(), props.target);
      }
    }
    event.preventDefault(); return;
  });

  return (
    <>{
      editorType==='monaco' ?
      <CodeiumEditor height={'100%'}
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
          scrollBeyondLastLine: false,
        }}
      /> :
      <CodeMirror
        style={{ height: '100%' }}
        theme={customTheme.isDark?solarizedDark:solarizedLight}
        basicSetup={{highlightActiveLine:false}}
        value={value}
        extensions={langExts}
        autoFocus={true}
        onCreateEditor={(view, state) => {
          inputCode.current = view;
          window.oypaseTabs = window.oypaseTabs || {};
          window.oypaseTabs[uniqueKey] = inputCode.current;
        }}
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
    }
    {/* For sudo password */}
    <TextInputModal visible={showSudoPassword} defaultValue={""} title={"Permission denied"} onCreate={sudoWithPassword} onCancel={() => setShowSudoPassword(false)} placeholder={"Enter sudo password"} description='Sudo with the password or Cancel' password={true}></TextInputModal>
    </>
  )
}
