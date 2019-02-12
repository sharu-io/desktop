import { Injectable } from '@angular/core';
import { EthWalletService } from './ethWallet.service';
import { IpfsService } from './ipfs.service';
import { SharuSettings, EncryptedSharuSettings } from '../model/sharusettings.model';
import { CryptoService } from './crypto.service';
import { BehaviorSubject } from 'rxjs';
import { AesCryptoService } from './aesCrypto.service';
import { RsaCryptoService } from './rsaCrypto.service';

/**
 * thats the one for user-settings!
 */
@Injectable({
    providedIn: 'root'
})
export class SharuSettingsService {
    public settings: SharuSettings = { contacts: [], invites: [] };
    topic: BehaviorSubject<boolean> = new BehaviorSubject(false);

    private initProm: Promise<void>;
    private lashTriggeredHash = '';

    constructor(
        private ethWalletService: EthWalletService,
        private ipfsService: IpfsService,
        private crypto: CryptoService,
    ) {
        ethWalletService.subject().subscribe(inited => {
            if (inited) {
                ethWalletService.singleFileContract.settingsAssignedSubject.subscribe(newSettings => {
                    console.log('my settings have changed in chain/ipfs to ' + newSettings.newHash);
                    this.reloadFromIpfs(newSettings.newHash);
                });
                ethWalletService.singleFileContract.settingsOfOthersAssignedSubject.subscribe(otherSettings => {
                    this.ipfsService.movePin(otherSettings.oldHash, otherSettings.newHash);
                });
                ethWalletService.singleFileContract.keyAssignedSubject.subscribe(keyRegistered => {
                    console.log(`${keyRegistered.owner} entered sharu, pinning her key: ${keyRegistered.hash}`);
                    this.ipfsService.addPin(keyRegistered.hash);
                });
            }
        });
    }

    async init(): Promise<void> {
        if (this.initProm !== undefined) {
            return this.initProm;
        }
        this.initProm = new Promise(async (resolve, reject) => {
            await this.crypto.init();
            const filename = this.getFilename();

            let settingsContent: string = null;

            // check if we have something in chain
            const chainHash = await this.ethWalletService.singleFileContract.getSettingsHash();
            if (chainHash === undefined || chainHash === null || chainHash === '') {
                console.log(`found no settings in chain (${chainHash})`);
                const localRootFolderFiles = await this.ipfsService.ls('/');
                const settingsLocalFile = localRootFolderFiles.find(f => f.label === filename);
                if (settingsLocalFile) {
                    console.log(`found settings in local ipfs with hash ${settingsLocalFile.hash}`);
                    settingsContent = await this.ipfsService.readAsString('/ipfs/' + settingsLocalFile.hash);
                } else {
                    console.log('found no settings in local ipfs');
                }
            } else {
                console.log(`found settings in chain (${chainHash})`);
                settingsContent = await this.ipfsService.readAsString(`/ipfs/${chainHash}`);
            }
            if (settingsContent) {
                this.decryptAndPush(settingsContent, true);
            } else {
                this.settings = { random: await AesCryptoService.generateRandomKey(), contacts: [], invites: [] };
                await this.sync(true, true);
            }
            resolve();
        });
        return this.initProm;
    }

    private async reloadFromIpfs(hash: string) {
        const inIpfs = await this.ipfsService.readAsString('/ipfs/' + hash);
        await this.decryptAndPush(inIpfs);
    }

    private async decryptAndPush(fromIpfs: string, skipTopicPublish?: boolean) {
        const container: EncryptedSharuSettings = JSON.parse(fromIpfs);
        const key = RsaCryptoService.decrypt(container.encryptedKey, this.crypto.myPrivKeyPem);
        const decryptedPayload = await AesCryptoService.decrypt({
            iv: container.iv,
            data: AesCryptoService.str2ab(container.data),
            authTag: container.authTag
        }, key);
        this.settings = JSON.parse(AesCryptoService.ab2str(decryptedPayload));
        if (skipTopicPublish) {
            console.log('we are not notifying our clients here');
        } else {
            this.topic.next(true);
        }
    }

    async sync(skipDelete?: boolean, skipTopicPublish?: boolean): Promise<void> {
        const payload = JSON.stringify(this.settings);
        const key = await AesCryptoService.generateRandomKey();
        const encryptedKey = RsaCryptoService.encrypt(key, this.crypto.myPubKeyPem);
        const encryptedPayload = await AesCryptoService.encrypt(AesCryptoService.str2ab(payload), key);
        const encryptedSettings: EncryptedSharuSettings = {
            encryptedKey,
            iv: encryptedPayload.iv,
            data: AesCryptoService.ab2str(encryptedPayload.data),
            authTag: encryptedPayload.authTag
        };

        console.log('syncing settings to chain: (' + payload + ')');
        if (skipDelete) {
            console.log('writing usersettings to local ipfs');
        } else {
            console.log('overwriting usersettings in local ipfs');
            await this.ipfsService.removeNode('/' + this.getFilename(), true);
        }
        await this.ipfsService.writeRaw('/' + this.getFilename(), JSON.stringify(encryptedSettings));
        const currentHash = await this.ipfsService.getHash('/' + this.getFilename());
        if (currentHash !== this.lashTriggeredHash) {
            this.lashTriggeredHash = currentHash;
        }
        await this.ethWalletService.singleFileContract.setSettingsHash(this.lashTriggeredHash);
        if (skipTopicPublish) {
            console.log('we are not notifying our clients here');
        } else {
            this.topic.next(true);
        }
    }

    private getFilename(): string {
        return this.ethWalletService.getAddress() + '.sharuSettings';
    }
}
