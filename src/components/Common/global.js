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

export const isDesktopVersion = navigator.userAgent.indexOf(OYSAPE_DESKTOP_NAME) !== -1;
export const isMobileVersion = navigator.userAgent.indexOf(OYSAPE_MOBILE_NAME) !== -1;
export const isIos = navigator.userAgent.indexOf('iPhone') !== -1 || navigator.userAgent.indexOf('iPad') !== -1;

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
    credentialMapping[tkey][skey] = alias;
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

export const getUniqueKey = function() {
    const uuid = generateUUID();
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
      xterm.write(colorizeText(ctrlOrMeta+'+P','cyan') + ' - Search for Servers/Tasks/Pipelines/Files\r\n\r\n');
      xterm.write(colorizeText(ctrlOrMeta+'+Shift+@','cyan') + ' - Search for Servers\r\n\r\n');
      xterm.write(colorizeText(ctrlOrMeta+'+Shift+:','cyan') + ' - Search for Tasks\r\n\r\n');
      xterm.write(colorizeText(ctrlOrMeta+'+Shift+!','cyan') + ' - Search for Pipelines\r\n\r\n');
      xterm.write(colorizeText(ctrlOrMeta+'+Enter','cyan') + ' - Run the selected Task/Pipeline, or open a Terminal for the selected Server, or open the selected File\r\n\r\n');
      xterm.write(colorizeText(ctrlOrMeta+'+[1,2-0]','cyan') + ' - Activate the specified tab\r\n');
    }
}

const languageDict = {
    "apl": [".apl"],
    "asciiArmor": [".asciiArmor"],
    "asterisk": [".asterisk"],
    "c": [".c"],
    "csharp": [".cs"],
    "scala": [".scala"],
    "solidity": [".sol"],
    "kotlin": [".kt"],
    "shader": [".shader"],
    "nesC": [".nc"],
    "objectiveC": [".m"],
    "objectiveCpp": [".mm"],
    "squirrel": [".nut"],
    "ceylon": [".ceylon"],
    "dart": [".dart"],
    "cmake": [".cmake"],
    "cobol": [".cob"],
    "commonLisp": [".lisp"],
    "crystal": [".cr"],
    "cypher": [".cypher"],
    "d": [".d"],
    "diff": [".diff"],
    "dtd": [".dtd"],
    "dylan": [".dylan"],
    "ebnf": [".ebnf"],
    "ecl": [".ecl"],
    "eiffel": [".e"],
    "elm": [".elm"],
    "factor": [".factor"],
    "fcl": [".fcl"],
    "forth": [".forth"],
    "fortran": [".f"],
    "gas": [".s"],
    "gherkin": [".feature"],
    "groovy": [".groovy"],
    "haskell": [".hs"],
    "haxe": [".hx"],
    "http": [".http"],
    "idl": [".idl"],
    "jinja2": [".jinja2"],
    "mathematica": [".nb"],
    "mbox": [".mbox"],
    "mirc": [".mrc"],
    "modelica": [".mo"],
    "mscgen": [".mscgen"],
    "mumps": [".m"],
    "nsis": [".nsi"],
    "ntriples": [".nt"],
    "octave": [".m"],
    "oz": [".oz"],
    "pig": [".pig"],
    "properties": [".properties"],
    "protobuf": [".proto"],
    "puppet": [".pp"],
    "q": [".q"],
    "sas": [".sas"],
    "sass": [".sass"],
    "mermaid": [".mermaid"],
    "nix": [".nix"],
    "svelte": [".svelte"],
    "sieve": [".sieve"],
    "smalltalk": [".st"],
    "solr": [".solr"],
    "sparql": [".rq"],
    "spreadsheet": [".xls"],
    "stex": [".stex"],
    "textile": [".textile"],
    "tiddlyWiki": [".tid"],
    "tiki": [".tiki"],
    "troff": [".tr"],
    "ttcn": [".ttcn"],
    "turtle": [".ttl"],
    "velocity": [".vm"],
    "verilog": [".v"],
    "vhdl": [".vhd"],
    "webIDL": [".webidl"],
    "xQuery": [".xq"],
    "yacas": [".ys"],
    "z80": [".z80"],
    "wast": [".wast"],
    "javascript": [".js"],
    "jsx": [".jsx"],
    "typescript": [".ts"],
    "tsx": [".tsx"],
    "vue": [".vue"],
    "angular": [".js"],
    "json": [".json"],
    "html": [".html"],
    "css": [".css"],
    "python": [".py"],
    "markdown": [".md", ".markdown"],
    "xml": [".xml"],
    "sql": [".sql"],
    "mysql": [".sql"],
    "pgsql": [".sql"],
    "java": [".java"],
    "rust": [".rs"],
    "cpp": [".cpp"],
    "lezer": [".lezer"],
    "php": [".php"],
    "go": [".go"],
    "shell": [".sh"],
    "lua": [".lua"],
    "swift": [".swift"],
    "tcl": [".tcl"],
    "yaml": [".yaml"],
    "vb": [".vb"],
    "powershell": [".ps1"],
    "brainfuck": [".bf"],
    "stylus": [".styl"],
    "erlang": [".erl"],
    "nginx": [".conf"],
    "perl": [".pl"],
    "ruby": [".rb"],
    "pascal": [".pas"],
    "livescript": [".ls"],
    "less": [".less"],
    "scheme": [".scm"],
    "toml": [".toml"],
    "vbscript": [".vbs"],
    "clojure": [".clj"],
    "coffeescript": [".coffee"],
    "julia": [".jl"],
    "dockerfile": ["Dockerfile"],
    "r": [".r"],
};

export const getLanguageDict = languageDict;

export const getLanguages = function(fileName) {
    if(fileName) {
        const basename = fileName.split(/[\\/]/).pop();
        const fileExtension = fileName.includes('.') ? '.'+fileName.split('.').pop().toLowerCase() : '';
        const possibleLanguages = Object.keys(languageDict).filter(lang => {
            if (fileExtension && languageDict[lang].includes(fileExtension)) {
                return true;
            }
            if (!fileExtension && languageDict[lang].includes(basename)) {
                return true;
            }
            return false;
        });
        return possibleLanguages;
    } else {
        return Object.keys(languageDict);
    }
}

export const decolorizeText = function(text) {
  // const ansiEscape = /[\u001b\u009b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*[0-9A-ORZcf-nqry=><]?|[^\x1b\x9b]*[\x1b\x9b]?[0-9A-ORZcf-nqry=><])/g;
  // const ansiEscape = /[\u001b\u009b][[\]()#;?]*(?:\d{1,4}(?:;\d{0,4})*\d?[A-ORZcf-nqry=><]?|[^\u001b\u009b]*[\u001b\u009b]?\d[A-ORZcf-nqry=><])/g;
  const ansiEscapeStr = '[\\u001b\\u009b][[\\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*[0-9A-ORZcf-nqry=><]?|[^\\u001b\\u009b]*[\\u001b\\u009b]?[0-9A-ORZcf-nqry=><])';
  const ansiEscape = new RegExp(ansiEscapeStr, 'g');
  return (text || '').replace(ansiEscape, '');
}
