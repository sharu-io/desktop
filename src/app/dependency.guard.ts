import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { EthWalletService } from './service/ethWallet.service';
import { CryptoService } from './service/crypto.service';
import { ShareService } from './service/share.service';
import { SharuSettingsService } from './service/sharusettings.service';
import { InviteService } from './service/invite.service';
import { ContactService } from './service/contact.service';

@Injectable({
    providedIn: 'root',
})
export class DependencyGuard implements CanActivate {
    constructor(private cs: CryptoService,
        private ss: ShareService,
        private settings: SharuSettingsService,
        private invites: InviteService,
        private contacts: ContactService,
        private ethWalletService: EthWalletService) { }

    async canActivate(): Promise<boolean> {

        return new Promise<boolean>((resolve, reject) => {
            this.ethWalletService.subject().subscribe(async b => {
                if (b) {
                    await this.cs.init();
                    await this.settings.init();
                    await this.invites.init();
                    await this.contacts.init();
                    await this.ss.loadShares();

                    resolve(true);
                }
            });
        });
    }
}
