import { useState, useRef, useEffect } from 'react';
import { App, Button, AutoComplete, Input, Tag } from 'antd';
import { SearchOutlined } from "@ant-design/icons";
import { BsCommand, BsArrowReturnLeft } from "react-icons/bs";
import { PiControl } from "react-icons/pi";

import { callApi } from '../Common/global';
import { useCustomContext } from '../Contexts/CustomContext'
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'
import { getShowTitle, getPathAndName, flatFileTree, parseTaskString0, getUniqueKey, calculateMD5 } from '../Common/global';
import CodeEditor from '../Modules/CodeEditor';
import Terminal from '../Modules/UITerminal1';

import './SearchInput.css';

const SearchInput = () => {
  const { message } = App.useApp();
  const { serverItems, taskItems, pipelineItems, projectFiles, tabItems, setTabItems, setTabActiveKey } = useCustomContext();
  const [options, setOptions] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [dropMenuShowed, setDropMenuShowed] = useState(false);
  const inputSearch = useRef(null);
  const searchMode = useRef(''); // '' | '@' | ':' | '!'
  const indexServerSign = '@';
  const indexTaskSign = ':';
  const indexPipelineSign = '!';
  const indexAllSigns = [indexServerSign, indexTaskSign, indexPipelineSign];

  const onSelect = (value, options) => {
    // console.log('onSelect', value, options);
    var lastMode = searchMode.current;
    if(lastMode === indexTaskSign) { // For task
      setTimeout(() => {
        if(inputSearch.current.input.value.indexOf(indexServerSign)>=0) {
          setSearchValue(inputSearch.current.input.value.split(lastMode)[0]+lastMode+value);
          searchMode.current = '';
        }else{
          setSearchValue(inputSearch.current.input.value.split(lastMode)[0]+lastMode+value+' '+indexServerSign);
          searchMode.current = indexServerSign;
        }
        handleSearch(searchMode.current);
      }, 5)
    } else if (lastMode === indexServerSign) { // For server
      setTimeout(() => {
        setSearchValue(inputSearch.current.input.value.split(lastMode)[0]+lastMode+value);
        searchMode.current = '';
        handleSearch(searchMode.current);
      }, 5)
    } else if (lastMode === indexPipelineSign) {
      setTimeout(() => {
        setSearchValue(inputSearch.current.input.value.split(lastMode)[0]+lastMode+value);
        searchMode.current = '';
        handleSearch(searchMode.current);
      }, 5)
    } else {
      setTimeout(() => {
        if(value&&[indexTaskSign].includes(value[0])) {
          setSearchValue(value+' '+indexServerSign);
          searchMode.current = indexServerSign;
        } else {
          setSearchValue(value);
        }
        handleSearch(searchMode.current);
      }, 5)
    }
  };
  const onChange = (e) => {
    // console.log('onChange', inputSearch.current.input.value);
    setSearchValue(inputSearch.current.input.value);
    if(inputSearch.current.input.value==='') searchMode.current = '';
    // console.log('searchValue', inputSearch.current.input.value);
    // console.log('searchMode.current', searchMode.current);
  }
  const onKeyDown = (e) => {
    // console.log('onKeyDown', e.key, e.keyCode);
    if (e.key === indexServerSign) {
      if (searchValue.indexOf(indexServerSign) >= 0 || searchValue.indexOf(indexPipelineSign) >= 0 || indexAllSigns.includes(searchValue[searchValue.length-1])) {e.preventDefault(); return;}
      searchMode.current = indexServerSign;
    } else if (e.key === indexTaskSign) {
      if (searchValue.indexOf(indexTaskSign) >= 0 || searchValue.indexOf(indexPipelineSign) >= 0 || indexAllSigns.includes(searchValue[searchValue.length-1])) {e.preventDefault(); return;}
      searchMode.current = indexTaskSign;
    } else if (e.key === indexPipelineSign) {
      if (searchValue.indexOf(indexServerSign) >= 0 || searchValue.indexOf(indexTaskSign) >= 0 || indexAllSigns.includes(searchValue[searchValue.length-1])) {e.preventDefault(); return;}
      searchMode.current = indexPipelineSign;
    } else if ([9, 13, 27].includes(e.keyCode)) { // 27-Esc, 8-Back, 9-Tab, 13-Enter
      if(indexAllSigns.includes(searchMode.current)){
        searchMode.current = '';
      }
      if([13].includes(e.keyCode) && (e.metaKey === true || e.ctrlKey === true)){
        executeInput(searchValue);
      }
    } else if ([8].includes(e.keyCode)) {
      if (searchValue.indexOf(indexServerSign) >= 0 && searchValue.indexOf(indexServerSign)>searchValue.indexOf(indexTaskSign)) searchMode.current = indexServerSign;
      if (searchValue.indexOf(indexTaskSign) >= 0 && searchValue.indexOf(indexTaskSign)>searchValue.indexOf(indexServerSign)) searchMode.current = indexTaskSign;
      if (searchValue.indexOf(indexPipelineSign) >= 0) searchMode.current = indexPipelineSign;
    }
  }
  const getServersForSearch = (query) => {
    const v1 = query.indexOf(indexServerSign)>=0;
    const prefix = v1 ? '' : indexServerSign;
    query = v1 ? query.toLowerCase().split(indexServerSign)[1] : query;
    return serverItems ? serverItems.filter((item) => getShowTitle(item.name).toLowerCase().indexOf(query) >= 0).map((item) => {
      return { value: prefix+item.name, label: (
        <div style={{ display: 'flex', justifyContent: 'space-between'}}>
          <div>{prefix+getShowTitle(item.name)}</div>
          <div style={{ textAlign: 'right' }}>
            { item.tags ? item.tags.map((tag) => (<Tag key={getUniqueKey()}>{tag}</Tag>)) : null }
          </div>
        </div>
      )}
    }) : [];
  }
  const getTasksForSearch = (query) => {
    const v1 = query.indexOf(indexTaskSign)>=0;
    const prefix = v1 ? '' : indexTaskSign;
    query = v1 ? query.toLowerCase().split(indexTaskSign)[1] : query;
    return taskItems ? taskItems.filter((item) => getShowTitle(item.name).toLowerCase().indexOf(query) >= 0).map((item) => {
      return { value: prefix+item.name, label: (
        <div style={{ display: 'flex', justifyContent: 'space-between'}}>
          <div>{prefix+getShowTitle(item.name)}</div><div>
            { item.interaction ? (<Tag key={getUniqueKey()}>{item.interaction}</Tag>) : null }
            { item.tag ? (<Tag key={getUniqueKey()}>{item.tag}</Tag>) : null }
          </div>
        </div>
      )}
    }) : [];
  }
  const getPipelinesForSearch = (query) => {
    const v1 = query.indexOf(indexPipelineSign)>=0;
    const prefix = v1 ? '' : indexPipelineSign;
    query = v1 ? query.toLowerCase().split(indexPipelineSign)[1] : query;
    return pipelineItems ? pipelineItems.filter((item) => item.name.toLowerCase().indexOf(query) >= 0).map((item) => {
      return { value: prefix+item.name, label: (
        <div style={{ display: 'flex', justifyContent: 'space-between'}}>
          <div>{prefix+item.name}</div><div>
            { item.tags ? item.tags.map((tag) => (<Tag key={getUniqueKey()}>{tag}</Tag>)) : null }
          </div>
        </div>
      )}
    }) : [];
  }
  const getFilesForSearch = (query) => {
    const flatFiles = flatFileTree(JSON.parse(JSON.stringify(projectFiles)));
    return projectFiles ? flatFiles.filter((item) => getPathAndName(item).toLowerCase().indexOf(query) >= 0).map((item) => {
      return { value: getPathAndName(item), label: (<div>{getPathAndName(item)}</div>) }
    }) : [];
  }
  const searchResult = (query) => {
    // console.log('searchResult: ', query);
    if (searchMode.current === indexServerSign) {
      return getServersForSearch(query);
    } else if (searchMode.current === indexTaskSign) {
      return getTasksForSearch(query);
    } else if (searchMode.current === indexPipelineSign) {
      return getPipelinesForSearch(query);
    } else {
      return getServersForSearch(query).concat(getTasksForSearch(query)).concat(getFilesForSearch(query));
    }
  };
  const handleSearch = (value) => {
    const v1 = searchResult(value);
    setOptions(value ? v1 : []);
    // console.log('handleSearch', value, v1.length);
    setDropMenuShowed(value && v1.length > 0);
  };

  const openServerTerminal = (serverKey, taskKey) => {
    const newIdx = tabItems.filter((item) => item.serverKey === serverKey).length + 1;
    const uniqueKey = getUniqueKey();
    setTabItems([...tabItems || [], {
      key: uniqueKey,
      serverKey: serverKey,
      label: serverKey+'('+newIdx+')',
      children: <Terminal uniqueKey={uniqueKey} serverKey={serverKey} taskKey={taskKey} />,
    }]);
    setTabActiveKey(uniqueKey);
  };

  const executeInput = (text) => {
    if(text.indexOf(indexPipelineSign) === 0){
      window.callPipeline(text.substring(1));
    } else if (text.indexOf(indexServerSign) >= 0 || text.indexOf(indexTaskSign) >= 0) {
      const taskInput = parseTaskString0(text);
      // console.log('executeInput', text, taskInput);
      const tasks = taskItems.filter((item) => item.name === taskInput.task && taskInput.task !== '');
      const servers = serverItems.filter((item) => item.name === taskInput.server && taskInput.server !== '');
      if(taskInput.server && !taskInput.task) {
        // Open a server terminal
        openServerTerminal(taskInput.server);
      } else if (servers.length>0 && tasks.length>0 && tasks[0].interaction==='terminal' && tasks[0].cmds.length>0) {
        // Open a server terminal, and run a task
        openServerTerminal(taskInput.server, taskInput.task);
      } else if (tasks.length>0 && servers.length>0) {
        // Run a task in Workspace
        window.callTask(tasks[0], servers[0], taskInput);
      }
    } else {
      openProjectFile(text, text.split(/[\\/]/).pop());
    }
  }

  const onSearch = (event) => {
    setShowSearch(true);
    setTimeout(() => {
      inputSearch.current.focus();
    }, 50)
  }

  useKeyPress(keyMapping["showAndRunCommand"], (event) => {
    onSearch(event);
    event.preventDefault(); return;
  });
  useKeyPress(keyMapping["showAndSelectServer"], (event) => {
    onSearch(event);
    setTimeout(() => {
      setSearchValue(indexServerSign);
      searchMode.current = indexServerSign;
      handleSearch(searchMode.current);
    }, 11);
    event.preventDefault(); return;
  });
  useKeyPress(keyMapping["showAndSelectTask"], (event) => {
    onSearch(event);
    setTimeout(() => {
      setSearchValue(indexTaskSign);
      searchMode.current = indexTaskSign;
      handleSearch(searchMode.current);
    }, 11);
    event.preventDefault(); return;
  });
  useKeyPress(keyMapping["showAndSelectPipeline"], (event) => {
    onSearch(event);
    setTimeout(() => {
      setSearchValue(indexPipelineSign);
      searchMode.current = indexPipelineSign;
      handleSearch(searchMode.current);
    }, 11);
    event.preventDefault(); return;
  });

  const fillSearchServer = (serverName) => {
    setSearchValue(indexServerSign + serverName + ' ' + indexTaskSign);
    searchMode.current = indexTaskSign;
    handleSearch(searchMode.current);
    onSearch(null);
  }
  const fillSearchTask = (taskName) => {
    setSearchValue(indexTaskSign + taskName + ' ' + indexServerSign);
    searchMode.current = indexServerSign;
    handleSearch(searchMode.current);
    onSearch(null);
  }
  const fillSearchPipeline = (pipelineName) => {
    setSearchValue(indexPipelineSign + pipelineName);
    searchMode.current = '';
    handleSearch(searchMode.current);
    onSearch(null);
  }
  const openProjectFile = (filepath, title) => {
    callApi('get_absolute_path', {path:filepath}).then((absPath)=>{
      if(typeof absPath === 'string') {
        if(absPath.length>0){
          callApi('read_file', {path:absPath}).then((fileBody)=>{
            if(typeof fileBody === 'string' && fileBody.length>0) {
              const uniqueKey = calculateMD5(absPath);
              if (tabItems.filter((item) => item.key === uniqueKey)[0]) {
              } else {
                setTabItems([...tabItems || [], {
                  key: uniqueKey,
                  fileKey: fileBody,
                  label: title,
                  children: <CodeEditor uniqueKey={uniqueKey} filename={absPath} filebody={fileBody} tabTitle={title} />,
                }]);
              }
              setTabActiveKey(uniqueKey);
            }else if(fileBody && fileBody.errinfo) {
              message.error(fileBody.errinfo);
            }
          })
        }else{
          message.error(filepath + ' not found');
        }
      }else if(absPath && absPath.errinfo) {
        message.error(absPath.errinfo);
      }
    })
  }

  useEffect(() => {
    window.fillSearchServer = fillSearchServer;
    window.fillSearchTask = fillSearchTask;
    window.fillSearchPipeline = fillSearchPipeline;
    window.openProjectFile = openProjectFile;
    window.openServerTerminal = openServerTerminal;
    return () => {
      window.fillSearchServer = undefined;
      window.fillSearchTask = undefined;
      window.fillSearchPipeline = undefined;
      window.openProjectFile = undefined;
      window.openServerTerminal = undefined;
    }
  })
  return (
    <div style={{ width: '50%', margin: '0 auto' }}>
      <Button icon={<SearchOutlined />} style={{ width: '100%', display: !showSearch ? 'block' : 'none', transition: 'none' }} onClick={onSearch}>Workspace</Button>
      <AutoComplete
        popupMatchSelectWidth={'100%'}
        defaultActiveFirstOption={true}
        open={showDropdown}
        style={{ width: '100%', display: showSearch ? 'block' : 'none', transition: 'none' }}
        value={searchValue}
        options={options}
        onBlur={() => { setShowSearch(false); setSearchValue(''); setShowDropdown(false); setOptions([]); searchMode.current = ''; }}
        onFocus={() => { setShowDropdown(true); }}
        onSelect={onSelect}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onSearch={handleSearch}
      >
        <Input ref={inputSearch}
          autoComplete='off'
          autoCapitalize='off'
          autoCorrect='off'
          spellCheck='false'
          placeholder="Type : for choosing a Task, or @ for Server, or ! for Pipeline"
          allowClear={{ clearIcon: <div>{!dropMenuShowed?(window.oypaseTabs&&window.oypaseTabs.workspace&&window.oypaseTabs.workspace._core.browser.isMac?<BsCommand/>:<PiControl/>):null}<BsArrowReturnLeft /></div> }}
        />
      </AutoComplete>
    </div>
  )
};
export default SearchInput;
