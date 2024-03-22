import { useCustomContext } from '../Contexts/CustomContext'
import { useKeyPress, keyMapping } from '../Contexts/useKeyPress'

// This is a component that can be used to display an iframe. It can be used to display any webpage as a tab.

const IframeComponent = (props) => {
    const src = props.src;
    const { tabActiveKey } = useCustomContext();

    useKeyPress(keyMapping["closeTab"], (event) => {
        window.closeThisTab && window.closeThisTab(tabActiveKey);
        event.preventDefault(); return;
    });

    return (
        <div id="iframeContainer" style={{ minHeight: 480, height: '100%' }}>
            <iframe id="myIframe" src={src} title="iframe-example" width="100%" height="100%" frameBorder="0" />
        </div>
    );
};

export default IframeComponent;
