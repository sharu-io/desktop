import * as IPFSFactory from 'ipfsd-ctl';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { createReadStream, createWriteStream } from 'fs';
import { createCipheriv, createDecipheriv } from 'crypto';
import * as assert from 'assert';
import { Go, JsDep, IpfsImplementation } from './src/app/util/ipfsFlavours';

const ipfsImplementation: IpfsImplementation = new Go;

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
                type: ipfsImplementation.ipfsFactory
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
        'Addresses': ipfsImplementation.Addresses,
        'Bootstrap': ipfsImplementation.Bootstrap,
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
        'Swarm': ipfsImplementation.Swarm,
    };

    const custom = getCustomBootStrapAdditions(forcedPath);
    custom.Bootstrap.forEach(peer => {
        if (!stdConfig.Bootstrap.includes(peer)) {
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
