import { Col, Row, Button } from 'antd';
import { BsThreeDots } from "react-icons/bs";

import { useCustomContext } from '../Contexts/CustomContext'

import SearchInput from './SearchInput';
import SearchLanguage from './SearchLanguage';

import './HeadFrame.css';

const HeadFrame = () => {
  const { searchMode } = useCustomContext();

  return (
    <Row wrap={false} className='ant-layout-header' style={{ position: 'relative', overflow: 'visible', zIndex: 3 }}>
      <Col flex="auto" style={{ textAlign: 'center' }}>
        {searchMode === 'language'
          ? <SearchLanguage style={{ width: '100%' }}></SearchLanguage>
          : <SearchInput style={{ width: '100%' }}></SearchInput>
        }
      </Col>
      <Col flex="none">
        <Button type='text' icon={<BsThreeDots />} onClick={(event) => {
          //TODO:
        }}></Button>
      </Col>
    </Row>
  )
};
export default HeadFrame;
