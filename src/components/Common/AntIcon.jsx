import * as AntIcons from '@ant-design/icons';

const AntIcon = ({ name, ...props }) => {
  const IconComponent = AntIcons[name];
  if (!IconComponent) { // 如果找不到对应的图标，则返回 null 或默认图标
    return null;
    // 或者返回一个默认的图标，例如：return <AntIcons.QuestionCircleOutlined {...props} />;
  }
  return <IconComponent {...props} />;
};

export default AntIcon;
