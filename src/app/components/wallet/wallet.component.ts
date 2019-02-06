import { Component, OnInit } from '@angular/core';
import { EthWalletService } from '../../service/ethWallet.service';
import { AppConfig } from '../../../environments/environment';
import { FormControl } from '@angular/forms';
import { githash } from '../../util/gitversion';

enum Mode {
  view,
  generate,
  restore,
  unlock,
}

@Component({
  selector: 'wallet',
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.css']
})
export class WalletComponent implements OnInit {
  public walletAvailable: boolean;
  public walletAddress: string;
  public modes = Mode;
  public mode: Mode;
  public errorStatus: string = null;
  public password = new FormControl();
  public mnemonic = new FormControl();

  public readonly gitHash;
  constructor(
    private ethWalletService: EthWalletService,
  ) {
    this.gitHash = githash;
    this.walletAvailable = this.ethWalletService.walletAvailable();
    this.mode = Mode.view;
  }

  async ngOnInit() {
    if (AppConfig.devKey) {
      await this.unlockWallet(AppConfig.devKey);
    }
    const https = require('https');
    https.get(this.ethWalletService.getWalletConnection(), (resp) => {
      if (resp.statusCode === 401 || resp.statusCode === 200) {
        // all fine!
      } else {
        this.errorStatus = 'teh blockchain is borken! or your internetz! please come back later!';
      }
    }).on('error', (err) => {
      this.errorStatus = 'teh blockchain is borken! or your internetz! please come back later!';
    });
  }

  public isPasswordSet(): boolean {
    return (this.password.value) && (this.password.value.length > 0);
  }

  async unlockWallet(password: string) {
    const success = await this.ethWalletService.unlockWallet(password);
    if (success) {
      this.walletAddress = this.ethWalletService.getAddress();
      console.log('your wallet: ' + this.walletAddress);
    } else {
      this.mode = this.modes.view;
      this.errorStatus = 'Wrong password!';
    }
  }

  async createNewWallet(password: string) {
    await this.ethWalletService.createWallet(password);
  }

  async restoreWalletFromMnemonic(password: string, mnemonic: string) {
    await this.ethWalletService.createWallet(password, mnemonic);
    if (this.ethWalletService.isWalletCreated()) {
      this.walletAddress = this.ethWalletService.getAddress();
    } else {
      this.errorStatus = 'Could not restore wallet';
    }
  }
}
