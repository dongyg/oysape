import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

export const useKeyPress = (keys, callback, node = null) => {
  // implement the callback ref pattern
  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  const isKeyCombinationPressed = (event, keymap) => {
    const keys = keymap.toLowerCase().split('+');
    for (const key of keys) {
      if (key === 'ctrl' && !event.ctrlKey) {
        return false;
      }
      if (key === 'meta' && !event.metaKey) {
        return false;
      }
      if (key === 'shift' && !event.shiftKey) {
        return false;
      }
      if (key === 'alt' && !event.altKey) {
        return false;
      }
      if (key !== 'ctrl' && key !== 'meta' && key !== 'shift' && key !== 'alt' && key !== event.key.toLowerCase()) {
        return false;
      }
      if (event.shiftKey && keys.includes('meta') && !keys.includes('shift')) {
        return false;
      }
      if (event.shiftKey && keys.includes('ctrl') && !keys.includes('shift')) {
        return false;
      }
    }
    return true;
  }

  // handle what happens on key press
  const handleKeyPress = useCallback(
    (event) => {
      // check if one of the key is part of the ones we want
      if (keys.some((keymap) => isKeyCombinationPressed(event, keymap))) {
        callbackRef.current(event);
      }
    },
    [keys]
  );

  useEffect(() => {
    // target is either the provided node or the document
    const targetNode = node ?? document;
    // attach the event listener
    targetNode &&
      targetNode.addEventListener("keydown", handleKeyPress);

    // remove the event listener
    return () =>
      targetNode &&
        targetNode.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress, node]);
};

export const keyMapping = {
  "closeTab": ["ctrl+w", "meta+w"],
  "showAndRunCommand": ["ctrl+p", "meta+p"],
  "shortcutSave": ["ctrl+s", "meta+s"],
  "shortcutSaveAs": ["ctrl+shift+s", "meta+shift+s"],
  "showAndSelectServer": ["ctrl+shift+@", "ctrl+shift+2", "meta+shift+@", "meta+shift+2"],
  "showAndSelectTask": ["ctrl+shift+:", "ctrl+shift+;", "meta+shift+:", "meta+shift+;"],
  "showAndSelectPipeline": ["ctrl+shift+!", "ctrl+shift+1", "meta+shift+!", "meta+shift+1"],
  "execCommand": ["ctrl+enter", "meta+enter"],
  "terminalClear": ["ctrl+k", "meta+k"],
  "gotoTabWithNumber": ["ctrl+1", "meta+1", "ctrl+2", "meta+2", "ctrl+3", "meta+3", "ctrl+4", "meta+4", "ctrl+5", "meta+5", "ctrl+6", "meta+6", "ctrl+7", "meta+7", "ctrl+8", "meta+8", "ctrl+9", "meta+9", "ctrl+0", "meta+0"],
}
