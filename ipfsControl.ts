import * as IPFSFactory from 'ipfsd-ctl';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { createReadStream, createWriteStream } from 'fs';
import { createCipheriv, createDecipheriv } from 'crypto';
import * as assert from 'assert';

let ipfsd = null;
let ipfsApi = null;

let initPromise = null;

function getBasePathToSharu(): string {
    return path.resolve(app.getPath('userData'));
}

export async function init(forcedPath?: string) {
    if (initPromise !== null) {
        return initPromise;
    } else {
        initPromise = new Promise(async (resolve, reject) => {
            const sharuPath = ((forcedPath) ? forcedPath : getBasePathToSharu()) + path.sep + 'ipfs';
            const promUnlink = promisify(fs.unlink);
            let ipfsAlreadyInited = false;

            const flags = [];
            console.log('path to sharu: ' + sharuPath);
            if (fs.existsSync(sharuPath)) {
                ipfsAlreadyInited = true;
            }
            console.log('ipfs is already inited (because path exists): ' + ipfsAlreadyInited);

            if (ipfsAlreadyInited) {
                try {
                    await promUnlink(path.resolve(sharuPath, 'api'));
                } catch (e) {
                    console.log('no api file found in sharu-folder, no problemo');
                }

                try {
                    await promUnlink(path.resolve(sharuPath, 'repo.lock'));
                } catch (e) {
                    console.log('no repo.lock file found in sharu-folder, no problemo');
                }
            }


            const ipfsFactory = IPFSFactory.create({
                type: 'jsdep'
            });

            const options = {
                repoPath: sharuPath,
                init: false,
                start: false,
                disposable: false,
                defaultAddrs: true,
                config: generateIpfsConfig(forcedPath)
            };

            ipfsFactory.spawn(options, async (err, _ipfsd) => {
                if (err) {
                    return reject(err);
                }
                ipfsd = _ipfsd;
                const promIpfsdInit = promisify(ipfsd.init);
                const promIpfsdStart = promisify(ipfsd.start);
                const promIpfsdGetConfig = promisify(ipfsd.getConfig);
                const promIpfsdSetConfig = promisify(ipfsd.setConfig);

                assert.ok(ipfsd, 'deamon did not spawn');
                console.log('ipfs is inited (says ipfsd): ' + ipfsd.initialized);
                if (!ipfsAlreadyInited) {
                    console.log('since ipfs is not inited yet, we do this now');
                    try {
                        ipfsd = await (() => {
                            return new Promise((res, rej) => {
                                ipfsd.init((error, _i) => {
                                    if (error) {
                                        console.log('init error');
                                        console.log(error);
                                        rej(error);
                                    }
                                    console.log('inited');
                                    res(_i);
                                });
                            });
                        })();
                    } catch (initError) {
                        console.log('whoopsi? err!');
                        console.log(initError);
                        reject(initError);
                        return;
                    }
                    console.log('init seems to be done okayishly');
                }

                assert.ok(ipfsd.initialized);
                console.log('lets start this thing');
                let api = null;
                try {
                    api = await (() => {
                        return new Promise((res, rej) => {
                            ipfsd.start(flags, (error, _a) => {
                                if (error) {
                                    console.log(error);
                                    rej(error);
                                }
                                console.log('started');
                                res(_a);
                            });
                        });
                    })();
                } catch (startError) {
                    return reject(startError);
                }

                assert.ok(api, 'api does not exist after start');
                console.log('starting seems to be done okayishly');
                ipfsApi = api;
                console.log('API: ' + api.apiHost + ':' + api.apiPort);
                console.log('Gateway: ' + api.gatewayHost + ':' + api.gatewayPort);

                let currentConfig = null;
                try {
                    // currentConfig = await promIpfsdGetConfig(['Bootstrap']);
                    currentConfig = await (() => {
                        return new Promise((res, rej) => {
                            ipfsd.getConfig(['Bootstrap'], (error, _a) => {
                                if (error) {
                                    console.log(error);
                                    rej(error);
                                }
                                console.log('got config');
                                res(_a);
                            });
                        });
                    })();
                } catch (getConfigError) {
                    console.error('Error getting IPFS config');
                }

                const leConfig = JSON.parse(currentConfig);
                let dirty = false;

                const customBootstrapAdditions = getCustomBootStrapAdditions(forcedPath);
                customBootstrapAdditions.Bootstrap.forEach(customPeer => {
                    if (!leConfig.includes(customPeer)) {
                        leConfig.push(customPeer);
                        dirty = true;
                    }
                });
                if (dirty) {
                    console.log('setting new bootstrap-config');
                    try {
                        await (() => {
                            return new Promise((res, rej) => {
                                ipfsd.setConfig(['Bootstrap'], JSON.stringify(leConfig), (error) => {
                                    if (error) {
                                        console.log(error);
                                        rej(error);
                                    }
                                    console.log('set config');
                                    res();
                                });
                            });
                        })();
                    } catch (e) {
                        console.log('error setting new config: ' + e);
                    }
                    try {
                        const conf = await (() => {
                            return new Promise((res, rej) => {
                                ipfsd.getConfig(['Bootstrap'], (error, _a) => {
                                    if (error) {
                                        console.log(error);
                                        rej(error);
                                    }
                                    console.log('got config');
                                    res(_a);
                                });
                            });
                        })();
                        console.log('the new bootstrap: ');
                        console.log(conf);
                    } catch (e) {
                        console.error('Error getting current config' + e);
                    }
                }

                resolve(ipfsApi);
            });
        });
        return initPromise;
    }
}

export async function stop() {
    ipfsd.stop = promisify(ipfsd.stop);
    await ipfsd.stop();
}

export async function upload(filePath, symKey, iv, nodelocalPath) {
    return new Promise(async (resolve, reject) => {
        try {
            const fileName = path.basename(filePath);
            const rst = createReadStream(filePath);

            const cipher = createCipheriv('aes-256-gcm', Buffer.from(symKey, 'latin1'), Buffer.from(iv, 'latin1'), { authTagLength: 16 });
            cipher.on('error', (err) => {
                console.log(`cipher stream error ${err}`);
                reject(err);
            });

            let authTag = '';

            cipher.on('finish', (err) => {
                authTag = cipher.getAuthTag().toString('latin1');
            });

            const p = nodelocalPath + '/' + fileName;

            const prom = ipfsApi.files.write(p, cipher, { create: true });
            rst.pipe(cipher);
            await prom;
            resolve(authTag);
        } catch (e) {
            reject(e);
        }
    });
}

export async function download(filePath, symKey, iv, authTag, hash) {
    return new Promise(async (resolve, reject) => {
        try {
            const stream = ipfsApi.catReadableStream(hash);
            stream.on('error', (err) => {
                console.log(`IPFS download error ${err}`);
                reject(err);
            });

            const decipher = createDecipheriv(
                'aes-256-gcm',
                Buffer.from(symKey, 'latin1'),
                Buffer.from(iv, 'latin1'),
                { authTagLength: 16 }
            );
            decipher.setAuthTag(Buffer.from(authTag, 'latin1'));
            decipher.on('error', (err) => {
                console.log(`Download decipher error ${err}`);
                reject(err);
            });
            
            const output = createWriteStream(filePath);
            output.on('error', (err) => {
                console.log(`File system writing error ${err}`);
                reject(err);
            });
            output.on('finish', () => {
                resolve();
            });

            stream.pipe(decipher).pipe(output);
        } catch (e) {
            reject(e);
        }
    });
}

const CUSTOM_BOOTSTRAP_FILE = 'customBootstrapAdditions.json';
export function generateIpfsConfig(forcedPath?: string) {
    const stdConfig = {
        'Addresses': {
            'Swarm': [
                '/ip4/0.0.0.0/tcp/4002',
                '/ip4/127.0.0.1/tcp/4003/ws'
            ],
            'API': '/ip4/127.0.0.1/tcp/5002',
            'Gateway': '/ip4/127.0.0.1/tcp/9090'
        },
        'Bootstrap': [
            '/ip4/213.165.80.135/tcp/4001/ipfs/QmXPiBKHQ31s33n6F9cUWYjdGSFs5nAzxBPoq6NqnrR1uj',
            '/ip4/104.236.176.52/tcp/4001/ipfs/QmSoLnSGccFuZQJzRadHn95W2CrSFmZuTdDWP8HXaHca9z',
            '/ip4/104.131.131.82/tcp/4001/ipfs/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
            '/ip4/104.236.179.241/tcp/4001/ipfs/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM',
            '/ip4/162.243.248.213/tcp/4001/ipfs/QmSoLueR4xBeUbY9WZ9xGUUxunbKWcrNFTDAadQJmocnWm',
            '/ip4/128.199.219.111/tcp/4001/ipfs/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu',
            '/ip4/104.236.76.40/tcp/4001/ipfs/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64',
            '/ip4/178.62.158.247/tcp/4001/ipfs/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd',
            '/ip4/178.62.61.185/tcp/4001/ipfs/QmSoLMeWqB7YGVLJN3pNLQpmmEk35v6wYtsMGLzSr5QBU3',
            '/ip4/104.236.151.122/tcp/4001/ipfs/QmSoLju6m7xTh3DuokvT3886QRYqxAzb1kShaanJgW36yx',
            '/ip6/2604:a880:1:20::1f9:9001/tcp/4001/ipfs/QmSoLnSGccFuZQJzRadHn95W2CrSFmZuTdDWP8HXaHca9z',
            '/ip6/2604:a880:1:20::203:d001/tcp/4001/ipfs/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM',
            '/ip6/2604:a880:0:1010::23:d001/tcp/4001/ipfs/QmSoLueR4xBeUbY9WZ9xGUUxunbKWcrNFTDAadQJmocnWm',
            '/ip6/2400:6180:0:d0::151:6001/tcp/4001/ipfs/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu',
            '/ip6/2604:a880:800:10::4a:5001/tcp/4001/ipfs/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64',
            '/ip6/2a03:b0c0:0:1010::23:1001/tcp/4001/ipfs/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd',
            '/ip6/2a03:b0c0:1:d0::e7:1/tcp/4001/ipfs/QmSoLMeWqB7YGVLJN3pNLQpmmEk35v6wYtsMGLzSr5QBU3',
            '/ip6/2604:a880:1:20::1d9:6001/tcp/4001/ipfs/QmSoLju6m7xTh3DuokvT3886QRYqxAzb1kShaanJgW36yx',
            '/dns4/node0.preload.ipfs.io/tcp/443/wss/ipfs/QmZMxNdpMkewiVZLMRxaNxUeZpDUb34pWjZ1kZvsd16Zic',
            '/dns4/node1.preload.ipfs.io/tcp/443/wss/ipfs/Qmbut9Ywz9YEDrz8ySBSgWyJk41Uvm2QJPhwDJzJyGFsD6'
        ],
        'API': {
            'HTTPHeaders':
            {
                'Access-Control-Allow-Credentials': [
                    'true'
                ],
                'Access-Control-Allow-Methods': [
                    'PUT', 'POST', 'GET'
                ],
                'Access-Control-Allow-Origin': [
                    '*'
                ]
            }
        },
    };

    const custom = getCustomBootStrapAdditions(forcedPath);
    custom.Bootstrap.forEach(peer => {
        if (!stdConfig.Bootstrap.includes(peer)){
            stdConfig.Bootstrap.push(peer);
        }
    });

    return stdConfig;
}

export function getCustomBootStrapAdditions(forcedPath?: string) {
    const pathToCustomBootstrapAdditions = ((forcedPath) ? forcedPath : getBasePathToSharu()) + path.sep + CUSTOM_BOOTSTRAP_FILE;

    let bootStrap = { 'Bootstrap': [] };
    if (fs.existsSync(pathToCustomBootstrapAdditions)) {
        try {
            bootStrap = JSON.parse(fs.readFileSync(pathToCustomBootstrapAdditions).toString());
        } catch (e) {
            console.log('something went wrong while processing your custom bootstrap, falling back to default');
            console.log(e);
        }
    } else {
        fs.writeFileSync(pathToCustomBootstrapAdditions, JSON.stringify(bootStrap));
        console.log('created default custom bootstrap config: ' + pathToCustomBootstrapAdditions);
    }
    // these are the nodes provided by sharu
    bootStrap.Bootstrap.push('/ip4/159.89.6.248/tcp/4004/ipfs/QmSmCMn5Mq5sLSa6mehmUtFLmqezu7mXHHPepvXiYTX1vR');
    bootStrap.Bootstrap.push('/ip4/159.89.6.248/tcp/4001/ipfs/Qmci7GnY4WvEJr1UFBAfMqji7Vch1cEpAcGgfVGHVKxeJp');
    return bootStrap;
}
