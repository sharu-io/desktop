import { Injectable } from '@angular/core';
import { IpfsService } from './ipfs.service';
import { EthWalletService } from './ethWallet.service';
import { RsaCryptoService } from './rsaCrypto.service';
import { pki } from 'node-forge';
import { SharuKey } from '../model/sharukey.model';

@Injectable({
    providedIn: 'root'
})
export class CryptoService {
    public myPrivKeyPem: string;
    public myPubKeyPem: string;
    private initProm: Promise<void>;

    constructor(
        private ethWalletService: EthWalletService,
        private ipfsService: IpfsService,
    ) {
    }

    async init() {
        if (this.initProm !== undefined) {
            return this.initProm;
        }

        this.initProm = new Promise(async (resolve, reject) => {

            const keyPathLocal = this.getIpfsPath();
            const sharuKeyFileName = this.getSharuKeyFileName();
            let keyPathContent = null;
            let sharukey: SharuKey;
            let newKey = false;

            // check if we have something in chain
            const chainHash = await this.ethWalletService.singleFileContract.getMyPubKeyHash();
            if (chainHash === undefined || chainHash === null || chainHash === '') {
                console.log(`found nothing in chain (${chainHash})`);
                // nothing in chain, lets look for something in local ipfs
                const localRootFolderFiles = await this.ipfsService.ls('/');
                const sharuKeyLocal = localRootFolderFiles.find(f => {
                    return (f.label === sharuKeyFileName);
                });
                if (sharuKeyLocal === null || sharuKeyLocal === undefined) {
                    console.log('found no sharukey in local ipfs');
                } else {
                    console.log(`found local sharukeyfile: ${sharuKeyLocal.hash}`);
                    keyPathContent = await this.ipfsService.readAsString('/ipfs/' + sharuKeyLocal.hash);
                    console.log('local content: ' + keyPathContent);
                    newKey = true;
                }

            } else {
                console.log(`got chainHash ${chainHash} looking up`);
                keyPathContent = await this.ipfsService.readAsString('/ipfs/' + chainHash);
            }

            const walletPrivateKey = this.ethWalletService.getPrivateKey();
            if (!keyPathContent) {
                sharukey = await RsaCryptoService.createKeyPair(walletPrivateKey);
                const sign = await this.ethWalletService.sign(sharukey.publicKey);
                sharukey.sign = sign;
                await this.ipfsService.writeRaw(keyPathLocal, JSON.stringify(sharukey)); // TODO: delete first
                newKey = true;
            } else {
                sharukey = JSON.parse(keyPathContent);
                const sign = sharukey.sign;
                if (sign) {
                    if (this.ethWalletService.checkSign(sharukey.publicKey, sign, this.ethWalletService.getAddress())) {
                        console.log(`sharukey file of ${await this.ethWalletService.getAddress()} is not compromised! yay!`);
                    } else {
                        throw new Error(`sharukey file for ${await this.ethWalletService.getAddress()} was not signed by owner, aborting`);
                    }
                } else {
                    throw new Error(`no sign at sharukey file for ${await this.ethWalletService.getAddress()}, aborting`);
                }
            }

            this.myPrivKeyPem = pki.privateKeyToPem(pki.decryptRsaPrivateKey(sharukey.encryptedPrivateKey, walletPrivateKey));
            this.myPubKeyPem = sharukey.publicKey;

            if (newKey) {
                const hashOfSharukeyFile = await this.ipfsService.getHash(keyPathLocal);

                if (hashOfSharukeyFile !== chainHash) {
                    console.log(`hash in chain (${chainHash}) differs from local (${hashOfSharukeyFile})`);
                    await this.ethWalletService.singleFileContract.setPubKeyHash(hashOfSharukeyFile);
                }
            }
            resolve();
        });
    }

    private getIpfsPath(): string {
        return '/' + this.getSharuKeyFileName();
    }
    private getSharuKeyFileName(): string {
        return this.ethWalletService.getAddress() + '.sharuKey';
    }
}
