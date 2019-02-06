import { Injectable } from '@angular/core';
import { IpfsService } from './ipfs.service';
import { AesCryptoService } from './aesCrypto.service';
import { RsaCryptoService } from './rsaCrypto.service';
import { CryptoService } from './crypto.service';
import { IpfsFile } from '../model/ipfsFile.model';
import { AesEncrypted } from '../model/aesCryptoData.model';
import { Keychain } from '../model/keychain.model';
import { AsyncBundle } from '../model/asyncBundle.model';
import { AesMetaDataCollection } from '../model/aesMetadataCollection.model';
import { AesMeta } from '../model/aesMetadata.model';
import { TreeNodeItem } from '../model/treeNodeItem.model';
import { EthWalletService } from './ethWallet.service';
import { ReceiverUnknownInSharuError } from './errors/ReceiverUnkownInSharu.error';
import { ShareNotKnownInSharu } from './errors/ShareNotKnownInSharu.error';
import { ShareAlreadySentToReceiverError } from './errors/ShareAlreadySentToReceiver.error';
import { HashRingBuffer } from '../model/hashRingBuffer.model';
import { SharuIcons } from '../model/icon.model';
import Semaphore from 'semaphore-async-await';
import { SharuKey } from '../model/sharukey.model';
import { SharuShareSettings, EncryptedSharuShareSettings } from '../model/sharuShareSettings.model';
import { NoShareSettingsError } from './errors/NoShareSettings.error';
import { BigNumber } from 'ethers/utils';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import fs = require('fs');

@Injectable({
    providedIn: 'root'
})
export class FileService {
    public readonly DOPPELBODEN = '.doppelboden';
    public readonly SHARESETTINGS = '.sharu.json';
    public readonly KEYCHAIN = '.keychain.json';
    public readonly VERIFY = '.verify.json';
    public readonly HASHRINGBUFFER = '.oldhashes.json';
    constructor(
        private ipfs: IpfsService,
        private eth: EthWalletService,
        private cs: CryptoService,
    ) { }

    public getFileSize(filename: string): number {
        const stat = fs.statSync(filename);
        return stat.size;
    }

    // migration to SS: done. SS uses this one
    public async getNodeChildren(node: TreeNodeItem): Promise<TreeNodeItem[]> {
        let result: TreeNodeItem[];
        if (node.localMatch !== undefined) {
            await node.localMatch;
        }
        if (node.localPath) {
            console.log('getNodeChildren for localPath: ' + node.localPath);
            result = await this.ipfs.ls(node.localPath);
        } else {
            console.log('getNodeChildren for remotePath: /ipfs/' + node.hash);
            result = await this.ipfs.lsRemote('/ipfs/' + node.hash);
        }
        // remove doppelboden
        result = result.filter(f => f.label !== this.DOPPELBODEN);

        // attach parent and ipfspath
        result.forEach(r => {
            r.parent = node;
            if (node.localPath) {
                r.localPath = node.localPath + '/' + r.label;
            }
        });

        // create verify semaphores for directorys
        result.filter(r => r.leaf === false).forEach(f => f.verifyFileSemaphore = new Semaphore(1));

        return result;
    }

    public async createShare(name: string, share: TreeNodeItem): Promise<void> {
        await this.ipfs.createFolder(`/${name}`);
        await this.ipfs.createFolder(`/${name}/${this.DOPPELBODEN}`);

        // generate symetric key for share
        const key = await AesCryptoService.generateRandomKey();

        // create keychain (with owner as first key)
        const wallet: string = this.eth.getAddress();
        const ownerBundle: string = RsaCryptoService.encrypt(key, this.cs.myPrivKeyPem);
        console.log('bundle: ' + ownerBundle);

        const keychain: Keychain = new Keychain();
        keychain.addOrModify({ wallet: wallet, rsaContent: ownerBundle });
        console.log('keychain: ' + JSON.stringify(keychain));
        await this.writeToKeyChain(share, keychain);

        // verify file und hashringbuffer anlegen
        await this.createVerifyFile(share);
        await this.createHashRingBuffer(share);

        share.hash = await this.recalcHash(share, true);
        // create sharushare-settings
        await this.createSharuShareSettingsFile(share, wallet, name);

        // recalc hash and publish to chain
        const hash = await this.recalcHash(share);
        share.hash = hash;
        const pointer = await this.eth.shareContract.createShare(hash);
        share.pointer = pointer;
        share.iconOwned = SharuIcons.ownShare;
        const settings: SharuShareSettings = await this.getShareSettings(share);
        settings.pointer = pointer;
        this.writeToShareSettingsFile(share, settings);
        // after setting the pointer, obviously the hash of the share changed again
        const oldHash = share.hash;
        const newHash = await this.recalcHash(share);
        share.hash = newHash;
        await this.eth.shareContract.updateHash(pointer, oldHash, newHash);
        share.resolved = true;
    }

    private async createSharuShareSettingsFile(share: TreeNodeItem, ownerWallet: string, shareName: string) {
        await share.shareSettingsSemapohore.execute(async () => {
            const shareSettings: SharuShareSettings = {
                name: shareName,
                owner: ownerWallet,
                pointer: null,
            };
            await this.writeToShareSettingsFile(share, shareSettings, true);
        });
    }

    private async createVerifyFile(share: TreeNodeItem) {
        await share.verifyFileSemaphore.execute(async () => {
            const verify: AesMetaDataCollection = new AesMetaDataCollection();
            await this.writeToVerifyFile(share, verify);
        });
    }
    private async createHashRingBuffer(share: TreeNodeItem) {
        await share.hashBufferSemaphore.execute(async () => {
            const buffer: HashRingBuffer = new HashRingBuffer();
            await this.writeToHashRingBuffer(share, buffer);
        });
    }

    /**
     * @throws ShareNotKnownInSharu ReceiverUnknownInSharuError ShareAlreadySentToReceiverError
     * @param node
     * @param receiver
     */
    public async shareWith(node: TreeNodeItem, receiver: string) {
        // sanity: make sure this is known to chain
        const topLevel = this.getTopNode(node);
        await this.ensurePointer(topLevel);

        // lookup in chain: ipfs-hash for receiver
        const receiverHash: string = await this.eth.singleFileContract.getPubKeyHashFor(receiver);
        if (!receiverHash) {
            throw new ReceiverUnknownInSharuError();
        }
        console.log(`hash for ${receiver} is ${receiverHash}`);

        // pin it!
        this.ipfs.addPin(receiverHash);

        // lookup symetric key for this share
        const sharuKey: SharuKey = JSON.parse(await this.ipfs.readAsString('/ipfs/' + receiverHash));
        console.log(`successfully fetched pubkey for ${receiver} from IPFS!`);
        if (sharuKey.sign) {
            if (!this.eth.checkSign(sharuKey.publicKey, sharuKey.sign, receiver)) {
                throw new Error('sharukey of ' + receiver + ' was not signed by owner! aborting');
            }
        } else {
            throw new Error('sharukey was not signed at all, aborting');
        }
        const receiverPubKey = sharuKey.publicKey;

        // get symetric key of the share
        const symetricKey = await this.getSymetricKey(topLevel);

        // encrypt symetric key for receiver
        const keychain = await this.getKeyChain(topLevel);
        if (keychain.getReceivers().includes(receiver)) {
            throw new ShareAlreadySentToReceiverError();
        }

        const newBundle = RsaCryptoService.encrypt(symetricKey, receiverPubKey);
        keychain.addOrModify({ wallet: receiver, rsaContent: newBundle });

        // save new keychain to ipfs
        await this.writeToKeyChain(topLevel, keychain, false);
    }

    public async revokeShare(node: TreeNodeItem, receiver: string) {
        // sanity; make sure we are on top-level
        const topLevel = this.getTopNode(node);

        // sanity: make sure this is known to chain
        await this.ensurePointer(topLevel);

        // remove from keychain
        const keychain = await this.getKeyChain(topLevel);
        if (!keychain.remove(receiver)) {
            throw new Error('receiver was not in keychain');
        }
        await this.writeToKeyChain(topLevel, keychain, false);
    }

    public async createFolder(subDir: string, parent: TreeNodeItem): Promise<TreeNodeItem[]> {
        // sanity: parent must be local
        if (parent.localPath === undefined || parent.localPath === null) {
            throw new Error(parent.label + ' is not a local directory');
        }
        const share = this.getTopNode(parent);

        // sanity: share must have a pointer
        if (share.pointer === undefined || share.pointer === null) {
            console.error(`we should do a lookup in the chain, if we know noone.
            But better to invest the energy in waiting for share-transactions and write that back.`);
            throw new Error('share is unknown to chain');
        }

        // create share stub
        const newDir: TreeNodeItem = {
            pointer: null,
            publishedToChain: false,
            label: subDir,
            root: true,
            hash: null,
            leaf: false,
            owned: true,
            parent: parent,
            localPath: parent.localPath + '/' + subDir,
            verifyFileSemaphore: new Semaphore(1),
        };

        await this.ipfs.createFolder(`${parent.localPath}/${subDir}`);
        await this.ipfs.createFolder(`${parent.localPath}/${subDir}/${this.DOPPELBODEN}`);

        await this.createVerifyFile(newDir);

        return await this.lsDirLocal(parent);
    }

    public async encryptFile(dir: TreeNodeItem, file: File): Promise<AesEncrypted> {
        // get symetric key for share
        const symKey: string = await this.getSymetricKey(dir);

        // encrypt payload
        const crypted: AesEncrypted = await AesCryptoService.encryptFile(file, symKey);
        return crypted;
    }

    public async uploadCrypted(node: TreeNodeItem, file: File, crypted: AesEncrypted): Promise<TreeNodeItem> {
        const topNode = this.getTopNode(node);
        await this.ensurePointer(topNode);

        await this.ipfs.writeAB(node.localPath + '/' + file.name, crypted.data);

        await node.verifyFileSemaphore.execute(async () => {
            // get verifyFile for directory
            const verify = await this.getVerifyFileLocal(node);
            // add to verify
            verify.addOrModify({ filename: file.name, iv: crypted.iv, authTag: crypted.authTag });

            // overwrite verifyFile
            await this.writeToVerifyFile(node, verify, false);
        });

        return (await this.lsDirLocal(node)).find(f => f.label === file.name);
    }

    public async encryptUploadStreamed(dir: TreeNodeItem, fileName: string, filePath: string) {
        const topNode = this.getTopNode(dir);
        await this.ensurePointer(topNode);

        const symKey: string = await this.getSymetricKey(dir);
        const iv = (await (promisify(randomBytes)(32))).toString('ascii');

        const electron = require('electron');
        const ipfsControl = electron.remote.require('./ipfsControl');
        const authTag = await ipfsControl.upload(filePath, symKey, iv, dir.localPath);

        await dir.verifyFileSemaphore.execute(async () => {
            // get verifyFile for directory
            const verify = await this.getVerifyFileLocal(dir);

            // add to verify
            verify.addOrModify({ filename: fileName, iv: iv, authTag: authTag });

            // overwrite verifyFile
            await this.writeToVerifyFile(dir, verify, false);
        });

        const newFile = (await this.lsDirLocal(dir)).find(f => f.label === fileName);
        SharuIcons.setIcon(newFile);
        dir.children.push(newFile);
    }

    public async deleteFile(node: TreeNodeItem): Promise<TreeNodeItem[]> {
        // make sure this is known to chain
        const topDir = this.getTopNode(node);
        await this.ensurePointer(topDir);

        const isDir = !node.leaf;

        // remove file from ipfs
        if (!this.ipfs.removeNode(node.localPath)) {
            throw new Error(`deletion of ${node.localPath} was not possible`);
        }

        if (!isDir) {
            // update verifyFile
            await node.parent.verifyFileSemaphore.execute(async () => {
                const verify = await this.getVerifyFile(node.parent);
                const removed = verify.remove(node.label);
                if (!removed) {
                    console.error(`uups, file ${node.label} isn´t part of the verifyfile?`);
                    throw new Error('the file you deleted is not part of the verifyfile.');
                }
                await this.ipfs.removeNode(this.getLocalVerifyFileLocation(node.parent));
                await this.writeToVerifyFile(node.parent, verify, true);
            });
        }

        // node is root --> share
        if (topDir === node) {
            await this.eth.shareContract.removeShare(node.pointer);
            return null;
        } else {
            // re-read the contents of containingDir and return this
            return await this.lsDirLocal(node.parent);
        }
    }

    public async downloadDecryptStreamed(node: TreeNodeItem, filePath: string) {
        const electron = require('electron');
        const ipfsControl = electron.remote.require('./ipfsControl');

        const symKey = await this.getSymetricKey(node);
        const aesCollection = await this.getVerifyFile(node.parent);
        const knownMeta: AesMeta = aesCollection.get(node.label);
        console.log(`download: ${node.label}`);
        await ipfsControl.download(filePath, symKey, knownMeta.iv, knownMeta.authTag, node.hash);
    }

    public async getCryptedContent(node: TreeNodeItem): Promise<IpfsFile> {
        const filesEncrypted: IpfsFile[] = await this.ipfs.get(node);
        if (filesEncrypted.length === 1) {
            return filesEncrypted[0];
        } else {
            throw new Error('ok, we need to rewrite this!');
        }
    }

    public async decryptContent(node: TreeNodeItem, crypted: IpfsFile): Promise<IpfsFile> {
        const symKey = await this.getSymetricKey(node);
        const aesCollection = await this.getVerifyFile(node.parent);

        const knownMeta: AesMeta = aesCollection.get(crypted.name);
        const aes: AesEncrypted = {
            data: await AesCryptoService.fromFile(crypted.blob),
            iv: knownMeta.iv,
            authTag: knownMeta.authTag
        };

        const decrypted: ArrayBuffer = await AesCryptoService.decrypt(aes, symKey);
        crypted.blob = new Blob([new DataView(decrypted)]);

        return crypted;
    }

    public async getReceivers(currentDir: TreeNodeItem): Promise<string[]> {
        const keychain = await this.getKeyChain(currentDir);
        return keychain.getKeyOwners().filter(f => {
            return (f !== this.eth.getAddress());
        });
    }

    private async lsDirLocal(directory: TreeNodeItem) {
        const items = (await this.ipfs.ls(directory.localPath)).filter(f => {
            return (f.label !== this.DOPPELBODEN &&
                !f.label.endsWith('.sharuKey'));
        });
        items.forEach(i => {
            i.parent = directory;
            i.localPath = directory.localPath + '/' + i.label;
            if (!i.leaf) {
                i.verifyFileSemaphore = new Semaphore(1);
            }
        });
        return items;
    }

    async recalcHash(node: TreeNodeItem, skipRingBuffer?: boolean): Promise<string> {
        if ((skipRingBuffer === undefined || skipRingBuffer === false)
            && (node.hash)
            && (node.parent === undefined || node.parent === null)) {
            await node.hashBufferSemaphore.execute(async () => {
                const ringbuffer = await this.getHashRingBuffer(node);
                ringbuffer.push(node.hash);
                await this.writeToHashRingBuffer(node, ringbuffer, false);
            });
        }

        return (await this.ipfs.ls(node.parent === null ? '/' : node.parent.localPath)).find(args => {
            return args.label === node.label;
        }).hash;
    }

    public async lookupPointerInChain(node: TreeNodeItem): Promise<BigNumber> {
        console.log(`lookupPointerInChain(${node.label}) with hash ${node.hash}`);
        const sentShares = await this.eth.shareContract.getMySentShares();
        const inChain = sentShares.find(l => l.hash === node.hash);
        if (inChain) {
            node.pointer = inChain.pointer;
            return inChain.pointer;
        }
        return null;
    }

    private async ensurePointer(node: TreeNodeItem) {
        if (node.pointer === null || node.pointer === undefined) {
            // This is what happens with new folders. We just try to read from the chain
            // If it fails, not that bad. But we need a plan what to do with local folders that are not synced to the chain
            // But for now we'll just keep it like that.

            const foundInChain = await this.lookupPointerInChain(node);
            if (!foundInChain) {
                throw new ShareNotKnownInSharu(node);
            }
        }
    }

    public getTopNode(node: TreeNodeItem): TreeNodeItem {
        let topLevelNode = node;
        while (topLevelNode.parent !== undefined && topLevelNode.parent !== null) {
            topLevelNode = topLevelNode.parent;
        }
        return topLevelNode;
    }

    private async getAsymetricBundle(currentDir: TreeNodeItem): Promise<string> {
        const keychain = await this.getKeyChain(this.getTopNode(currentDir));
        const wallet = (await this.eth.getAddress());
        const key: AsyncBundle = keychain.get(wallet);
        if (key === null) {
            throw new Error(`this should never happen. ${wallet} has no key in keychain. shutting down`);
        }
        const ownerBundle = key.rsaContent;
        return ownerBundle;
    }

    public async getShareName(dir: TreeNodeItem): Promise<string> {
        const shareSetting = await this.getShareSettings(dir);
        if (shareSetting) {
            return shareSetting.name;
        } else {
            throw new NoShareSettingsError(dir.label);
        }
    }

    private async getShareSettings(share: TreeNodeItem): Promise<SharuShareSettings> {
        const interestingDirs = await this.ipfs.lsRemote(share.hash);
        const doppelboden = interestingDirs.find(l => l.label === this.DOPPELBODEN);
        const interestingFiles = await this.ipfs.lsRemote(doppelboden.hash);
        const shareSettingFile = interestingFiles.find(c => c.label === this.SHARESETTINGS);
        if (shareSettingFile) {
            const data = await this.ipfs.readAsString(`/ipfs/${shareSettingFile.hash}`);
            const container: EncryptedSharuShareSettings = JSON.parse(data);
            const key = await this.getSymetricKey(share);
            const decrypted = await AesCryptoService.decrypt({
                iv: container.iv,
                data: AesCryptoService.str2ab(container.data),
                authTag: container.authTag
            }, key);
            return JSON.parse(AesCryptoService.ab2str(decrypted));
        } else {
            throw new Error('could not find sharesettings for share ' + share.label);
        }
    }

    async getHashRingBuffer(share: TreeNodeItem): Promise<HashRingBuffer> {
        const interestingDirs = await this.ipfs.lsRemote(share.hash);
        const doppelboden = interestingDirs.find(l => l.label === this.DOPPELBODEN);
        const interestingFiles = await this.ipfs.lsRemote(doppelboden.hash);
        const ringbuffer = interestingFiles.find(c => c.label === this.HASHRINGBUFFER);
        if (ringbuffer) {
            return HashRingBuffer.fromRaw(await this.ipfs.readAsString(`/ipfs/${ringbuffer.hash}`));
        } else {
            throw new Error('couldn´t find a hashringbuffer for share ' + share.label);
        }
    }

    async getKeyChain(currentDir: TreeNodeItem): Promise<Keychain> {
        let lowestDir = this.getTopNode(currentDir);
        const interestingDirs = await this.ipfs.lsRemote(lowestDir.hash);
        lowestDir = interestingDirs.find(l => l.label === this.DOPPELBODEN);
        const interestingFiles = await this.ipfs.lsRemote(lowestDir.hash);
        const keychainItem = interestingFiles.find(c => c.label === this.KEYCHAIN);
        return Keychain.fromRaw(await this.ipfs.readAsString(`/ipfs/${keychainItem.hash}`));
    }

    private async getSymetricKey(topLevel: TreeNodeItem) {
        const bundle = await this.getAsymetricBundle(topLevel);
        const symetricKey = RsaCryptoService.decrypt(bundle, this.cs.myPrivKeyPem);
        return symetricKey;
    }

    private async writeToKeyChain(node: TreeNodeItem, keychain: Keychain, create?: boolean) {
        if (node.localPath === undefined || node.localPath === null) {
            throw new Error('trying to write to keychain for unknwon localPath');
        }
        const location = `${node.localPath}/${this.DOPPELBODEN}/${this.KEYCHAIN}`;
        if (create !== undefined && !create) {
            console.log('removing ' + location);
            await this.ipfs.removeNode(location);
        }
        console.log('writing ' + location);
        await this.ipfs.writeRaw(location, JSON.stringify(keychain));
    }

    private async getVerifyFileLocal(currentDir: TreeNodeItem): Promise<AesMetaDataCollection> {
        const interestingDirs = await this.ipfs.ls(currentDir.localPath);
        return await this._getVerifyFile(interestingDirs);
    }

    private async getVerifyFile(currentDir: TreeNodeItem): Promise<AesMetaDataCollection> {
        const interestingDirs = await this.ipfs.lsRemote(currentDir.hash);
        return await this._getVerifyFile(interestingDirs);
    }

    private async _getVerifyFile(interestingDirs: TreeNodeItem[]) {
        const doppelboden = interestingDirs.find(d => {
            return d.label === this.DOPPELBODEN;
        });
        const interestingFiles = await this.ipfs.lsRemote(doppelboden.hash);
        const verifyFile = interestingFiles.find(v => {
            return v.label === this.VERIFY;
        });
        const verify = AesMetaDataCollection.fromRaw(await this.ipfs.readAsString(`/ipfs/${verifyFile.hash}`));
        return verify;
    }

    private async writeToShareSettingsFile(share: TreeNodeItem, content: SharuShareSettings, skipDelete?: boolean) {
        const location = this.getSharuShareSettingsLocalLocation(share);
        const json = JSON.stringify(content);
        const key = await this.getSymetricKey(share);
        const encrypted = await AesCryptoService.encrypt(AesCryptoService.str2ab(json), key);
        const encryptedSetting: EncryptedSharuShareSettings = {
            data: await AesCryptoService.ab2str(encrypted.data),
            iv: encrypted.iv,
            authTag: encrypted.authTag
        };
        if (skipDelete) {
            console.log('writing new sharesettings');
        } else {
            console.log('overwriting sharesettings');
            await this.ipfs.removeNode('/' + location);
        }
        await this.ipfs.writeRaw('/' + location, JSON.stringify(encryptedSetting));
    }

    private async writeToVerifyFile(parentDir: TreeNodeItem, content: AesMetaDataCollection, create?: boolean) {
        const verifyFile = this.getLocalVerifyFileLocation(parentDir);
        const json = JSON.stringify(content);
        if (create !== undefined && !create) {
            console.log('rewriting veryfile: ' + verifyFile);
            await this.ipfs.removeNode(verifyFile);
        } else {
            console.log('creating veryfile: ' + verifyFile);
        }
        await this.ipfs.writeRaw(verifyFile, json);
    }

    private async writeToHashRingBuffer(share: TreeNodeItem, content: HashRingBuffer, create?: boolean) {
        const location = this.getHashRingBufferLocation(share);
        const json = JSON.stringify(content);
        if (create !== undefined && !create) {
            console.log('rewriting ringbuffer');
            await this.ipfs.removeNode(location);
        } else {
            console.log('creating ringbuffer');
        }
        await this.ipfs.writeRaw(location, json);

    }

    private getSharuShareSettingsLocalLocation(share: TreeNodeItem) {
        if (share.localPath) {
            return `${share.localPath}/${this.DOPPELBODEN}/${this.SHARESETTINGS}`;
        } else {
            throw new Error('node has no ipfs-path: ' + JSON.stringify(share));
        }
    }

    private getHashRingBufferLocation(share: TreeNodeItem) {
        return `${share.localPath}/${this.DOPPELBODEN}/${this.HASHRINGBUFFER}`;
    }

    private getLocalVerifyFileLocation(node: TreeNodeItem): string {
        if (node.localPath !== undefined) {
            return node.localPath + '/' + this.DOPPELBODEN + '/' + this.VERIFY;
        }
        throw new Error('node has no ipfs-path: ' + JSON.stringify(node));
    }
}
