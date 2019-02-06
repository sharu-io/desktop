import { Component, OnInit } from '@angular/core';
import { EthWalletService } from '../../service/ethWallet.service';
import { MatSnackBar } from '@angular/material';
import { FormControl } from '@angular/forms';

@Component({
  selector: 'show-mnemonic',
  templateUrl: './show-mnemonic.component.html',
  styleUrls: ['./show-mnemonic.component.scss']
})
export class ShowMnemonicComponent implements OnInit {

  constructor(
    public eth: EthWalletService
  ) {
  }

  mnemonic: string;
  password = new FormControl();

  ngOnInit() {
  }

  async revealMnemonic() {
    try {
      this.mnemonic = await this.eth.getMnemonic(this.password.value);
    } catch (e) {

    }

  }

  copyPubkeyToClipboard() {
    const selBox = document.createElement('textarea');
    selBox.style.position = 'fixed';
    selBox.style.left = '0';
    selBox.style.top = '0';
    selBox.style.opacity = '0';
    selBox.value = this.eth.getAddress();
    document.body.appendChild(selBox);
    selBox.focus();
    selBox.select();
    document.execCommand('copy');
    document.body.removeChild(selBox);
  }
}
