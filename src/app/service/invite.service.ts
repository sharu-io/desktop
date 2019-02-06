import { Injectable } from '@angular/core';
import { SharuSettingsService } from './sharusettings.service';
import { ToastService } from './toast.service';
import { EthWalletService } from './ethWallet.service';
import { FileService } from './file.service';
import { SharuShare } from '../model/sharuShares.models';
import { BigNumber } from 'ethers/utils';
import { utils } from 'ethers';

@Injectable({
    providedIn: 'root'
})
export class InviteService {
    openInvites: BigNumber[];
    dismissedInvites: BigNumber[];
    pointerNames = new Map<number, string>();
    pointerHashes = new Map<number, string>();
    private initProm: Promise<void>;

    constructor(
        public ethwalletService: EthWalletService,
        private sharuSettings: SharuSettingsService,
        private file: FileService,
        private toast: ToastService
    ) {
        sharuSettings.topic.subscribe(async b => {
            if (b) {
                await this.init(true);
            }
        });

        ethwalletService.subject().subscribe(inited => {
            if (inited) {
                ethwalletService.shareContract.invites().subscribe(invite => {
                    if (!(this.openInvites.includes(invite.pointer))) {
                        this.openInvites.push(invite.pointer);

                        this.toast.notify('info', 'asdf', '', 'invite', { pointer: invite.pointer, sender: invite.sender });
                        this.fetchDetails();
                    }
                });
            }
        });
    }

    public async init(force?: boolean): Promise<void> {
        if (force) {
            this.initProm = undefined;
        }
        if (this.initProm !== undefined) {
            return this.initProm;
        }
        this.initProm = new Promise(async (resolve, reject) => {
            const inContract = await this.ethwalletService.shareContract.getMyInvites();
            const inSettings = this.sharuSettings.settings.invites.map(i => utils.bigNumberify(i.pointerAsHex));
            this.openInvites = inContract.filter(f => {
                for (const p of inSettings) {
                    if (p.eq(f)) {
                        return false;
                    }
                }
                return true;
            });
            this.dismissedInvites = this.sharuSettings.settings.invites.filter(i => i.accepted === false)
                .map(i => utils.bigNumberify(i.pointerAsHex));
            await this.fetchDetails();

            resolve();
        });
        return this.initProm;
    }

    public async processInvite(pointer: BigNumber, accepted: boolean) {
        const pointerAsHex = pointer.toHexString();
        this.sharuSettings.settings.invites = this.sharuSettings.settings.invites.filter(i => i.pointerAsHex !== pointerAsHex);
        this.sharuSettings.settings.invites.push({ pointerAsHex, accepted, pinned: true });
        // this.sharuSettings.settings.invites.push({ pointerAsHex, accepted });
        this.sharuSettings.sync();
        this.openInvites = this.openInvites.filter(f => !f.eq(pointer));
        if (!accepted) {
            this.dismissedInvites.push(pointer);
        } else {
            this.dismissedInvites = this.dismissedInvites.filter(di => !di.eq(pointer));
        }
    }

    public async dismissInvite(pointer: BigNumber) {
        const pointerAsHex = pointer.toHexString();
        this.sharuSettings.settings.invites = this.sharuSettings.settings.invites.filter(i => i.pointerAsHex !== pointerAsHex);
        this.sharuSettings.sync();
        this.openInvites.push(pointer);
        this.fetchDetails();
    }

    public async fetchDetails(): Promise<void> {
        const interesting = this.openInvites.concat(this.dismissedInvites);
        if (interesting && interesting.length > 0) {
            const details = await this.ethwalletService.shareContract.getShareDetails(this.openInvites.concat(this.dismissedInvites));
            for (const d of details) {
                if (!(this.pointerHashes.get(d.pointer.toNumber()))) {
                    this.pointerHashes[d.pointer.toNumber()] = d.hash;
                    this.fetchNames(d);
                }
            }
        }
    }

    private async fetchNames(share: SharuShare): Promise<void> {
        const name = await this.file.getShareName({ hash: share.hash, publishedToChain: true, owned: false });
        this.pointerNames[share.pointer.toNumber()] = name;
    }
}
