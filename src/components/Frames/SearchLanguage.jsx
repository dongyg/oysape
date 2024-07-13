import { useState, useRef } from 'react';
import { AutoComplete, Input } from 'antd';

import { useCustomContext } from '../Contexts/CustomContext'
import { getLanguageDictCodeMirror, getLanguageDictMonaco } from '../Common/global';

import './SearchInput.css';

const SearchLanguage = () => {
  const { tabActiveKey, setSearchMode, editorType } = useCustomContext();
  const [options, setOptions] = useState(Object.keys(editorType==='monaco'?getLanguageDictMonaco:getLanguageDictCodeMirror).map((lang) => { return { value: lang, label: (<div>{lang}</div>) } }));
  const [searchValue, setSearchValue] = useState('');
  const inputSearch = useRef(null);

  const onSelect = (value) => {
    setTimeout(() => {
        if(window['chooseLang_'+tabActiveKey]) window['chooseLang_'+tabActiveKey](value);
        onBlur();
    }, 5)
  };
  const onChange = (e) => {
    setSearchValue(inputSearch.current.input.value);
  }
  const onKeyDown = (e) => {
    if ([27].includes(e.keyCode)) {
        onBlur();
    }
  }
  const getLanguagesForSearch = (query) => {
    query = query.toLowerCase();
    return Object.keys(editorType==='monaco'?getLanguageDictMonaco:getLanguageDictCodeMirror).filter((langName) => query === '' || langName.toLowerCase().indexOf(query) >= 0).map((langName) => {
      return { value: langName, label: (<div>{langName}</div>) }
    })
  }
  const handleSearch = (value) => {
    setOptions(getLanguagesForSearch(value));
  };

  const onBlur = () => {
    setSearchMode('');
  }
  return (
    <div style={{ width: '100%', padding: '0 12px' }}>
      <AutoComplete autoFocus={true} popupMatchSelectWidth={'100%'} defaultActiveFirstOption={true} open={true}
        style={{ width: '100%', transition: 'none' }}
        value={searchValue}
        options={options}
        filterOption={(inputValue, option) =>
          option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
        }
        onBlur={onBlur}
        onSelect={onSelect}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onSearch={handleSearch}
      >
        <Input ref={inputSearch}
          autoComplete='off' autoCapitalize='off' autoCorrect='off' spellCheck='false'
          placeholder="Select Language" />
      </AutoComplete>
    </div>
  )
};
export default SearchLanguage;
