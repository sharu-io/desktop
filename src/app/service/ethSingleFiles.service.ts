import { AppConfig } from '../../environments/environment';
import Semaphore from 'semaphore-async-await';
import { Wallet, Contract } from 'ethers';
import { Transaction } from 'ethers/utils';
import { Subject } from 'rxjs';
import { mutexify } from '../util/mutex';

const tokenAbi = require('../../contracts/SingleFiles.json');

export class EthSingleFilesService {
    public contract: Contract;
    private CONTRACT_ADDRESS = tokenAbi.networks[AppConfig.networkId].address;
    private CONTRACT_ABI = tokenAbi.abi;
    private mutex = new Semaphore(1);

    public settingsAssignedSubject: Subject<SettingsAssigned> = new Subject<SettingsAssigned>();
    public settingsOfOthersAssignedSubject: Subject<SettingsAssigned> = new Subject<SettingsAssigned>();
    public keyAssignedSubject: Subject<{ owner: string, hash: string }> = new Subject<{ owner: string, hash: string }>();
    private lastHashOfSettings = '';

    constructor(private wallet: Wallet) {
        this.contract = new Contract(this.CONTRACT_ADDRESS, this.CONTRACT_ABI, this.wallet);

        this.contract.on('SettingsAssigned', (owner: string, oldHash: string, newHash: string) => {
            console.log(`[Blockchain] got event SettingsAssigned with payload ${owner}, ${oldHash}, ${newHash}`);
            if (owner === this.wallet.address) {
                if (newHash !== this.lastHashOfSettings) {
                    this.lastHashOfSettings = newHash;
                    this.settingsAssignedSubject.next({ oldHash, newHash });
                } else {
                    console.log('...relevant for us, but we have this info already');
                }
            } else {
                console.log('... not our settings, but we relay it');
                this.settingsOfOthersAssignedSubject.next({ oldHash, newHash });
            }
        });

        this.contract.on('KeyAssigned', (owner: string, hash: string) => {
            console.log(`[Blochchain] got event KeyAssigned with payload ${owner}, ${hash}`);
            this.keyAssignedSubject.next({ owner, hash });
        });
    }

    public async setPubKeyHash(pubKeyHash: string): Promise<Transaction> {
        return await this.mutexify('setPubKeyHash', async () => {
            return await this.contract.setPubKeyHash(pubKeyHash);
        });
    }

    public async getPubKeyHashFor(wallet: string): Promise<string> {
        this.logContract(`getPubKeyHashFor(${wallet})`);
        return this.contract.getPubKeyHashFor(wallet);
    }

    public async getMyPubKeyHash(): Promise<string> {
        this.logContract(`getMyPubKeyHash()`);
        return this.contract.getMyPubKeyHash();
    }

    public async setSettingsHash(newHash: string): Promise<Transaction> {
        this.lastHashOfSettings = newHash;
        return await this.mutexify('setSettings', async () => {
            return await this.contract.setSettingsHash(newHash);
        });
    }

    public async getSettingsHash(): Promise<string> {
        this.logContract('getSettingsHash()');
        return this.contract.getSettingsHash();
    }

    private async mutexify(label: string, func) {
        return await mutexify(this.mutex, 'singles-contract', label, func);
    }

    private logContract(log: string) {
        console.log(`[singlefile-contract-read]: ${log}`);
    }
}

export interface SettingsAssigned {
    oldHash: string;
    newHash: string;
}
