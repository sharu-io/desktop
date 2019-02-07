import { TreeNode } from 'primeng/api';
import { SharuIcon, SharuIcons } from './icon.model';
import Semaphore from 'semaphore-async-await';
import { FileService } from '../service/file.service';
import { ToastService } from '../service/toast.service';
import { NoShareSettingsError } from '../service/errors/NoShareSettings.error';
import { EthWalletService } from '../service/ethWallet.service';
import { BigNumber } from 'ethers/utils';

export interface TreeNodeItem extends TreeNode {
    // incoming from TreeNode
    label?: string;
    data?: any;
    // icon?: any; <-- overwritten down the file ;)
    shareDescription?: string;
    expandedIcon?: any;
    collapsedIcon?: any;
    children?: TreeNodeItem[];
    leaf?: boolean;
    expanded?: boolean;
    type?: string;
    parent?: TreeNodeItem;
    partialSelected?: boolean;
    styleClass?: string;
    draggable?: boolean;
    droppable?: boolean;
    selectable?: boolean;

    // custom attributes
    hash: string;
    publishedToChain: boolean;
    pointer?: BigNumber;
    owned: boolean;
    // parentHash?: string;
    root?: boolean;

    // the absolute path in ipfs (local)
    localPath?: string;

    // just for top-level-nodes
    local?: boolean;

    // only on sharelevel: promise for finding a corresponding entry
    // in the local ipfs
    localMatch?: Promise<boolean>;
    // only on sharelevel: has this been successfully resolved yet? (undefined: still trying, false: nope, unreachable, true: go ahead)
    resolved?: boolean;
    // only on sharelevel: shall we pin this locally?
    pinned?: boolean;

    // just for total brickage
    desynced?: boolean;

    // icon
    icon?: SharuIcon;
    iconOwned?: SharuIcon;
    iconLocation?: SharuIcon;

    // semaphore for hashbuffer - only relevant on sharelevel
    hashBufferSemaphore?: Semaphore;
    // semaphore for share-settings - only relevant on sharelevel
    shareSettingsSemapohore?: Semaphore;
    // semaphore for verifyFile - relevant for all directorys
    verifyFileSemaphore?: Semaphore;
}

export class MaybeLocalTreeNodeItem implements TreeNodeItem {
    constructor(
        private rootDirs: TreeNodeItem[],
        private file: FileService,
        private toast: ToastService,
        private eth: EthWalletService,
    ) { }
    // incoming from TreeNode
    label?: string;
    data?: any;
    // icon?: any; <-- overwritten down the file ;)
    shareDescription?: string;
    expandedIcon?: any;
    collapsedIcon?: any;
    children?: TreeNodeItem[];
    leaf?: boolean;
    expanded?: boolean;
    type?: string;
    parent?: TreeNodeItem;
    partialSelected?: boolean;
    styleClass?: string;
    draggable?: boolean;
    droppable?: boolean;
    selectable?: boolean;

    // custom attributes
    hash: string;
    publishedToChain: boolean;
    pointer?: BigNumber;
    owned: boolean;
    // parentHash?: string;
    root?: boolean;

    // the absolute path in ipfs (local)
    localPath?: string;

    // just for top-level-nodes
    local?: boolean;
    // only on sharelevel: promise for finding a corresponding entry
    // in the local ipfs
    localMatch?: Promise<boolean>;
    resolved?: boolean;
    pinned?: boolean;

    // just for total brickage
    desynced?: boolean;

    // icon
    icon?: SharuIcon;
    iconOwned?: SharuIcon;
    iconLocation?: SharuIcon;

    // semaphore for hashbuffer - only relevant on sharelevel
    hashBufferSemaphore?: Semaphore;
    // semaphore for share-settings - only relevant on sharelevel
    shareSettingsSemapohore?: Semaphore;
    // semaphore for verifyFile - relevant for all directorys
    verifyFileSemaphore?: Semaphore;

    async lookForLocal(): Promise<boolean> {
        if (this.localMatch === undefined) {
            this.localMatch = new Promise<boolean>(async (resolve, reject) => {
                // happy path: we find a local Dir with the same hash as the item hash
                const localDir = this.rootDirs.find(d => d.hash === this.hash);
                if (localDir) {
                    try {
                        const shareName = await this.file.getShareName(localDir);
                        this.label = shareName;
                        this.iconLocation = SharuIcons.localShare;
                        this.localPath = localDir.localPath;
                        this.local = true;
                        this.resolved = true;
                    } catch (e) {
                        if (e instanceof NoShareSettingsError) {
                            this.toast.notify('error', 'no sharesettings found for ' + e.dir, '');
                        } else {
                            this.toast.notifySticky('error', 'aaaargg...', e.message);
                        }
                        this.resolved = false;
                    }
                    resolve(true);
                    return;
                }

                for (const ld of this.rootDirs) {
                    const localRingBuffer = await this.file.getHashRingBuffer(ld);
                    const localHit = localRingBuffer.hashPreviouslyUsed(this.hash);
                    if (localHit) {
                        // we found a local directory with the hash from the chain
                        // -> we are obviously ahead!
                        const oldHash = this.hash;
                        this.hash = ld.hash;
                        this.label = await this.file.getShareName(ld);
                        this.iconLocation = SharuIcons.localShare;
                        this.localPath = ld.localPath;
                        this.local = true;
                        this.resolved = true;
                        this.toast.notify('info', 'we are locally ahead', '...and synchronize the local state to the chain');
                        await this.eth.shareContract.updateHash(this.pointer, oldHash, ld.hash);
                        resolve(true);
                        return;
                    }
                }

                // if we are here we neither found a perfect hit nor did we find a scenario where we were locally ahead
                // so, we need to check for an outdated local state
                const remoteRingBuffer = await this.file.getHashRingBuffer(this);
                for (const ld of this.rootDirs) {
                    const remoteHit = remoteRingBuffer.hashPreviouslyUsed(ld.hash);
                    if (remoteHit) {
                        // remote share is ahead of local share
                        this.toast.notify(
                            'warn',
                            'remote share is ahead of local for ' + ld.label,
                            'we do not care at this stage of implementation, come back later ;-)'
                        );
                        resolve(false);
                        return;
                    }
                }

                // so we have a share with no local trace!
                this.local = false;
                this.iconLocation = SharuIcons.remoteShare;
                this.localPath = null;
                this.local = false;
                this.label = await this.file.getShareName(this);
                this.resolved = true;
                resolve(false);

            });
        }
        return this.localMatch;
    }
}
