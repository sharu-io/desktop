import { Injectable } from '@angular/core';
import { TreeNodeItem, MaybeLocalTreeNodeItem } from '../model/treeNodeItem.model';
import { FileService } from './file.service';
import { EthWalletService } from './ethWallet.service';
import { IpfsService } from './ipfs.service';
import { Contact } from '../model/contacts.model';
import { BehaviorSubject } from 'rxjs';
import { ShareWithYourselfError } from './errors/ShareWithYourself.error';
import { Router } from '@angular/router';
import { SharuIcons } from '../model/icon.model';
import { UploadJob, JobsService, UploadStreamedJob } from './jobs.service';
import Semaphore from 'semaphore-async-await';
import { Location } from '@angular/common';
import { SharuShare } from '../model/sharuShares.models';
import { ToastService } from './toast.service';
import { SharuSettingsService } from './sharusettings.service';
import { utils } from 'ethers';
import { BigNumber } from 'ethers/utils';
import * as baffle from 'baffle';
import { basename } from 'path';

@Injectable({
    providedIn: 'root'
})
export class ShareService {
    constructor(
        private file: FileService,
        private eth: EthWalletService,
        private ipfs: IpfsService,
        private jobs: JobsService,
        private settings: SharuSettingsService,
        private ethWallet: EthWalletService,
        private toast: ToastService,
        private router: Router,
        private location: Location
    ) {
        this.settings.topic.subscribe(async b => {
            if (b && this.sharesInitiallyLoaded) {
                // watch out for newly added invited shares
                const acceptedInvitePointers = this.settings.settings.invites.filter(f => f.accepted)
                    .map(i => i.pointerAsHex)
                    .map(d => utils.bigNumberify(d));
                const unhandledPointers: BigNumber[] = [];
                acceptedInvitePointers.forEach(invitePointer => {
                    let alreadyHandled = false;

                    const knownPointers = this.shares.map(s => s.pointer).filter(f => (f));
                    for (const p of knownPointers) {
                        if (p.eq(invitePointer)) {
                            alreadyHandled = true;
                            break;
                        }
                    }
                    if (!alreadyHandled) {
                        unhandledPointers.push(invitePointer);
                    }
                });

                if (unhandledPointers.length > 0) {
                    const shareInfo = (await this.eth.shareContract.getShareDetails(unhandledPointers)).filter(s => s.hash !== '');
                    // in case the share was deleted in chain, we get back an empty ('') hash. filter those out here
                    const rootDirs = (await this.ipfs.scanLocalRootFolder()).filter(f => f.leaf === false);
                    shareInfo.forEach(s => {
                        this.shares.push(this.initiateRootShare(rootDirs, s));
                    });
                    setTimeout(() => {
                        const baf = baffle('.baffle', { characters: '█▓▒░', speed: 150 }).reveal(5000);
                        baf.start();
                    }, 100);
                }
            }
        });

        eth.subject().subscribe(inited => {
            if (inited) {
                eth.shareContract.hashUpdates().subscribe(async update => {
                    const relevant = this.shares.find(f => f.pointer && f.pointer.eq(update.pointer));
                    if (relevant) {
                        console.log(`received update for share ${relevant.label} (${relevant.pointer})`);

                        // 1) if the oldHash is '' -> this is the first announcement of the share, we dont care
                        if ((update.oldHash === '')) {
                            console.log('-> initial announcement for the share, discarding');
                            return;
                        }

                        if (update.newHash === '') {
                            console.log('-> share was deleted by owner, removing');

                            // removing from list
                            this.shares = this.shares.filter(f => f.pointer !== relevant.pointer);

                            // removing from invite-settings
                            this.settings.settings.invites
                                .find(f => f.pointerAsHex === relevant.pointer.toHexString()).accepted = undefined;
                            this.settings.sync();

                            // removing from view
                            if ((this.selectedShare) && this.selectedShare.pointer.eq(update.pointer)) {
                                router.navigate(['/']);
                                this.toast.notify(
                                    'warn',
                                    `share ${relevant.label} was removed under your a**`,
                                    'the share you have just watched was rmeoved by the owner. so sad.'
                                );
                            } else {
                                this.toast.notify(
                                    'info',
                                    `share ${relevant.label} has been removed`,
                                    `..so it is gone from the sharelist. just fyi`
                                );
                            }

                            return;
                        }

                        // is the announced newhash already in the local state? ;)
                        if (update.newHash === relevant.hash) {
                            console.log('-> we are already up2date locally, discarding');
                            return;
                        }

                        // is the announced newhash already in the local hashringbuffer? if yes, this is an outdated update
                        const localHashringBuffer = await this.file.getHashRingBuffer(relevant);
                        if (localHashringBuffer.hashPreviouslyUsed(update.newHash)) {
                            console.log('-> announced newHash is already in local hashringBuffer, discarding');
                            return;
                        }

                        const oldHash = relevant.hash;
                        relevant.hash = update.newHash;

                        // are we still in the receiverlist of the share? if not we should remove the share
                        if ((await this.file.getKeyChain(relevant)).get(await this.ethWallet.getAddress()) == null) {
                            console.log('-> rights where removed for this share - removing');

                            // removing from list
                            this.shares = this.shares.filter(f => f.pointer !== relevant.pointer);

                            // removing from invite-settings
                            this.settings.settings.invites
                                .find(f => f.pointerAsHex === relevant.pointer.toHexString()).accepted = undefined;

                            // removing from view
                            if ((this.selectedShare) && this.selectedShare.pointer.eq(update.pointer)) {
                                router.navigate(['/']);
                                this.toast.notify(
                                    'warn',
                                    `you lost rights for share ${relevant.label}`,
                                    'you lost rights for the share you have just watched. so sad.'
                                );
                            } else {
                                this.toast.notify(
                                    'info',
                                    `you lost rights for share ${relevant.label}`,
                                    `..so it is gone from the sharelist. just fyi`
                                );
                            }
                            this.settings.sync();

                            return;
                        }

                        if ((this.selectedShare) && this.selectedShare.pointer.eq(update.pointer)) {
                            relevant.children = null;
                            let subDir;
                            if ((this.breadcrumb) && this.breadcrumb.length > 1) {
                                const pathInTree: string[] = [];
                                for (let i = 1; i < this.breadcrumb.length; i++) {
                                    pathInTree.push(this.breadcrumb[i].label);
                                }
                                let dir = await this.ipfs.lsRemote('/ipfs/' + update.newHash);
                                for (const step of pathInTree) {
                                    const newSubDir = dir.find(f => f.label === step);
                                    if (newSubDir) {
                                        subDir = newSubDir;
                                        dir = await this.ipfs.lsRemote('/ipfs/' + subDir.hash);
                                    } else {
                                        this.toast.notify(
                                            'warn',
                                            'Directory removed',
                                            `The directory you are watching right now has been removed,
                                            routed to the best place near the old location`
                                        );
                                        break;
                                    }
                                }
                            }

                            if (subDir) {
                                router.navigate(['/share', update.newHash, subDir.hash]);
                                console.log('-> current share with some subfolder is visible right now, doing magic');
                            } else {
                                router.navigate(['/share', update.newHash]);
                                console.log('-> updating rootfolder of share (is currently visible)');
                            }
                        } else {
                            console.log('-> share is not selected right now, we can silently update the hash');
                        }
                    } else {
                        console.log('-> not relevant for us');
                    }
                });
            }
        });
    }

    private MAX_UPLOAD_SIZE_IN_MB = 2000;

    newReceiversCalculated: BehaviorSubject<TreeNodeItem> = new BehaviorSubject(null);

    selectedShare: TreeNodeItem;
    shares: TreeNodeItem[] = [];
    sharesInitiallyLoaded = false;
    children: TreeNodeItem[] = [];
    breadcrumb: TreeNodeItem[] = [];
    shareOwner: Map<TreeNodeItem, string> = new Map();
    shareReceivers: Map<TreeNodeItem, string[]> = new Map();

    public setSelectedShare(selectedShare: TreeNodeItem) {
        this.selectedShare = selectedShare;
    }

    public async loadShares(force?: boolean): Promise<void> {
        if (this.shares !== null && this.shares.length > 0) {
            if (force === undefined || !force) {
                return;
            }
        }

        // get all sent shares
        const sentShares = await this.eth.shareContract.getMySentShares();
        sentShares.forEach(s => s.sent = true);
        // get received shares from settings
        let receivedShares = [];
        if (this.settings.settings.invites) {
            const onlyAccepted = this.settings.settings.invites.filter(i => i.accepted);
            const receivedPointers = onlyAccepted.map(m => {
                return {
                    pointer: utils.bigNumberify(m.pointerAsHex),
                    pinned: m.pinned
                };
            });
            const whichPointersToLookupInChain = receivedPointers.map(m => m.pointer);
            // const receivedPointers = this.settings.settings.invites.filter(i => i.accepted).map(m => m.pointer);
            receivedShares = (await this.eth.shareContract.getShareDetails(whichPointersToLookupInChain)).filter(f => f.hash !== '');
            receivedShares.forEach(r => {
                r.sent = false;
                r.pinned = receivedPointers.find(f => f.pointer.eq(r.pointer)).pinned;
            });
        }

        const shares: SharuShare[] = [].concat(sentShares).concat(receivedShares);

        const rootDirs = (await this.ipfs.scanLocalRootFolder()).filter(f => f.leaf === false);
        this.shares = [];
        for (const s of shares) {
            const newItem = this.initiateRootShare(rootDirs, s);
            this.shares.push(newItem);
        }
        this.sharesInitiallyLoaded = true;
    }

    private initiateRootShare(rootDirs: TreeNodeItem[], s: SharuShare) {
        const newItem = new MaybeLocalTreeNodeItem(rootDirs, this.file, this.toast, this.eth);
        newItem.local = undefined;
        newItem.iconOwned = s.sent ? SharuIcons.ownShare : SharuIcons.receivedShare,
            newItem.owned = s.sent ? true : false;
        newItem.localPath = undefined;
        newItem.leaf = false;
        newItem.parent = null;
        newItem.pointer = s.pointer;
        newItem.hash = s.hash;
        newItem.label = s.hash;
        newItem.publishedToChain = true;
        newItem.iconLocation = SharuIcons.desynced;
        newItem.hashBufferSemaphore = new Semaphore(1);
        newItem.shareSettingsSemapohore = new Semaphore(1);
        newItem.verifyFileSemaphore = new Semaphore(1);
        newItem.lookForLocal();
        return newItem;
    }

    public async getNodeByHash(rootHash: string, folderhash?: string): Promise<TreeNodeItem> {
        const share = this.shares.find(f => f.hash === rootHash);
        if (share === undefined) {
            console.log('funny things on reloading...');
            return undefined;
        }
        await this.loadChildrenByNode(share);
        if (folderhash) {
            const directory = await this.traverse(share.children, folderhash);
            this.loadChildrenByNode(directory);
            return directory;
        }
        return share;
    }

    public async loadChildren(hash: string): Promise<void> {
        const node = await this.traverse(this.shares, hash);
        if (!node) {
            throw new Error('this is funny, you are looking for a hash that is not related to your tree?');
        }
        await this.loadChildrenByNode(node);
    }

    private async loadChildrenByNode(node: TreeNodeItem) {
        if (node.children === null || node.children === undefined) {
            node.children = await this.file.getNodeChildren(node);
        }
        this.children = node.children;
        SharuIcons.updateIcons(this.children);
        this.makeBreadCrumbs(node);
    }

    public async loadChildrenByLocal(path: string): Promise<TreeNodeItem> {
        const node = await this.localTraverse(path);
        if (node === undefined || node === null) {
            throw new Error('so sad! couldn´t find your local path: ' + path);
        }
        await this.loadChildrenByNode(node);
        SharuIcons.updateIcons(this.children);
        return node;
    }

    private async localTraverse(path: string): Promise<TreeNodeItem> {
        const splitted = path.split('/');
        let hit = null;
        let toScan = this.shares;
        for (let i = 1; i < splitted.length; i++) {
            hit = toScan.find(f => {
                return f.label === splitted[i];
            });
            console.log('undefined node in localTraverse for path ' + path);
            await this.loadChildrenByNode(hit);
            toScan = hit.children;
        }
        return hit;
    }

    private makeBreadCrumbs(node: TreeNodeItem) {
        const falschRum: TreeNodeItem[] = [];
        this.buildBreadcrumb(node, falschRum);
        this.breadcrumb = falschRum.reverse();
    }

    private buildBreadcrumb(node: TreeNodeItem, container: TreeNodeItem[]) {
        container.push(node);
        if (node.parent !== undefined && node.parent !== null) {
            this.buildBreadcrumb(node.parent, container);
        }

    }

    private createShareStub(name: string): TreeNodeItem {
        return {
            pointer: null,
            publishedToChain: false,
            iconOwned: SharuIcons.desynced,
            iconLocation: SharuIcons.localShare,
            label: name,
            root: true,
            hash: null,
            leaf: false,
            owned: true,
            parent: null,
            localPath: '/' + name,
            resolved: false,
            local: true,
            icon: SharuIcons.desynced,
            hashBufferSemaphore: new Semaphore(1),
            shareSettingsSemapohore: new Semaphore(1),
            verifyFileSemaphore: new Semaphore(1),
        };
    }

    public async createShare(name: string) {
        const created = this.createShareStub(name);
        this.shares.push(created);
        await this.file.createShare(name, created);
    }

    public async deleteShare(item: TreeNodeItem) {
        console.log(`removing item ${item.label}`);
        await this.file.deleteFile(item);
        this.shares = this.shares.filter(share => share !== item);
        if ((this.breadcrumb) && this.breadcrumb.length > 0 && this.breadcrumb[0] === item) {
            console.log('we are currently showing stuff from the deleted node, reroute');
            this.router.navigate(['']);
        }

    }

    public async loadDetailsForShare(node: TreeNodeItem) {
        this.shareOwner.set(node, null);
        this.shareReceivers.set(node, []);
        const keyowners = await this.file.getKeyChain(node);
        this.shareOwner.set(node, keyowners.getOwner());
        this.shareReceivers.set(node, keyowners.getReceivers());
        this.newReceiversCalculated.next(node);
    }

    /**
     * @throws ShareNotKnownInSharu ReceiverUnknownInSharuError ShareAlreadySentToReceiverError ShareWithYourselfError
     * @param share
     * @param receiver
     */
    public async shareWith(share: TreeNodeItem, receiver: string | Contact) {
        if (typeof receiver !== 'string') {
            receiver = receiver.wallet;
        }
        if (receiver === this.eth.getAddress()) {
            throw new ShareWithYourselfError();
        }
        const oldHash = share.hash;
        console.log('sharing ' + share.label + ' with ' + receiver);

        await this.file.shareWith(share, receiver);
        await this.downwardsHashUpdate(share);

        await this.eth.shareContract.updateHash(share.pointer, oldHash, share.hash);
        await this.eth.shareContract.invite(share.pointer, receiver);

        this.shareReceivers.get(share).push(receiver);
        this.newReceiversCalculated.next(share);

    }

    public async revokeShare(share: TreeNodeItem, receiver: string) {
        console.error('TODO: please add some sanitychecks here');
        const oldHash = share.hash;

        await this.file.revokeShare(share, receiver);
        await this.downwardsHashUpdate(share);

        await this.eth.shareContract.updateHash(share.pointer, oldHash, share.hash);

        this.shareReceivers.set(share, this.shareReceivers.get(share).filter(f => f !== receiver));
        this.newReceiversCalculated.next(share);
    }

    public async createFolder(subDir: string, parent: TreeNodeItem): Promise<void> {
        const topNode = this.file.getTopNode(parent);
        const oldhash = topNode.hash;
        const newContent = await this.file.createFolder(subDir, parent);
        SharuIcons.updateIcons(newContent);
        parent.children = newContent;
        this.children = parent.children;
        await this.downwardsHashUpdate(parent);

        await this.eth.shareContract.updateHash(topNode.pointer, oldhash, topNode.hash);
    }

    public async deleteFile(item: TreeNodeItem): Promise<void> {
        const topNode = this.file.getTopNode(item);
        const oldHash = topNode.hash;

        item.parent.children = await this.file.deleteFile(item);
        SharuIcons.updateIcons(item.parent.children);
        this.children = item.parent.children;
        await this.downwardsHashUpdate(item.parent);

        await this.eth.shareContract.updateHash(topNode.pointer, oldHash, topNode.hash);
    }

    public async uploadStreamed(node: TreeNodeItem, filePaths: string[]) {
        if (filePaths === undefined) {
            return;
        }
        const promises: Promise<void>[] = [];
        const jobs: UploadStreamedJob[] = [];
        let anyFileUploaded = false;
        const topNode = this.file.getTopNode(node);
        const oldHash = topNode.hash;
        for (const filePath of filePaths) {
            const fileName = basename(filePath);
            if (this.isFileTooBig(filePath)) {
                this.toast.notify(
                    'error',
                    `file ${fileName} is too big`,
                    `you cannot upload a file bigger than ${this.MAX_UPLOAD_SIZE_IN_MB}MB`);
            } else if (this.isFileNameAlreadyInFolder(node, fileName)) {
                this.toast.notify(
                    'warn',
                    `duplicate file ${fileName}`,
                    'you cannot upload the same file again. if you want to overwrite, delete the unwanted version first');
            } else {
                const newJob = new UploadStreamedJob(fileName, filePath, node, this.file);
                jobs.push(newJob);
                promises.push(this.jobs.push(newJob));
                anyFileUploaded = true;
            }
        }
        if (anyFileUploaded) {
            await Promise.all(promises);
            console.log('all uploads done');
            await this.downwardsHashUpdate(node);
            await this.eth.shareContract.updateHash(topNode.pointer, oldHash, topNode.hash);
        }
    }

    private isFileTooBig(fileName: string): boolean {
        const maxSize = this.MAX_UPLOAD_SIZE_IN_MB * 1000 * 1000;
        if (this.file.getFileSize(fileName) > maxSize) {
            console.log('file is too big!');
            return true;
        }
        return false;
    }

    public async upload(node: TreeNodeItem, files: File[]) {
        const promises: Promise<void>[] = [];
        const jobs: UploadJob[] = [];
        let anyFileUploaded = false;
        const topNode = this.file.getTopNode(node);
        const oldHash = topNode.hash;
        for (const file of files) {
            if (this.isFileAlreadyInFolder(node, file)) {
                this.toast.notify(
                    'warn',
                    `duplicate file ${file}`,
                    'you cannot upload the same file again. if you want to overwrite, delete the unwanted version first'
                );
            } else {
                const newJob = new UploadJob(file, node, this.file);
                jobs.push(newJob);
                promises.push(this.jobs.push(newJob));
                anyFileUploaded = true;
            }
        }

        if (anyFileUploaded) {
            await Promise.all(promises);
            console.log('all uploads done');
            await this.downwardsHashUpdate(node);
            await this.eth.shareContract.updateHash(topNode.pointer, oldHash, topNode.hash);
        }
    }

    public async downwardsHashUpdate(node: TreeNodeItem): Promise<void> {
        let worker = node;
        let oldShareHash, newShareHash: string;
        while ((worker)) {
            const oldHash = worker.hash;
            worker.hash = await this.file.recalcHash(worker);
            if (!(worker.parent)) {
                oldShareHash = oldHash;
                newShareHash = worker.hash;
            }
            worker = worker.parent;
        }

        // if we have the oldhash in the browserURL we can safely replace it with the newhash
        const currentUrl = this.location.path(true);
        if (currentUrl.includes(oldShareHash)) {
            this.location.replaceState(currentUrl.replace(oldShareHash, newShareHash));
        }
    }

    private async traverse(directory: TreeNodeItem[], hash: string): Promise<TreeNodeItem> {
        if (directory !== null && directory !== undefined) {
            const inDir = directory.find(f => f.hash === hash);
            if (inDir !== undefined && inDir !== null) {
                return inDir;
            }
            for (const d of directory.filter(f => !f.leaf)) {
                if (!d) {
                    console.log('undefined d in traverse for ' + hash);
                }
                await this.loadChildrenByNode(d);
                if (d.children !== null && d.children !== undefined) {
                    const sub = await this.traverse(d.children.filter(s => !s.leaf), hash);
                    if (sub) {
                        return sub;
                    }
                }
            }
        }
        return null;
    }

    private isFileAlreadyInFolder(node: TreeNodeItem, file: File): boolean {
        for (const child of node.children) {
            if (child.label === file.name) {
                return true;
            }
        }
        return false;
    }

    private isFileNameAlreadyInFolder(node: TreeNodeItem, fileName: string): boolean {
        for (const child of node.children) {
            if (child.label === fileName) {
                return true;
            }
        }
        return false;
    }
}
