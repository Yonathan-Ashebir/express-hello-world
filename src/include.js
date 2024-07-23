const net = require('net')
const Socket = net.Socket;
const { StunRequest, decode, constants: stunConstants } = require("stun");
const { SEPARATE_CONNECTION_PORT, CONNECT_INTERVAL, CONNECT_TIMEOUT, CONNECT_RETRY_DELAY } = require('./constants')

const MY_LOG_VERBOSE = 5
const MY_LOG_DEBUG = 4
const MY_LOG_INFO = 3
const MY_LOG_WARN = 2
const MY_LOG_ERROR = 1
const MY_LOG_WTF = 0
function mLog(level, message, tag = "Y_Tech") {
    const now = new Date()
    let output = `${now.getFullYear()}-${now.getMonth()}-${now.getDay()} ${now.toLocaleTimeString('en-US', { hour12: false })} ${level === MY_LOG_WTF ? 'W' : level === MY_LOG_DEBUG ? 'D' : level === MY_LOG_INFO ? 'I' : level === MY_LOG_WARN ? 'W' : level === MY_LOG_ERROR ? 'E' : 'V'} | ${tag}: ${message}`

    if (process.env['LOG_TO_FILE'])
        fs.appendFileSync(process.env['LOG_TO_FILE'].toString(), output + '\n')
    else {
        if (level < MY_LOG_WARN) console.error(output)
        else if (level === MY_LOG_WARN) console.warn(output)
        else console.log(output)
    }
}

function testSTUNFull(callback, localPort = SEPARATE_CONNECTION_PORT) {
    const sock = new Socket()
    const sock2 = new Socket()
    let cummulate = []

    sock.on('error', (err) => {
        const msg = `Stun to 212.53.40.40 failed: ${err.message}`;
        mLog(MY_LOG_WARN, msg)
        callback(msg)
    })

    sock2.on('error', (err) => {
        const msg = `Stun to 49.12.125.53 failed: ${err.message}`;
        mLog(MY_LOG_WARN, msg)
        callback(msg)
    })

    sock.connect({ host: '212.53.40.40', port: 3478, localPort }, () => {
        const request = new StunRequest()
        request.setType(stunConstants.STUN_BINDING_REQUEST)

        sock.on('data', buf => {
            const res = decode(buf)
            cummulate.push(res.getXorAddress())
            if (cummulate.length == 2) callback(cummulate)
            sock.destroy()
        })
        sock.write(request.toBuffer())
    })

    sock2.connect({ host: '49.12.125.53', port: 3478, localPort }, () => {
        const request = new StunRequest()
        request.setType(stunConstants.STUN_BINDING_REQUEST)

        sock2.on('data', buf => {
            const res = decode(buf)
            cummulate.push(res.getXorAddress())
            if (cummulate.length == 2) callback(cummulate)
            sock2.destroy()
        })
        sock2.write(request.toBuffer())
    })
}

function getTCPPublicAddress(localPort, callback, closeImmediately = true) {
    const sock = new Socket()

    sock.connect({ host: '212.53.40.40', port: 3478, localPort }, () => {
        const request = new StunRequest()
        request.setType(stunConstants.STUN_BINDING_REQUEST)

        sock.on('data', buf => {
            const res = decode(buf)
            callback(res.getXorAddress())
            if (closeImmediately) sock.destroy()
        })
        sock.write(request.toBuffer())
    })
}

function sendToAddress(ip, port, msg, localPort = SEPARATE_CONNECTION_PORT) {
    mLog(MY_LOG_WARN, `Sending to address ${ip}:${port}, data: ${msg}`)
    const sock = new Socket()
    const startTime = new Date().getTime()
    sock.on('error', err => {
        if (new Date().getTime() - startTime < CONNECT_TIMEOUT) {
            mLog(MY_LOG_WARN, `Retrying connection to ${ip}:${port} due to err: ${err}`)
            setTimeout(() => sock.connect({ host: ip, port, localPort }), CONNECT_RETRY_DELAY)
        } else mLog(MY_LOG_WARN, `Sending to address ${ip}:${port} failed due to err: ${err}`)
    })
    // sock.setsockopt(net.SOL_SOCKET, net.SO_REUSEADDR, 1);
    // sock.setsockopt(net.SOL_SOCKET, net.SO_LINGER, { l_onoff: 1, l_linger: 10 });
    sock.on('connect', () => {
        sock.end(msg)
        mLog(MY_LOG_DEBUG, `Sending to address ${ip}:${port} succeeded`)
    })
    sock.connect({ host: ip, port, localPort })
    const retryInterval = setInterval(() => {
        if (sock.readyState === 'opening' && new Date().getTime() - startTime < CONNECT_TIMEOUT) {
            mLog(MY_LOG_WARN, `Retrying connection to ${ip}:${port} due to interval`)
            sock.destroy()
            setTimeout(() => sock.connect({ host: ip, port, localPort }), CONNECT_RETRY_DELAY)
        } else {
            sock.destroy()
            clearInterval(retryInterval)
            mLog(MY_LOG_WARN, `Cancelled interval of attempt to ${ip}:${port}`)
        }
    }, CONNECT_INTERVAL);
}

module.exports = {
    getTCPPublicAddress,
    getTCPPublicAddress,
    sendToAddress,
    testSTUNFull,
    MY_LOG_VERBOSE,
    MY_LOG_DEBUG,
    MY_LOG_INFO,
    MY_LOG_WARN,
    MY_LOG_ERROR,
    MY_LOG_WTF,
    mLog,
}

