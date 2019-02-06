import { Injectable } from '@angular/core';
import { Wallet, providers, ethers, } from 'ethers';
import { LocalStorageService } from 'angular-2-local-storage';
import { BehaviorSubject } from 'rxjs';
import { AppConfig } from '../../environments/environment';
import { BlockService } from './block.service';
import { JsonRpcProvider } from 'ethers/providers';
import { EthShareService } from './ethShare.service';
import { EthSingleFilesService } from './ethSingleFiles.service';
import { ToastService } from './toast.service';

@Injectable({
    providedIn: 'root'
})
export class EthWalletService {
    private initialized = new BehaviorSubject<boolean>(false);
    private LOCAL_STORAGE_KEY = 'encryptedJsonWallet';
    private wallet: Wallet;
    private provider: JsonRpcProvider;
    public shareContract: EthShareService;
    public singleFileContract: EthSingleFilesService;

    constructor(private localStorageService: LocalStorageService, private bs: BlockService, private toast: ToastService) {
        const randomIndex = Math.floor(Math.random() * AppConfig.blockchainRpcEndpoint.length);
        const blockChainHost = AppConfig.blockchainRpcEndpoint[randomIndex];
        if (AppConfig.blockchainPass === null && AppConfig.blockchainUser === null) {
            this.provider = new providers.JsonRpcProvider(blockChainHost);
        } else {
            this.provider = new providers.JsonRpcProvider({
                url: blockChainHost,
                user: AppConfig.blockchainUser,
                password: AppConfig.blockchainPass
            });
        }
    }

    public subject() {
        return this.initialized;
    }

    public walletAvailable() {
        return this.localStorageService.get(this.LOCAL_STORAGE_KEY) !== null;
    }

    public getAddress() {
        return this.wallet.address;
    }

    public isWalletCreated() {
        return (this.wallet);
    }

    public getPrivateKey() {
        return this.wallet.privateKey;
    }

    public async unlockWallet(password: string): Promise<boolean> {
        this.bs.set(true);
        const encryptedJsonWallet = this.localStorageService.get(this.LOCAL_STORAGE_KEY) as string;
        try {
            const w = await Wallet.fromEncryptedJson(encryptedJsonWallet, password);
            this.wallet = w.connect(this.provider);
            this.updateContract();
            this.bs.set(false);
            this.initialized.next(true);
            return true;
        } catch (error) {
            this.bs.set(false);
            console.error('wrong password');
            return false;
        }
    }

    public async createWallet(password: string, mnemonic?: string) {
        this.bs.set(true);
        let wallet: Wallet;
        if (mnemonic) {
            try {
                wallet = Wallet.fromMnemonic(mnemonic);
            } catch (error) {
                this.bs.set(false);
                console.error(`cannot restore wallet with mnemonic <${mnemonic}>`);
                return;
            }
        } else {
            wallet = Wallet.createRandom();
        }
        this.wallet = wallet.connect(this.provider);
        const encryptedJsonWallet = await this.wallet.encrypt(password);
        this.localStorageService.add(this.LOCAL_STORAGE_KEY, encryptedJsonWallet);
        this.updateContract();
        this.bs.set(false);
        this.initialized.next(true);
    }

    /**
     *
     * @param password for unlocking the wallet. no correct password -> no mnemonic
     */
    public async getMnemonic(password: string): Promise<string> {
        const w = await Wallet.fromEncryptedJson(this.localStorageService.get(this.LOCAL_STORAGE_KEY) as string, password);
        return w.mnemonic;
    }

    public async sign(content: string): Promise<string> {
        const signed = await this.wallet.signMessage(content);
        console.log('unsigned: ' + content);
        console.log('signed: ' + signed);
        return signed;
    }

    public checkSign(raw: string, signed: string, wallet: string): boolean {
        const signer = ethers.utils.verifyMessage(raw, signed);
        return (signer === wallet);
    }

    public getWalletConnection(): string {
        return this.provider.connection.url;
    }

    private async updateContract() {
        this.shareContract = new EthShareService(this.wallet);
        this.singleFileContract = new EthSingleFilesService(this.wallet);
    }
}
