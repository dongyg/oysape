import React, { useState, useEffect } from 'react'
import { Input, Space, Tag, Tooltip } from 'antd';
import { PlusOutlined } from "@ant-design/icons";

export default function TagsComponent({tags, onChange, backgroundColor, ...props}) {
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [editInputIndex, setEditInputIndex] = useState(-1);
  const [editInputValue, setEditInputValue] = useState('');
  const inputRef = React.useRef(null);
  const editInputRef = React.useRef(null);

  useEffect(() => {
    if (inputVisible) {
      inputRef.current?.focus();
    }
  }, [inputVisible]);
  useEffect(() => {
    editInputRef.current?.focus();
  }, [editInputValue]);
  const handleClose = (removedTag) => {
    const newTags = tags.filter((tag) => tag !== removedTag);
    if(onChange) {
      onChange(newTags);
    }
  };
  const showInput = () => {
    setInputVisible(true);
  };
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };
  const handleInputConfirm = () => {
    if (inputValue && !tags.includes(inputValue)) {
      if(onChange) {
        onChange([...tags, inputValue]);
      }
    }
    setInputVisible(false);
    setInputValue('');
  };
  const handleEditInputChange = (e) => {
    setEditInputValue(e.target.value);
  };
  const handleEditInputConfirm = () => {
    const newTags = [...tags];
    if(editInputValue) {
      newTags[editInputIndex] = editInputValue;
    } else {
      newTags.splice(editInputIndex, 1);
    }
    if(onChange) {
      onChange(newTags);
    }
    setEditInputIndex(-1);
    setEditInputValue('');
  };
  const tagInputStyle = {
    width: 64,
    height: 22,
    marginInlineEnd: 8,
    verticalAlign: 'top',
    marginLeft: 4,
    marginTop: 1,
  };
  const tagPlusStyle = {
    height: 22,
    background: backgroundColor,
    borderStyle: 'dashed',
  };

  return (
    <Space size={[0, 0]} wrap>
      {tags.map((tag, index) => {
        if (editInputIndex === index) {
          return (
            <Input ref={editInputRef} key={tag} size="small" style={tagInputStyle} value={editInputValue} onChange={handleEditInputChange} onBlur={handleEditInputConfirm} onPressEnter={handleEditInputConfirm} autoCorrect='off' autoComplete='off' autoCapitalize='off' />
          );
        }
        const isLongTag = tag.length > 20;
        const tagElem = (
          <Tag key={'server_tag_'+tag} closable={true} style={{ userSelect: 'none', }} onClose={() => handleClose(tag)}>
            <span onDoubleClick={(e) => {
                setEditInputIndex(index);
                setEditInputValue(tag);
                e.preventDefault();
              }}
            >
              {isLongTag ? `${tag.slice(0, 20)}...` : tag}
            </span>
          </Tag>
        );
        return isLongTag ? (
          <Tooltip title={tag} key={tag}>{tagElem}</Tooltip>
        ) : ( tagElem );
      })}
      {inputVisible ? (
        <Input ref={inputRef} type="text" size="small" style={tagInputStyle} value={inputValue} onChange={handleInputChange} onBlur={handleInputConfirm} onPressEnter={handleInputConfirm} autoCorrect='off' autoComplete='off' autoCapitalize='off' />
      ) : (
        <Tag style={tagPlusStyle} icon={<PlusOutlined />} onClick={showInput}>New Tag</Tag>
      )}
    </Space>
  )
}
