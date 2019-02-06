import { Component, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { ElectronService } from './service/electron.service';
import { AppConfig } from '../environments/environment';
import { BlockService } from './service/block.service';
import { EthWalletService } from './service/ethWallet.service';
import { LicenceService } from './service/licence.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewChecked  {
    public walletInitialized = false;
    public blocked = false;
    public displayWalletDialog = false;
    public licenseStatus = false;

    constructor(
        public electronService: ElectronService,
        private licence: LicenceService,
        private bs: BlockService,
        private ws: EthWalletService,
        private cd: ChangeDetectorRef) {

        console.log('AppConfig', AppConfig);
        if (electronService.isElectron()) {
            console.log('Mode electron');
            console.log('Electron ipcRenderer', electronService.ipcRenderer);
            console.log('NodeJS childProcess', electronService.childProcess);
        } else {
            console.log('Mode web');
        }
    }

    ngAfterViewChecked () {
        this.ws.subject().subscribe(i => {
            this.walletInitialized = i;
        });
        this.bs.subject().subscribe(b => {
            this.blocked = b;
        });

        this.licence.status().subscribe(b => {
            this.licenseStatus = b;
        });

        this.cd.detectChanges();
    }
}
