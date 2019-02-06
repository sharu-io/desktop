import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { EthWalletService } from './service/ethWallet.service';

@Injectable({
    providedIn: 'root',
})
export class WalletGuard implements CanActivate {
    constructor(private ethWalletService: EthWalletService) { }

    canActivate(): Observable<boolean> {
        return this.ethWalletService.subject().asObservable().pipe(filter(b => b === true));
    }
}
