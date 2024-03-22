import CryptoJS from 'crypto-js';

export const calculateMD5 = function(str) {
    const hash = CryptoJS.MD5(str);
    return hash.toString();
  }

export const callApi = (functionName, params) => {
    // console.log('callApi:', functionName, params);
    if(window.pywebview && window.pywebview.api) {
        if(window.pywebview.api[functionName]) {
            if(params){
                return window.pywebview.api[functionName](params);
            } else {
                return window.pywebview.api[functionName]();
            }
        } else {
            return new Promise((resolve, reject) => {
                reject(new Error('Api not found: ' + functionName));
            });
        }
    } else {
        return new Promise((resolve, reject) => {
            resolve(null);
        });
    }
};

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
      v = c === 'x' ? r : (r & 0x3 | 0x8);
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
    xterm.write(colorizeText('Welcome!\r\n\r\n', 'green'));
    xterm.write(colorizeText(ctrlOrMeta+'+K','cyan') + ' - Clear the workspace/terminal\r\n\r\n');
    xterm.write(colorizeText(ctrlOrMeta+'+P','cyan') + ' - Search for Servers/Tasks/Pipelines/Files\r\n\r\n');
    xterm.write(colorizeText(ctrlOrMeta+'+Shift+@','cyan') + ' - Search for Servers\r\n\r\n');
    xterm.write(colorizeText(ctrlOrMeta+'+Shift+:','cyan') + ' - Search for Tasks\r\n\r\n');
    xterm.write(colorizeText(ctrlOrMeta+'+Shift+!','cyan') + ' - Search for Pipelines\r\n\r\n');
    xterm.write(colorizeText(ctrlOrMeta+'+Enter','cyan') + ' - Run the selected Task/Pipeline, or open a Terminal for the selected Server, or open the selected File\r\n\r\n');
    xterm.write(colorizeText(ctrlOrMeta+'+[1,2-0]','cyan') + ' - Activate the specified tab\r\n');
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
