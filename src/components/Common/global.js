import CryptoJS from 'crypto-js';

export function listDataFromCookie() {
  var retval = [];
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=');
    retval.push({ name, value: rest.join('=') });
  }
  return '';
}
window.getDataFromCookie = getDataFromCookie;

export function getDataFromCookie(key) {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name === key) {
      return rest.join('=');
    }
  }
  return '';
}
window.getDataFromCookie = getDataFromCookie;

export function setDataToCookie(cookieArray) {
  let cookieString = '';
  (cookieArray || []).forEach(cookieData => {
    let { name, value, days } = cookieData;
    let cookieValue = `${name}=${value}; path=/;`;
    if (days !== undefined) {
      const now = new Date();
      now.setDate(now.getDate() + days);
      cookieValue += `expires=${now.toUTCString()};`;
    }
    cookieString += cookieValue + ' ';
  });
  document.cookie = cookieString.trim();
}
window.setDataToCookie = setDataToCookie;

export function delDataFromCookie(key) {
  document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}
window.delDataFromCookie = delDataFromCookie;

export function getDataFromLocalStorage(key) {
  return localStorage.getItem(key) || '';
}

export function setDataToLocalStorage(key, value) {
  localStorage.setItem(key, value);
}

export const calculateMD5 = function(str) {
  const hash = CryptoJS.MD5(str);
  return hash.toString();
}

export const OYSAPE_DESKTOP_NAME = 'OysapeDesktop';
export const OYSAPE_MOBILE_NAME = 'OysapeMobile';

export let isDesktopVersion = navigator.userAgent.indexOf(OYSAPE_DESKTOP_NAME) !== -1;
export let isMobileVersion = navigator.userAgent.indexOf(OYSAPE_MOBILE_NAME) !== -1;
export let isIos = navigator.userAgent.indexOf('iPhone') !== -1 || navigator.userAgent.indexOf('iPad') !== -1;
export let isMacOs = navigator.userAgent.indexOf('Macintosh') !== -1 || navigator.userAgent.indexOf('Mac OS') !== -1 || navigator.userAgent.indexOf('macOS') !== -1;

window.updateUserAgent = function() {
  isDesktopVersion = navigator.userAgent.indexOf(OYSAPE_DESKTOP_NAME) !== -1;
  isMobileVersion = navigator.userAgent.indexOf(OYSAPE_MOBILE_NAME) !== -1;
  isIos = navigator.userAgent.indexOf('iPhone') !== -1 || navigator.userAgent.indexOf('iPad') !== -1;
  isMacOs = navigator.userAgent.indexOf('Macintosh') !== -1 || navigator.userAgent.indexOf('Mac OS') !== -1 || navigator.userAgent.indexOf('macOS') !== -1;
  callApi('get_token').then((data) => {
    window.reloadUserSession && window.reloadUserSession();
  });
}

// 调用原生API
export function callNativeApi(functionName, params) {
  if(isMobileVersion) {
    const sendMessageToNative = (data) => {
      return new Promise((resolve, reject) => {
        // 创建一个唯一的回调函数名
        const callbackName = `callback_${Date.now()}`;
        // 在 window 对象上创建回调函数
        window[callbackName] = function(response) {
            resolve(response);
            // 删除回调函数以释放内存
            delete window[callbackName];
        };
        // 发送消息到原生代码，并传递回调函数名
        if(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.jsHandler && window.webkit.messageHandlers.jsHandler.postMessage){
          window.webkit.messageHandlers.jsHandler.postMessage({ ...data, callback: callbackName });
        } else if (window.Android && window.Android.postMessage) {
          window.Android.postMessage(JSON.stringify({ ...data, callback: callbackName }));
        }
      });
    }
    return sendMessageToNative({ functionName, params });
  } else {
    return Promise.reject('Please use Oysape Mobile app.');
  }
}

// 处理原生代码返回的结果
window.handleNativeResponse = function (response) {
  // 解析 JSON 字符串
  const responseObject = response;
  // 找到并调用对应的回调函数
  const callbackName = responseObject.callback;
  if (window[callbackName]) {
      window[callbackName](responseObject.backData);
  }
}

export const getCredentials = function() {
  try {
    let credentialListing = JSON.parse(getDataFromLocalStorage('credential_listing') || '[]');
    credentialListing = credentialListing.map(cred => {
      if (cred.password) {
        try {
          cred.password = CryptoJS.AES.decrypt(cred.password, OYSAPE_DESKTOP_NAME).toString(CryptoJS.enc.Utf8);
        } catch (e) {
          console.error('Error decrypting password:', e);
        }
      }
      if (cred.passphrase) {
        try {
          cred.passphrase = CryptoJS.AES.decrypt(cred.passphrase, OYSAPE_DESKTOP_NAME).toString(CryptoJS.enc.Utf8);
        } catch (e) {
          console.error('Error decrypting passphrase:', e);
        }
      }
      return cred;
    });
    const credentialMapping = JSON.parse(getDataFromLocalStorage('credential_mapping') || '{}');
    // return { credentialListing, credentialMapping, };
    return { credentialListing, credentialMapping, deviceType: window.cooData&&window.cooData.deviceType, deviceToken: window.cooData&&window.cooData.deviceToken };
  } catch (e) {
    console.error('Error parsing credentials:', e);
    // return { credentialListing: [], credentialMapping: {}, };
    return { credentialListing: [], credentialMapping: {}, deviceType: window.cooData&&window.cooData.deviceType, deviceToken: window.cooData&&window.cooData.deviceToken };
  }
}
window.getCredentials = getCredentials;

export const saveCredentialListing = (newCredentials) => {
  try {
    const credentialListing = newCredentials.map(cred => {
      const encryptedCred = { ...cred };
      if (encryptedCred.password) {
        try {
          encryptedCred.password = CryptoJS.AES.encrypt(encryptedCred.password, OYSAPE_DESKTOP_NAME).toString();
        } catch (e) {
          console.error('Error encrypting password:', e);
        }
      }
      if (encryptedCred.passphrase) {
        try {
          encryptedCred.passphrase = CryptoJS.AES.encrypt(encryptedCred.passphrase, OYSAPE_DESKTOP_NAME).toString();
        } catch (e) {
          console.error('Error encrypting passphrase:', e);
        }
      }
      return encryptedCred;
    });
    setDataToLocalStorage('credential_listing', JSON.stringify(credentialListing));
  } catch (e) {
    console.error('Error saving credential listing:', e);
  }
}

export const saveCredentialMapping = (tkey, skey, alias) => {
  try {
    let credentialMapping = getCredentials().credentialMapping;
    if (!credentialMapping[tkey]) credentialMapping[tkey] = {};
    if(alias) {
      credentialMapping[tkey][skey] = alias;
    } else {
      delete credentialMapping[tkey][skey];
    }
    setDataToLocalStorage('credential_mapping', JSON.stringify(credentialMapping));
  } catch (e) {
    console.error('Error saving credential mapping:', e);
  }
};

export const callApi = (functionName, params) => {
  if(window.pywebview && window.pywebview.api) {
    console.log('callApi - pywebview: ' + functionName);
    if(window.pywebview.api[functionName]) {
      if(params){
        return window.pywebview.api.callApi(functionName, params);
      } else {
        return window.pywebview.api.callApi(functionName);
      }
    } else {
      return new Promise((resolve, reject) => {
          reject(new Error('Api not found: ' + functionName));
      });
    }
  } else {
    console.log('callApi - http: ' + functionName);
    const headers = {
      'Content-Type': 'application/json',
    };
    var options = {
      method: 'POST',
      headers: headers,
      credentials: 'include',
    }
    if(params) {
      options.body = JSON.stringify(params);
    }
    return fetch((window.OYSAPE_BACKEND_HOST||'')+'/api/' + functionName, options).then(response => {
      return response.json()
    }).catch(error => {
      console.error('API call failed:', error);
      // throw error;
    });
  }
};

export function setTokenToCookie(token) {
  // The token will be set through this function only in the desktop version
  setDataToCookie([{name:'client_token', value:token, days:30}]);
}

export function delTokenFromCookie() {
  delDataFromCookie('client_token');
}

export async function fetchData(url = '', data = {}) {
  const queryParams = new URLSearchParams(data).toString();
  const absUrl = url.startsWith('http') ? url : ((window.OYSAPE_BACKEND_HOST||'') + url) + (queryParams ? `?${queryParams}` : '');
  const options = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
  };
  try {
    const response = await fetch(absUrl, options);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error('Error fetching data:', absUrl, error);
    throw error;
  }
}

export async function requestDelete(url = '', data = {}) {
  const queryParams = new URLSearchParams(data).toString();
  const absUrl = url.startsWith('http') ? url : ((window.OYSAPE_BACKEND_HOST||'') + url) + (queryParams ? `?${queryParams}` : '');
  const options = {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
  };
  try {
    const response = await fetch(absUrl, options);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error('Error fetching data:', absUrl, error);
    throw error;
  }
}

export async function postData(url = '', data = {}) {
  const absUrl = url.startsWith('http') ? url : ((window.OYSAPE_BACKEND_HOST||'') + url);
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  };
  try {
    const response = await fetch(absUrl, options);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error('Error posting data:', absUrl, error);
    throw error;
  }
}

export const getInitials = (str) => {
    const words = str.match(/[A-Za-z]+/g);
    if (!words) {
        return '';
    }
    return words.map(word => word[0]).join('');
}

export const getShowTitle = (str) => {
    return str + ' ('+getInitials(str)+')';
}

export const getPathAndName = (item) => {
    return (item.path||'')+(item.path?'/':'')+item.name;
}

export const flatFileTree = (tree, path) => {
    return (tree||[]).reduce((acc, item) => {
        item.path = path || '';
        item.name = item.title;
        item.key = calculateMD5(item.key + item.path + item.title);
        if(item.isLeaf) {
            acc.push(item);
        }
        if (item.children) {
            acc = acc.concat(flatFileTree(item.children, (item.path||'')+(item.path?'/':'')+item.name));
        }
        return acc;
    }, []);
}

export const parseTaskString0 = function(str) {
    const v1 = str.indexOf(':');
    const v2 = str.indexOf('@');
    if(v1 >= 0 && v2 >= 0) {
        return v1 < v2 ? parseTaskString1(str) : parseTaskString2(str);
    } else if (v2 >= 0) {
        return {task: '', server: str.replace('@', '').trim()};
    } else {
        return {task: '', server: ''};
    }
}

export const parseTaskString1 = function(str) {
    const regex = /:(.*?)@(.*)/;
    const matches = str.match(regex);
    if (!matches) {
      return { task: '', server: '' };
    }
    const task = matches[1].trim();
    const server = matches[2].trim();
    return { task, server };
}

export const parseTaskString2 = function(str) {
    const regex = /@(.*?):(.*)/;
    const matches = str.match(regex);
    if (!matches) {
      return { task: '', server: '' };
    }
    const task = matches[2].trim();
    const server = matches[1].trim();
    return { task, server };
}

export const generateUUID = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0,
      v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

export const decimalToBase62 = function(decimal) {
  var base62Chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var base62 = '';
  while (decimal > 0) {
    base62 = base62Chars.charAt(decimal % 62) + base62;
    decimal = Math.floor(decimal / 62);
  }
  return base62;
}

export const getUniqueKey = function(uuid) {
    uuid = uuid || generateUUID();
    const base62 = decimalToBase62(parseInt(calculateMD5(uuid), 16));
    return base62;
}

export const colorizeText = function(text, fore, back) {
    const backgrounds = {
        'gray': '\x1b[40m%s\x1b[0m',  // background
        'red': '\x1b[41m%s\x1b[0m',  // background
        'green': '\x1b[42m%s\x1b[0m',  // background
        'yellow': '\x1b[43m%s\x1b[0m',  // background
        'blue': '\x1b[44m%s\x1b[0m',  // background
        'purple': '\x1b[45m%s\x1b[0m',  // background
        'cyan': '\x1b[46m%s\x1b[0m',  // background
        'white': '\x1b[47m%s\x1b[0m',  // background
    }
    const foregrounds = {
        'red': '\x1b[31m%s\x1b[0m',  // text
        'green': '\x1b[32m%s\x1b[0m',  // text
        'yellow': '\x1b[33m%s\x1b[0m',  // text
        'blue': '\x1b[34m%s\x1b[0m',  // text
        'purple': '\x1b[35m%s\x1b[0m',  // text
        'cyan': '\x1b[36m%s\x1b[0m',  // text
        'white': '\x1b[37m%s\x1b[0m',  // text
    }
    if (fore && fore in foregrounds) {
        text = foregrounds[fore].replace('%s',text);
    }
    if (back && back in backgrounds) {
        text = backgrounds[back].replace('%s',text);
    }
    return text;
}

export const writeWelcome = function(xterm) {
    // let cols = xterm._core._bufferService.cols;
    // let rows = xterm._core._bufferService.rows;
    let ctrlOrMeta = xterm._core.browser.isMac ? 'Command' : 'Ctrl';
    // let text = 'Hello!';
    // xterm.write('\x1b[40m'+text+'\x1b[0m '); // gray background
    // xterm.write('\x1b[41m'+text+'\x1b[0m '); // red background
    // xterm.write('\x1b[42m'+text+'\x1b[0m '); // green background
    // xterm.write('\x1b[43m'+text+'\x1b[0m '); // yellow background
    // xterm.write('\x1b[44m'+text+'\x1b[0m '); // blue background
    // xterm.write('\x1b[45m'+text+'\x1b[0m '); // purple background
    // xterm.write('\x1b[46m'+text+'\x1b[0m '); // cyan background
    // xterm.write('\x1b[47m'+text+'\x1b[0m \r\n'); // white background
    // xterm.write(''+text+' ');
    // xterm.write('\x1b[31m'+text+'\x1b[0m '); // red text
    // xterm.write('\x1b[32m'+text+'\x1b[0m '); // green text
    // xterm.write('\x1b[33m'+text+'\x1b[0m '); // yellow text
    // xterm.write('\x1b[34m'+text+'\x1b[0m '); // blue text
    // xterm.write('\x1b[35m'+text+'\x1b[0m '); // purple text
    // xterm.write('\x1b[36m'+text+'\x1b[0m '); // cyan text
    // xterm.write('\x1b[37m'+text+'\x1b[0m \r\n'); // white text
    xterm.write(colorizeText('Welcome! \r\n\r\n', 'green'));
    if(!isMobileVersion){
      xterm.write(colorizeText(ctrlOrMeta+'+K','cyan') + ' - Clear the workspace/terminal\r\n\r\n');
      xterm.write(colorizeText(ctrlOrMeta+'+P','cyan') + ' - Search for Teams/Servers/Tasks/Pipelines/Files\r\n\r\n');
      xterm.write(colorizeText(ctrlOrMeta+'+Shift+@','cyan') + ' - Search for Servers\r\n\r\n');
      xterm.write(colorizeText(ctrlOrMeta+'+Shift+:','cyan') + ' - Search for Tasks\r\n\r\n');
      xterm.write(colorizeText(ctrlOrMeta+'+Shift+!','cyan') + ' - Search for Pipelines\r\n\r\n');
      xterm.write(colorizeText(ctrlOrMeta+'+Enter','cyan') + ' - Run the selected Task/Pipeline, or open a Terminal for the selected Server, or open the selected File\r\n\r\n');
      xterm.write(colorizeText(ctrlOrMeta+'+[1,2-0]','cyan') + ' - Activate the specified tab\r\n');
    }
}

const languageDictMonaco = {
  "abap": [".abap"],
  "apex": [".apex"],
  "azcli": [".azcli"],
  "bat": [".bat", ".cmd"],
  "c": [".c", ".h"],
  "clojure": [".clj", ".cljs", ".cljc", ".edn"],
  "coffeescript": [".coffee"],
  "cpp": [".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx"],
  "csharp": [".cs", ".csx"],
  "csp": [".csp"],
  "css": [".css"],
  "dart": [".dart"],
  "dockerfile": ["Dockerfile"],
  "fsharp": [".fs", ".fsi", ".ml", ".mli"],
  "go": [".go"],
  "graphql": [".graphql", ".gql"],
  "handlebars": [".handlebars", ".hbs"],
  "html": [".html", ".htm", ".shtml", ".xhtml"],
  "ini": [".ini"],
  "java": [".java"],
  "javascript": [".js", ".mjs"],
  "julia": [".jl"],
  "kotlin": [".kt", ".kts"],
  "less": [".less"],
  "lua": [".lua"],
  "markdown": [".md", ".markdown"],
  "msdax": [".msdax"],
  "mysql": [".sql"],
  "objective-c": [".m", ".mm"],
  "pascal": [".pas", ".p"],
  "perl": [".pl", ".pm"],
  "pgsql": [".pgsql"],
  "php": [".php"],
  "plaintext": [".txt"],
  "postiats": [".dats", ".sats", ".hats"],
  "powerquery": [".pq", ".pqm"],
  "powershell": [".ps1", ".psm1"],
  "pug": [".pug"],
  "python": [".py", ".rpy", ".pyw", ".cpy", ".gyp", ".gypi"],
  "r": [".r"],
  "razor": [".cshtml"],
  "redis": [".redis"],
  "redshift": [".rsql"],
  "ruby": [".rb", ".rbw"],
  "rust": [".rs"],
  "sb": [".sb"],
  "scheme": [".scm", ".ss"],
  "scss": [".scss"],
  "shell": [".sh", ".bash"],
  "solidity": [".sol"],
  "sql": [".sql"],
  "st": [".st"],
  "swift": [".swift"],
  "tcl": [".tcl"],
  "twig": [".twig"],
  "typescript": [".ts", ".tsx"],
  "vb": [".vb"],
  "xml": [".xml", ".dtd", ".ascx", ".csproj", ".config", ".props", ".targets", ".wxi", ".wxl", ".wxs", ".xaml", ".svg"],
  "yaml": [".yaml", ".yml"]
}

const languageDictCodeMirror = {
  "angular": [".js"],
  "apl": [".apl"],
  "asciiArmor": [".asc"],
  "asterisk": [".asterisk"],
  "brainfuck": [".bf"],
  "c": [".c"],
  "ceylon": [".ceylon"],
  "clojure": [".clj"],
  "cmake": [".cmake"],
  "cobol": [".cob"],
  "coffeescript": [".coffee"],
  "commonLisp": [".lisp"],
  "cpp": [".cpp"],
  "crystal": [".cr"],
  "csharp": [".cs"],
  "cypher": [".cypher"],
  "d": [".d"],
  "dart": [".dart"],
  "diff": [".diff"],
  "dockerfile": ["Dockerfile"],
  "dtd": [".dtd"],
  "dylan": [".dylan"],
  "ebnf": [".ebnf"],
  "ecl": [".ecl"],
  "eiffel": [".e"],
  "elm": [".elm"],
  "erlang": [".erl"],
  "factor": [".factor"],
  "fcl": [".fcl"],
  "forth": [".forth"],
  "fortran": [".f"],
  "gas": [".s"],
  "gherkin": [".feature"],
  "go": [".go"],
  "groovy": [".groovy"],
  "haskell": [".hs"],
  "haxe": [".hx"],
  "html": [".html"],
  "http": [".http"],
  "idl": [".idl"],
  "javascript": [".js"],
  "jinja2": [".jinja2"],
  "json": [".json"],
  "jsx": [".jsx"],
  "java": [".java"],
  "julia": [".jl"],
  "kotlin": [".kt"],
  "lezer": [".lezer"],
  "less": [".less"],
  "lua": [".lua"],
  "markdown": [".md", ".markdown"],
  "mathematica": [".nb"],
  "mbox": [".mbox"],
  "mermaid": [".mermaid"],
  "mirc": [".mrc"],
  "modelica": [".mo"],
  "mscgen": [".mscgen"],
  "mumps": [".mumps"],
  "mysql": [".sql"],
  "nesC": [".nc"],
  "nginx": [".conf"],
  "nix": [".nix"],
  "nsis": [".nsi"],
  "ntriples": [".nt"],
  "objectiveC": [".m", ".mm"],
  "octave": [".octave"],
  "oz": [".oz"],
  "pascal": [".pas"],
  "perl": [".pl"],
  "php": [".php"],
  "pig": [".pig"],
  "plaintext": [".txt"],
  "powershell": [".ps1"],
  "protobuf": [".proto"],
  "properties": [".properties"],
  "puppet": [".pp"],
  "python": [".py"],
  "q": [".q"],
  "r": [".r"],
  "ruby": [".rb"],
  "rust": [".rs"],
  "sas": [".sas"],
  "sass": [".sass"],
  "scala": [".scala"],
  "scheme": [".scm"],
  "shader": [".shader"],
  "shell": [".sh"],
  "sieve": [".sieve"],
  "smalltalk": [".st"],
  "solidity": [".sol"],
  "solr": [".solr"],
  "sparql": [".rq"],
  "spreadsheet": [".xls"],
  "squirrel": [".nut"],
  "stex": [".stex"],
  "stylus": [".styl"],
  "svelte": [".svelte"],
  "swift": [".swift"],
  "tcl": [".tcl"],
  "textile": [".textile"],
  "tiddlyWiki": [".tid"],
  "tiki": [".tiki"],
  "toml": [".toml"],
  "troff": [".tr"],
  "ttcn": [".ttcn"],
  "turtle": [".ttl"],
  "typescript": [".ts"],
  "tsx": [".tsx"],
  "vb": [".vb"],
  "vbscript": [".vbs"],
  "velocity": [".vm"],
  "verilog": [".v"],
  "vhdl": [".vhd"],
  "vue": [".vue"],
  "webIDL": [".webidl"],
  "wast": [".wast"],
  "xQuery": [".xq"],
  "xml": [".xml"],
  "yaml": [".yaml", ".yml"],
  "yacas": [".ys"],
  "z80": [".z80"]
};


export const getLanguageDictCodeMirror = languageDictCodeMirror;
export const getLanguageDictMonaco = languageDictMonaco;

export const getCodeMirrorLanguages = function(fileName) {
  if(fileName) {
    const basename = fileName.split(/[\\/]/).pop();
    const fileExtension = fileName.includes('.') ? '.'+fileName.split('.').pop().toLowerCase() : '';
    const possibleLanguages = Object.keys(languageDictCodeMirror).filter(lang => {
      if (fileExtension && languageDictCodeMirror[lang].includes(fileExtension)) {
        return true;
      }
      if (!fileExtension && languageDictCodeMirror[lang].includes(basename)) {
        return true;
      }
      return false;
    });
    return possibleLanguages;
  } else {
    return Object.keys(languageDictCodeMirror);
  }
}

export const getMonacoLanguages = function(fileName) {
  if(fileName) {
    const basename = fileName.split(/[\\/]/).pop();
    const fileExtension = fileName.includes('.') ? '.'+fileName.split('.').pop().toLowerCase() : '';
    const possibleLanguages = Object.keys(languageDictMonaco).filter(lang => {
      if (fileExtension && languageDictMonaco[lang].includes(fileExtension)) {
        return true;
      }
      if (!fileExtension && languageDictMonaco[lang].includes(basename)) {
        return true;
      }
      return false;
    });
    return possibleLanguages;
  } else {
    return Object.keys(languageDictMonaco);
  }
}

export const decolorizeText = function(text) {
  // const ansiEscape = /[\u001b\u009b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*[0-9A-ORZcf-nqry=><]?|[^\x1b\x9b]*[\x1b\x9b]?[0-9A-ORZcf-nqry=><])/g;
  // const ansiEscape = /[\u001b\u009b][[\]()#;?]*(?:\d{1,4}(?:;\d{0,4})*\d?[A-ORZcf-nqry=><]?|[^\u001b\u009b]*[\u001b\u009b]?\d[A-ORZcf-nqry=><])/g;
  const ansiEscapeStr = '[\\u001b\\u009b][[\\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*[0-9A-ORZcf-nqry=><]?|[^\\u001b\\u009b]*[\\u001b\\u009b]?[0-9A-ORZcf-nqry=><])';
  const ansiEscape = new RegExp(ansiEscapeStr, 'g');
  return (text || '').replace(ansiEscape, '');
}
