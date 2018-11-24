// vars
var gbolDebug = true;

var BGBnet = require('net');
var BGBPORT = 9013;

// sockList contains all the BGB Clients connected
var sockList = [];


// Date Related
//var dateTime = require('node-datetime');
//var dt = dateTime.create();
//dt.format('YYYY-MM-DD HH:mm:ss');

Date.prototype.Format = function (fmt) { //author: meizz 
    var o = {
        "M+": this.getMonth() + 1, //�·� 
        "d+": this.getDate(), //�� 
        "h+": this.getHours(), //Сʱ 
        "m+": this.getMinutes(), //�� 
        "s+": this.getSeconds(), //�� 
        "q+": Math.floor((this.getMonth() + 3) / 3), //���� 
        "S": this.getMilliseconds() //���� 
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (let k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
};


// Console Related
function funUpdateConsole(msg, bolDebugOnly) {
    let bolShouldShow = false;
    try {
        if (bolDebugOnly) {
            if (gbolDebug) {
                bolShouldShow = true;
            }
        } else {
            bolShouldShow = true;
        }
        if (bolShouldShow) {
            var strTempDate = new Date().Format("yyyy-MM-dd hh:mm:ss");
            console.log(strTempDate + " : " + msg);
        }
    } catch (err) {
        console.log(err.message);
    }
}



// Database Related

// The old method uses connection, which will cause error when the connection keeps too long and rejected by mysql server
//var con = mysql.createConnection({
//    host: "localhost",
//    user: "root",
//    password: "zephan915",
//    database: "thisapp"
//});

// The new method use connection pool, which connection(s) will be created automatically when needed
// var mysql = require('mysql');
// var pool = mysql.createPool({
//     connectionLimit: 10,
//     host: "localhost",
//     user: "root",
//     password: "zephan915",
//     database: "thisapp"
// });





// Socket.IO Server for Server Monitor to connect
var appServer = require('express')();
var httpServer = require('http').Server(appServer);
var ioServer = require('socket.io')(httpServer);

appServer.get('/', function (req, res) {
    res.sendFile(__dirname + '/server.html');
});

ioServer.on('connection', function (socket) {
    funUpdateConsole('BigaiBot WebServer Monitor Initialized', false);
    socket.on('disconnect', function () {
        funUpdateConsole('BigaiBot WebServer Monitor Disconnected', false);
    });
});

httpServer.listen(9001, function () {
    funUpdateConsole('BigaiBot WebServer Monitor listening on *:9001', false);
});

function funUpdateServerMonitor(strMsg, bolDebugOnly) {
    let bolShouldShow = false;
    try {
        if (bolDebugOnly) {
            if (gbolDebug) {
                bolShouldShow = true;
            }
        } else {
            bolShouldShow = true;
        }
        if (bolShouldShow) {
            let strTempDate = new Date().Format("yyyy-MM-dd hh:mm:ss");
            ioServer.emit('chat message', strTempDate + " : " + strMsg);
        }
    } catch (err) {
        //
    }
}






// Below Socket.IO Server Related
var socID = '';
var socket = require('socket.io-client')('http://thisapp.zephan.top:10511');

socket.on('connect', function(){
    funUpdateConsole('Server Connected, my ID: ' + socket.id, true);
    socID = socket.id;
});

socket.on('UpdateYourSocketID', function(data){
    funUpdateConsole('Server Received, my ID: ' + data, true);
});

socket.on('BGBServerToClient', function(data){
    funUpdateServerMonitor('Message From Server: ' + data, true);
    try {
        sockList[0].socketID.write(utf8Encode('MESSAGE:' + data));
    } catch(err) {
        //
    }
});

socket.on('disconnect', function(){
    funUpdateServerMonitor('Server Disconnected, my ID: ' + socket.id, true);
    socID = '';
});




// Below Bigaibot Related


var BGBServer = BGBnet.createServer(function (sock) {
    try {
        // If client connect, push client into List
        var dtTemp = Date.now();
        sock.name = sock.remoteAddress + ':' + sock.remotePort;
        sockList.push({ userID: "", socketID: sock, dtLastHB: dtTemp });

        // No need to setEncoding
        // sock.setEncoding('binary');

        // Set No Delay so that WRITE will be sent immediately
        sock.setNoDelay(true);

        // ���ǻ��һ������ - �������Զ�����һ��socket����
        funUpdateServerMonitor('BGB CONNECTED: ' +
            sock.remoteAddress + ':' + sock.remotePort, true);

        // Ϊ���socketʵ�����һ��"data"�¼�������
        sock.on('data', function (data) {
            // funUpdateServerMonitor("EV3 Data Received: " + data, true);

            funBGBGotDataFromClient(sock, data);
        });

        // Ϊ���socketʵ�����һ��"close"�¼�������
        sock.on('close', function (data) {
            funUpdateServerMonitor('BGB DISCONNECTED: ' +
                sock.remoteAddress + ':' + sock.remotePort, true);
            funBGBRemoveUser(sock);
        });

        sock.on('error', function () {
            // Error
        });
    } catch (err) {
        funUpdateServerMonitor("BGB Create Server Error: " + err, true);
    }
}).listen(BGBPORT);

funUpdateConsole('BGB Socket Server Listening on: ' +
    BGBPORT, true);


function funBGBGotDataFromClient(sock, data) {
    try {
        let i = 0;
        let strTemp = data.toString('utf-8');
        if (strTemp === 'HBHBHBHB') {
            // At Least 8 bytes must be sent, for example, send only HB, EV3 will receive NOTHING
            // Also, must use utf8Encode, otherwise EV3 will also receive NOTHING
            // HeartBeat
            let dtTemp = Date.now();
            for (i = 0; i < sockList.length; i++) {
                if (sockList[i].socketID.name === sock.name) {
                    sockList[i].dtLastHB = dtTemp;
                }
            }
            let bolTemp = sock.write(utf8Encode('HBHBHBHB'));
        } else if (strTemp.indexOf('|||LOGIN') === 0) {
            // Login
            for (i = 0; i < sockList.length; i++) {
                if (sockList[i].socketID.name === sock.name) {
                    // Suppose UserID is what after the first 8 chars |||LOGIN
                    sockList[i].userID = strTemp.substring(8);
                    sockList[i].socketID.write(utf8Encode('|LOGINOK'));
                    funUpdateServerMonitor("BGB Client Login ID: " + strTemp.substring(8) + "   Address: " + sock.name, true);
                    socket.emit('BigaiBotLogin', sockList[i].userID);
                }
            }
        } else if (strTemp.indexOf('ANSWER::') === 0) {
            let strAnswer = strTemp.substring(8);
            funUpdateServerMonitor("BGB AIML Answer: " + strAnswer, true);
            socket.emit('BGBClientToServer', strAnswer);
        } else {
            //
        }
    } catch (err) {
        funUpdateServerMonitor("funBGBGotoDataFromClient Error: " + err, true);
    }
}


function funBGBRemoveUser(sock) {
    try {
        // Remove User
        for (let i = 0; i < sockList.length; i++) {
            if (sockList[i].socketID.name === sock.name) {
                try {
                    socket.emit('BigaiBotLogout', sockList[i].userID);
                    sockList.splice(i, 1);
                    funUpdateServerMonitor("BGB Client Removed: " + sock.name, true);
                    break;
                } catch (err)  {
                    //
                }
            }
        }
    } catch (err) {
        funUpdateServerMonitor("funBGBRemoveUser Error: " + err, true);
    }
}



function funBGBSendDataToClient(strUserID, strMsg) {
    try {
        funUpdateServerMonitor("Start Send Data to BGB ID: " + strUserID + " Message: " + strMsg, true);
        // Send Data To Client
        for (let i = 0; i < sockList.length; i++) {
            if (sockList[i].userID === strUserID) {
                sockList[i].socketID.write(utf8Encode(strMsg));
                funUpdateServerMonitor("Sent Data to BGB ID: " + strUserID + " Message: " + strMsg, true);
            }
        }
    } catch (err) {
        funUpdateServerMonitor("funBGBSendDataToClient Error: " + err, true);
    }
}








// Support Functions


// Encode String to UTF-8
function utf8Encode(string) {
    string = string.replace(/\r\n/g, "\n");
    let utftext = "";
    for (let n = 0; n < string.length; n++) {
        let c = string.charCodeAt(n);
        if (c < 128) {
            utftext += String.fromCharCode(c);
        } else if ((c > 127) && (c < 2048)) {
            utftext += String.fromCharCode((c >> 6) | 192);
            utftext += String.fromCharCode((c & 63) | 128);
        } else {
            utftext += String.fromCharCode((c >> 12) | 224);
            utftext += String.fromCharCode(((c >> 6) & 63) | 128);
            utftext += String.fromCharCode((c & 63) | 128);
        }

    }
    return utftext;
}
// Decode String From UTF-8
function utf8Decode(utftext) {
    let string = "";
    let i = 0;
    let c = c1 = c2 = 0;
    while (i < utftext.length) {
        c = utftext.charCodeAt(i);
        if (c < 128) {
            string += String.fromCharCode(c);
            i++;
        } else if ((c > 191) && (c < 224)) {
            c2 = utftext.charCodeAt(i + 1);
            string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
            i += 2;
        } else {
            c2 = utftext.charCodeAt(i + 1);
            c3 = utftext.charCodeAt(i + 2);
            string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
            i += 3;
        }
    }
    return string;
}

function json_decode(str_json) {
    let json = JSON;
    if (typeof json === 'object' && typeof json.parse === 'function') {
        return json.parse(str_json);
    }

    let cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    let j;
    let text = str_json;

    // Parsing happens in four stages. In the first stage, we replace certain  
    // Unicode characters with escape sequences. JavaScript handles many characters  
    // incorrectly, either silently deleting them, or treating them as line endings.  
    cx.lastIndex = 0;
    if (cx.test(text)) {
        text = text.replace(cx, function (a) {
            return '\\u' +
                ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        });
    }

    // In the second stage, we run the text against regular expressions that look  
    // for non-JSON patterns. We are especially concerned with '()' and 'new'  
    // because they can cause invocation, and '=' because it can cause mutation.  
    // But just to be safe, we want to reject all unexpected forms.  

    // We split the second stage into 4 regexp operations in order to work around  
    // crippling inefficiencies in IE's and Safari's regexp engines. First we  
    // replace the JSON backslash pairs with '@' (a non-JSON character). Second, we  
    // replace all simple value tokens with ']' characters. Third, we delete all  
    // open brackets that follow a colon or comma or that begin the text. Finally,  
    // we look to see that the remaining characters are only whitespace or ']' or  
    // ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.  
    if (/^[\],:{}\s]*$/.
        test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@').
            replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
            replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

        // In the third stage we use the eval function to compile the text into a  
        // JavaScript structure. The '{' operator is subject to a syntactic ambiguity  
        // in JavaScript: it can begin a block or an object literal. We wrap the text  
        // in parens to eliminate the ambiguity.  

        j = eval('(' + text + ')');

        return j;
    }

    // If the text is not JSON parseable, then a SyntaxError is thrown.  
    throw new SyntaxError('json_decode');
}

function json_encode(mixed_val) {
    let json = JSON;
    if (typeof json === 'object' && typeof json.stringify === 'function') {
        return json.stringify(mixed_val);
    }

    let value = mixed_val;

    let quote = function (string) {
        let escapable = /[\\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
        let meta = {    // table of character substitutions  
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"': '\\"',
            '\\': '\\\\'
        };

        escapable.lastIndex = 0;
        return escapable.test(string) ?
            '"' + string.replace(escapable, function (a) {
                var c = meta[a];
                return typeof c === 'string' ? c :
                    '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            }) + '"' :
            '"' + string + '"';
    };

    let str = function (key, holder) {
        let gap = '';
        let indent = '    ';
        let i = 0;          // The loop counter.  
        let k = '';          // The member key.  
        let v = '';          // The member value.  
        let length = 0;
        let mind = gap;
        let partial = [];
        let value = holder[key];

        // If the value has a toJSON method, call it to obtain a replacement value.  
        if (value && typeof value === 'object' &&
            typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }

        // What happens next depends on the value's type.  
        switch (typeof value) {
            case 'string':
                return quote(value);

            case 'number':
                // JSON numbers must be finite. Encode non-finite numbers as null.  
                return isFinite(value) ? String(value) : 'null';

            case 'boolean':
            case 'null':
                // If the value is a boolean or null, convert it to a string. Note:  
                // typeof null does not produce 'null'. The case is included here in  
                // the remote chance that this gets fixed someday.  

                return String(value);

            case 'object':
                // If the type is 'object', we might be dealing with an object or an array or  
                // null.  
                // Due to a specification blunder in ECMAScript, typeof null is 'object',  
                // so watch out for that case.  
                if (!value) {
                    return 'null';
                }

                // Make an array to hold the partial results of stringifying this object value.  
                gap += indent;
                partial = [];

                // Is the value an array?  
                if (Object.prototype.toString.apply(value) === '[object Array]') {
                    // The value is an array. Stringify every element. Use null as a placeholder  
                    // for non-JSON values.  

                    length = value.length;
                    for (i = 0; i < length; i += 1) {
                        partial[i] = str(i, value) || 'null';
                    }

                    // Join all of the elements together, separated with commas, and wrap them in  
                    // brackets.  
                    v = partial.length === 0 ? '[]' :
                        gap ? '[\n' + gap +
                            partial.join(',\n' + gap) + '\n' +
                            mind + ']' :
                            '[' + partial.join(',') + ']';
                    gap = mind;
                    return v;
                }

                // Iterate through all of the keys in the object.  
                for (k in value) {
                    if (Object.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }

                // Join all of the member texts together, separated with commas,  
                // and wrap them in braces.  
                v = partial.length === 0 ? '{}' :
                    gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' +
                        mind + '}' : '{' + partial.join(',') + '}';
                gap = mind;
                return v;
        }
    };

    // Make a fake root object containing our value under the key of ''.  
    // Return the result of stringifying the value.  
    return str('', {
        '': value
    });
}
