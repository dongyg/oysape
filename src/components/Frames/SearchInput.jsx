import { useState, useRef, useEffect } from 'react';
import { App, Button, AutoComplete, Input, Tag } from 'antd';
import { SearchOutlined, LoadingOutlined } from "@ant-design/icons";
import { BsCommand, BsArrowReturnLeft } from "react-icons/bs";
import { PiControl } from "react-icons/pi";

import { callApi, getCredentials } from '../Common/global';
import { useCustomContext } from '../Contexts/CustomContext'
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'
import { getShowTitle, getPathAndName, flatFileTree, parseTaskString0, getUniqueKey, calculateMD5, isDesktopVersion } from '../Common/global';
import CodeEditor from '../Modules/CodeEditor';
import Terminal from '../Modules/UITerminal1';
import IframeComponent from './IframeComponent';
// import CredentialsModal from '../Server/CredentialsModal';
import WebsiteCredentials from '../Websites/WebsiteCredentials';

import './SearchInput.css';

const SearchInput = () => {
  const { message } = App.useApp();
  const { folderFiles, tabItems, setTabItems, setTabActiveKey, userSession, setUserSession, tabActiveKey } = useCustomContext();
  const [options, setOptions] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [dropMenuShowed, setDropMenuShowed] = useState(false);
  const [visibleCredentialsModal, setVisibleCredentialsModal] = useState(false);
  const [passForServer, setPassForServer] = useState(null);
  const callbackExecuteInput = useRef(null);
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
    } else if (value&&value.indexOf('team:')>=0){
      // If key is teamId, switch team. Reset search
      if(userSession && userSession.teams){
        const key = value.split(':')[1];
        if (key !== userSession.team0 && key in userSession.teams) {
          callApi('switchToTeam', {tid: key, credentials: getCredentials()}).then((res) => {
            message.success('Switched to ' + userSession.teams[key].tname);
            setUserSession(res);
            window.reloadFolderFiles && window.reloadFolderFiles();
          }).catch((err) => {
            message.error(err.message);
          });
        } else {
          // Team not found
        }
      }
      handleEsc();
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
  const handleEsc = (e) => {
    setShowSearch(false); setSearchValue(''); setShowDropdown(false); setOptions([]); searchMode.current = '';
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
      } else if([27].includes(e.keyCode)){
        handleEsc(e);
      }
    } else if ([8].includes(e.keyCode)) {
      if (searchValue.indexOf(indexServerSign) >= 0 && searchValue.indexOf(indexServerSign)>searchValue.indexOf(indexTaskSign)) searchMode.current = indexServerSign;
      if (searchValue.indexOf(indexTaskSign) >= 0 && searchValue.indexOf(indexTaskSign)>searchValue.indexOf(indexServerSign)) searchMode.current = indexTaskSign;
      if (searchValue.indexOf(indexPipelineSign) >= 0) searchMode.current = indexPipelineSign;
    }
  }
  const getTeamsForSearch = (query) => {
    return Object.entries(userSession.teams).flatMap(([tid, item]) => {
      return query===''||('Team: '+item.tname).toLowerCase().includes(query) ? { value: 'team:'+tid, label: 'Team: '+item.tname } : null
    }).filter((item) => item !== null);
  }
  const getServersForSearch = (query) => {
    const v1 = query.indexOf(indexServerSign)>=0;
    const prefix = v1 ? '' : indexServerSign;
    query = v1 ? query.toLowerCase().split(indexServerSign)[1] : query;
    var retItems = [];
    // Insert current terminal if the active tab is a terminal when input starts with :
    // This means that the user can run a task in the current terminal
    if(searchValue.startsWith(indexTaskSign)) {
      let currentTermTab = tabItems.find(x => tabActiveKey === x.key && x.serverKey);
      if(currentTermTab) {
        let serverItem = userSession.servers.find(x => x.name === currentTermTab.serverKey);
        if(serverItem) {
          retItems.push({ value: 'current_terminal('+serverItem.name+')', label: (
            <div style={{ display: 'flex', justifyContent: 'space-between'}}>
              <div>{prefix+'Current Terminal ('+serverItem.name+')'}</div>
              <div style={{ textAlign: 'right' }}>
                { serverItem.tags ? serverItem.tags.map((tag) => (<Tag key={getUniqueKey()}>{tag}</Tag>)) : null }
              </div>
            </div>
          )});
        }
      }
    }
    return retItems.concat(userSession.servers.filter((item) => getShowTitle(item.name).toLowerCase().includes(query) || (item.tags&&item.tags.join(',').toLowerCase().includes(query))).map((item) => {
      return { value: prefix+item.name, label: (
        <div style={{ display: 'flex', justifyContent: 'space-between'}}>
          <div>{prefix+getShowTitle(item.name)}</div>
          <div style={{ textAlign: 'right' }}>
            { item.tags ? item.tags.map((tag) => (<Tag key={getUniqueKey()}>{tag}</Tag>)) : null }
          </div>
        </div>
      )}
    }));
  }
  const getTasksForSearch = (query) => {
    const v1 = query.indexOf(indexTaskSign)>=0;
    const prefix = v1 ? '' : indexTaskSign;
    query = v1 ? query.toLowerCase().split(indexTaskSign)[1] : query;
    return userSession.tasks.filter((item) => getShowTitle(item.name).toLowerCase().includes(query) || (item.tags&&item.tags.join(',').toLowerCase().includes(query))).map((item) => {
      return { value: prefix+item.name, label: (
        <div style={{ display: 'flex', justifyContent: 'space-between'}}>
          <div>{prefix+getShowTitle(item.name)}</div><div>
            { item.interaction ? (<Tag key={getUniqueKey()}>{item.interaction}</Tag>) : null }
            { item.tags ? item.tags.map((tag) => (<Tag key={getUniqueKey()}>{tag}</Tag>)) : null }
          </div>
        </div>
      )}
    });
  }
  const getPipelinesForSearch = (query) => {
    const v1 = query.indexOf(indexPipelineSign)>=0;
    const prefix = v1 ? '' : indexPipelineSign;
    query = v1 ? query.toLowerCase().split(indexPipelineSign)[1] : query;
    return userSession.pipelines.filter((item) => item.name.toLowerCase().includes(query) || (item.tags&&item.tags.join(',').toLowerCase().includes(query))).map((item) => {
      return { value: prefix+item.name, label: (
        <div style={{ display: 'flex', justifyContent: 'space-between'}}>
          <div>{prefix+item.name}</div><div>
            { item.tags ? item.tags.map((tag) => (<Tag key={getUniqueKey()}>{tag}</Tag>)) : null }
          </div>
        </div>
      )}
    });
  }
  const getFilesForSearch = (query) => {
    const flatFiles = folderFiles ? flatFileTree(JSON.parse(JSON.stringify(folderFiles))) : [];
    return folderFiles ? flatFiles.filter((item) => getPathAndName(item).toLowerCase().indexOf(query) >= 0).map((item) => {
      return { value: getPathAndName(item), label: (<div>{getPathAndName(item)}</div>) }
    }) : [];
  }
  const searchResult = (query) => {
    // console.log('searchResult: ', query, searchMode.current, inputSearch.current.input.value);
    if (searchMode.current === indexServerSign) {
      return getServersForSearch(query);
    } else if (searchMode.current === indexTaskSign) {
      return getTasksForSearch(query);
    } else if (searchMode.current === indexPipelineSign) {
      return getPipelinesForSearch(query);
    } else if (searchMode.current === '') {
      return getTeamsForSearch(query).concat(getServersForSearch(query)).concat(getTasksForSearch(query)).concat(getPipelinesForSearch(query)).concat(getFilesForSearch(query));
    }
  };
  const handleSearch = (value) => {
    const v1 = searchResult(value);
    if(inputSearch.current.input.value==='') {
      setOptions(v1 || []);
      setDropMenuShowed(v1 && v1.length > 0);
    } else {
      setOptions(value ? v1 : []);
      setDropMenuShowed(value && v1.length > 0);
    }
  };

  const openWebpageInTab = (url, title) => {
    let tabKey = calculateMD5(url);
    const findItem = tabItems.find((item) => item.key === tabKey);
    if(findItem) {
      setTabActiveKey(findItem.key);
    }else{
      setTabItems([...tabItems || [], {
        key: tabKey,
        label: title || url,
        children: <IframeComponent src={url} title={title} />,
      }]);
      setTabActiveKey(tabKey);
    }
  }

  const execFunctionByEnsuringServer = (serverKey, callback) => {
    // Findout if the server has a credential. If not, ask user to provide one.
    // callTask or openServerTerminal will be called when the credential is provided, through callbackExecuteInput
    const callMe = () => {
      callbackExecuteInput.current = null;
      if(callback) callback();
    }
    const v1 = userSession.servers.find((item) => item.name === serverKey);
    if(v1 && typeof v1.credType === 'undefined') {
      if(isDesktopVersion) {
        setPassForServer( v1.key );
        callbackExecuteInput.current = callMe;
        setVisibleCredentialsModal(true);
      } else {
        message.error('No credential set for server '+serverKey);
      }
    } else {
      callMe();
    }
  }
  const openServerTerminal = (serverKey, taskKey, command) => {
    const callMe = () => {
      const newIdx = tabItems.filter((item) => item.serverKey === serverKey).length + 1;
      const uniqueKey = getUniqueKey();
      setTabItems([...tabItems || [], {
        key: uniqueKey,
        serverKey: serverKey,
        label: serverKey+'('+newIdx+')',
        children: <Terminal uniqueKey={uniqueKey} serverKey={serverKey} taskKey={taskKey} withCommand={command} />,
      }]);
      setTabActiveKey(uniqueKey);
    }
    execFunctionByEnsuringServer(serverKey, callMe);
  };

  const executeInput = (text) => {
    // console.log('executeInput: ', text);
    if(text.indexOf(indexPipelineSign) === 0){
      const pipelineName = text.substring(1);
      const pipelineObj = userSession.pipelines.filter((item) => item.name === pipelineName)[0];
      // If there are servers without password and private key, will ask user to provide a password.
      // The pipeline will be executed only when all servers have password or private key.
      // But, the passwords user given could be empty, then the system default SSH private key files will be used.
      // Furthermore, if the password user given is not correct, the user has to restart the App. He/she will be asked to provide password again.
      // Loop 1, findout if all servers have password
      let allHavePass = true;
      let lastNoPass = null;
      pipelineObj.steps.forEach((step) => {
        const v1 = userSession.servers.find((item) => item.name === step.target);
        if(v1 && typeof v1.credType === 'undefined') {
          allHavePass = false;
          lastNoPass = JSON.stringify(step);
        }
      })
      // Loop 2, ask user to provide password for servers without password
      pipelineObj.steps.forEach((step) => {
        const callMe = () => {
          setPassForServer(null);
          message.info('Please run this pipeline again.');
        }
        execFunctionByEnsuringServer(step.target, lastNoPass===JSON.stringify(step)?callMe:null);
      })
      // Finally, execute the pipeline if all servers have password
      if(allHavePass) {
        window.callPipeline(pipelineObj);
      }
    } else if (text.indexOf(indexServerSign) >= 0 || text.indexOf(indexTaskSign) >= 0) {
      const taskInput = parseTaskString0(text);
      var inCurrentTerminal = false;
      if(taskInput.server.startsWith('current_terminal(')) {
        taskInput.server = taskInput.server.substring(0,taskInput.server.length-1).substring(17);
        inCurrentTerminal = true;
      }
      // console.log('executeInput', text, taskInput);
      const taskObj = userSession.tasks.find((item) => taskInput.task !== '' && item.name === taskInput.task);
      const serverObj = userSession.servers.find((item) => taskInput.server !== '' && item.name === taskInput.server);
      if(taskInput.server && !taskInput.task) {
        // Open a server terminal
        if(userSession.accesses.terminal) {
          openServerTerminal(taskInput.server);
        }
      } else if (serverObj && taskObj && inCurrentTerminal) {
        // Run a task in current terminal
        console.log('Run a task in current terminal', taskInput.server, taskInput.task);
        callApi('runTaskInTerminal', {uniqueKey: tabActiveKey, taskKey: taskInput.task}).then(res => {
          handleEsc();
          if(res && res.errinfo) {
            message.error(res.errinfo);
          }
        }).catch(err => { message.error(err.message) });
      } else if (serverObj && taskObj && taskObj.interaction==='terminal' && taskObj.cmds.length>0) {
        // Open a server terminal, and run a task
        openServerTerminal(taskInput.server, taskInput.task);
      } else if (taskObj && serverObj) {
        // Run a task in Workspace. Could be interactive or not
        const callMe = () => {
          window.callTask(taskObj, serverObj, taskInput);
        }
        execFunctionByEnsuringServer(serverObj.key, callMe);
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
    setTimeout(() => {
      setSearchValue('');
      handleSearch('');
    }, 11);
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
          const uniqueKey = calculateMD5(absPath);
          if (tabItems.find((item) => item.key === uniqueKey)) {
          } else {
            setTabItems([...tabItems || [], {
              key: uniqueKey,
              label: <><LoadingOutlined/> {title}</>,
              children: <CodeEditor uniqueKey={uniqueKey} filename={absPath} tabTitle={title} />,
            }]);
          }
          setTabActiveKey(uniqueKey);
        }else{
          message.error(filepath + ' not found');
        }
      }else if(absPath && absPath.errinfo) {
        message.error(absPath.errinfo);
      }
    }).catch((err) => {
      message.error(err.message);
    })
  }

  const handleCredentialsCancel = () => {
    setVisibleCredentialsModal(false);
  }

  const handleCredentialsChoose = (data) => {
    callApi('set_credential_for_server', {credential: data, serverKey: passForServer}).then((res) => {
      if(res&&res.email) {
        // saveCredentialMapping(userSession.team0, passForServer, data['alias']);
        setUserSession(res);
        if(callbackExecuteInput.current) {
          callbackExecuteInput.current();
        }
      }else if (res && res.errinfo) {
        message.error(res.errinfo);
      }
    }).catch((err) => {
      message.error(err.message);
    })
  }

  useEffect(() => {
    window.fillSearchServer = fillSearchServer;
    window.fillSearchTask = fillSearchTask;
    window.fillSearchPipeline = fillSearchPipeline;
    window.openProjectFile = openProjectFile;
    window.openServerTerminal = openServerTerminal;
    window.openWebpageInTab = openWebpageInTab;
    return () => {
      window.fillSearchServer = undefined;
      window.fillSearchTask = undefined;
      window.fillSearchPipeline = undefined;
      window.openProjectFile = undefined;
      window.openServerTerminal = undefined;
      window.openWebpageInTab = undefined;
    }
  })

  return (
    <div style={{ width: '100%', padding: '0 12px' }}>
      <Button icon={<SearchOutlined />} style={{ width: '100%', display: !showSearch ? 'block' : 'none', transition: 'none' }} onClick={ (e) => { onSearch(e); setTimeout(() => {
          setSearchValue('');
          handleSearch('');
        }, 11); } }>
        &nbsp;{ userSession && userSession.teams && userSession.teams[userSession.team0] && userSession.teams[userSession.team0].tname ?
          userSession.teams[userSession.team0].tname :
          'Workspace'
        }
      </Button>
      <AutoComplete
        popupMatchSelectWidth={'100%'}
        defaultActiveFirstOption={true}
        open={showDropdown}
        style={{ width: '100%', display: showSearch ? 'block' : 'none', transition: 'none' }}
        value={searchValue}
        options={options}
        onBlur={(e) => { handleEsc(e); }}
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
          allowClear={{ clearIcon: <div onClick={
            () => { executeInput(searchValue); }
          }>{!dropMenuShowed?(window.oypaseTabs&&window.oypaseTabs.workspace&&window.oypaseTabs.workspace._core.browser.isMac?<BsCommand/>:<PiControl/>):null}<BsArrowReturnLeft /></div> }}
        />
      </AutoComplete>
      {/* <CredentialsModal visible={visibleCredentialsModal} onCancel={handleCredentialsCancel} onChoose={handleCredentialsChoose} onRemove={() => {}} initialMode="choose" initTitle={'Choose Credential'+(passForServer?' for '+passForServer:'')} /> */}
      <WebsiteCredentials obh={'localhost'} visible={visibleCredentialsModal} initialMode="choose" onCancel={handleCredentialsCancel} onChoose={handleCredentialsChoose} onRemove={() => {}} initTitle={'Choose Credential'+(passForServer?' for '+passForServer:'')} />
    </div>
  )
};
export default SearchInput;
