import os, threading, _thread
import webview

from helpers import console, apis


def get_entrypoint():
    def exists(path):
        return os.path.exists(os.path.join(os.path.dirname(__file__), path))

    if exists('../gui/index.html'): # unfrozen development
        return '../gui/index.html'

    if exists('../Resources/gui/index.html'): # frozen py2app
        return '../Resources/gui/index.html'

    if exists('./gui/index.html'):
        return './gui/index.html'

    raise Exception('No index.html found')

is_debug = False
entry = 'http://localhost:3000' if is_debug else get_entrypoint()


if __name__ == '__main__':
    apiObj = apis.ApiWorkspace()
    window = webview.create_window('Oysape', entry, js_api=apiObj, width=1280, height=768)
    # _thread.start_new_thread(webview.start, (), {"debug": True}) # pywebview must be run on a main thread
    # console.embed()
    webview.start(debug=is_debug)
    print('Bye.')
