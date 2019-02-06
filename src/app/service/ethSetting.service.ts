import Semaphore from 'semaphore-async-await';
import { Wallet, Contract } from 'ethers';
import { AppConfig } from '../../environments/environment';
import { Transaction } from 'ethers/utils';

const tokenAbi = require('../../contracts/Settings.json');

export class EthSettingService {
    public contract: Contract;
    private CONTRACT_ADDRESS = tokenAbi.networks[AppConfig.networkId].address;
    private CONTRACT_ABI = tokenAbi.abi;
    private mutex = new Semaphore(1);

    constructor(private wallet: Wallet) {
        this.contract = new Contract(this.CONTRACT_ADDRESS, this.CONTRACT_ABI, wallet);
    }

    public async getHash(): Promise<string> {
        console.log('[settings-view]: getHash()');
        return await this.contract.getHash();
    }

    public async setHash(newHash: string): Promise<Transaction> {
        return await this.mutex.execute(async () => {
            console.log(`[settings-view]: setHash(${newHash})`);
            return this.contract.setHash(newHash);
        });
    }
}
