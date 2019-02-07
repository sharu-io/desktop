import { AppConfig } from '../../environments/environment';
import Semaphore from 'semaphore-async-await';
import { Wallet, Contract } from 'ethers';
import { Transaction, BigNumber } from 'ethers/utils';
import { SharuShare } from '../model/sharuShares.models';
import { Subject } from 'rxjs';
import { mutexify } from '../util/mutex';

const tokenAbi = require('../../contracts/Shares.json');

export class EthShareService {
    public contract: Contract;
    private CONTRACT_ADDRESS = tokenAbi.networks[AppConfig.networkId].address;
    private CONTRACT_ABI = tokenAbi.abi;
    private mutex = new Semaphore(1);
    private hashUpdateSubject: Subject<HashUpdate> = new Subject<HashUpdate>();
    private invitesSubject: Subject<NewInvite> = new Subject<NewInvite>();

    public invites(): Subject<NewInvite> {
        return this.invitesSubject;
    }

    public hashUpdates(): Subject<HashUpdate> {
        return this.hashUpdateSubject;
    }

    constructor(private wallet: Wallet) {
        this.contract = new Contract(this.CONTRACT_ADDRESS, this.CONTRACT_ABI, this.wallet);

        this.contract.on('NewInvite', async (pointer: BigNumber, receiver: string, sender: string) => {
            console.log(`[Blockchain] got event NewInvite with payload ${pointer}, ${receiver}, ${sender}`);
            if (receiver === this.wallet.address) {
                this.invitesSubject.next({ pointer, sender });
            }
        });

        this.contract.on('Updated', async (pointer: BigNumber, oldHash: string, newHash: string, sender: string) => {
            console.log(`[Blockchain] got event HashUpdate with payload ${pointer}, ${oldHash}, ${newHash}, ${sender}`);
            this.hashUpdateSubject.next({ pointer, oldHash, newHash, sender });
        });
    }

    public async createShare(hash: string): Promise<BigNumber> {
        return await this.mutexify('createShare', async () => {
            const transaction = await this.contract.createShare(hash);
            console.log(`createShare() - waiting for receipt`);
            const receipt = await transaction.wait();
            console.log(`createShare() - got receipt`);
            return receipt.events[0].args._pointer;
        });
    }

    public async removeShare(pointer: BigNumber): Promise<Transaction> {
        return await this.mutexify('removeShare', async () => {
            return await this.contract.removeShare(pointer);
        });
    }

    public async updateHash(pointer: BigNumber, oldHash: string, newHash: string): Promise<void> {
        return await this.mutexify('updateHash', async () => {
            await (await this.contract.updateHash(pointer, oldHash, newHash)).wait();
        });
    }

    public async addAuthor(pointer: BigNumber, author: string): Promise<Transaction> {
        return await this.mutexify('addAuthor', async () => {
            return await this.contract.addAuthor(pointer, author);
        });
    }

    public async removeAuthor(pointer: BigNumber, author: string): Promise<Transaction> {
        return await this.mutexify('removeAuthor', async () => {
            return await this.contract.removeAuthor(pointer, author);
        });
    }

    public async getAuthorsForShare(pointer: BigNumber): Promise<string[]> {
        this.logContract(`getAuthorsForShare(${pointer})`);
        return await this.contract.getAuthorsForShare(pointer);
    }

    public async getMySentShares(): Promise<SharuShare[]> {
        const pointers = await this.getMySharePointers();
        return await this.recursiveDetails(pointers, []);
    }

    public async getMySharePointers(): Promise<BigNumber[]> {
        this.logContract(`getMySharePointers()`);
        return await this.contract.getMySharePointers();
    }

    public async getShareDetails(pointers: BigNumber[]): Promise<SharuShare[]> {
        if (pointers && pointers.length > 0) {
            return await this.mutexify('getShareDetails', async () => {
                const details = await this.recursiveDetails(pointers, []);
                return details;
            });
        } else {
            console.log('getShareDetails() was called with zero parameters?');
            return [];
        }
    }

    private async recursiveDetails(pointers: BigNumber[], sharuShares: SharuShare[]): Promise<SharuShare[]> {
        let remaining = 0;
        if (pointers) {
            remaining = pointers.length;
        }
        if (remaining === 0) {
            return sharuShares;
        }
        this.logContract(`recursiveDetails(${pointers.length})`);

        switch (pointers.length) {
            case 1: {
                const hash = await this.contract.getHash(pointers[0]);
                sharuShares.push({ pointer: pointers[0], hash: hash });
                return sharuShares;
            }
            case 2: {
                const inContract: any = await this.contract.getHashForTwo(pointers[0],
                    pointers[1]);
                sharuShares.push({ pointer: pointers[0], hash: inContract.hash1 });
                sharuShares.push({ pointer: pointers[1], hash: inContract.hash2 });
                return sharuShares;
            }
            case 3: {
                const inContract: any = await this.contract.getHashForThree(pointers[0],
                    pointers[1],
                    pointers[2]);
                sharuShares.push({ pointer: pointers[0], hash: inContract.hash1 });
                sharuShares.push({ pointer: pointers[1], hash: inContract.hash2 });
                sharuShares.push({ pointer: pointers[2], hash: inContract.hash3 });
                return sharuShares;
            }
            case 4: {
                const inContract: any = await this.contract.getHashForFour(
                    pointers[0],
                    pointers[1],
                    pointers[2],
                    pointers[3]);
                sharuShares.push({ pointer: pointers[0], hash: inContract.hash1 });
                sharuShares.push({ pointer: pointers[1], hash: inContract.hash2 });
                sharuShares.push({ pointer: pointers[2], hash: inContract.hash3 });
                sharuShares.push({ pointer: pointers[3], hash: inContract.hash4 });

                return sharuShares;
            }
            case 5: {
                const inContract: any = await this.contract.getHashForFive(
                    pointers[0],
                    pointers[1],
                    pointers[2],
                    pointers[3],
                    pointers[4]);
                sharuShares.push({ pointer: pointers[0], hash: inContract.hash1 });
                sharuShares.push({ pointer: pointers[1], hash: inContract.hash2 });
                sharuShares.push({ pointer: pointers[2], hash: inContract.hash3 });
                sharuShares.push({ pointer: pointers[3], hash: inContract.hash4 });
                sharuShares.push({ pointer: pointers[4], hash: inContract.hash5 });

                return sharuShares;
            }
            default: {
                const inContract: any = await this.contract.getHashForSix(
                    pointers[0],
                    pointers[1],
                    pointers[2],
                    pointers[3],
                    pointers[4],
                    pointers[5]);
                sharuShares.push({ pointer: pointers[0], hash: inContract.hash1 });
                sharuShares.push({ pointer: pointers[1], hash: inContract.hash2 });
                sharuShares.push({ pointer: pointers[2], hash: inContract.hash3 });
                sharuShares.push({ pointer: pointers[3], hash: inContract.hash4 });
                sharuShares.push({ pointer: pointers[4], hash: inContract.hash5 });
                sharuShares.push({ pointer: pointers[5], hash: inContract.hash6 });

                return await this.recursiveDetails(pointers.slice(6), sharuShares);
            }
        }
    }

    public async invite(pointer: BigNumber, receiver: string): Promise<Transaction> {
        return await this.mutexify('invite', async () => {
            return await this.contract.invite(pointer, receiver);
        });
    }
    public async getMyInvites(): Promise<BigNumber[]> {
        this.logContract(`getMyInvites()`);
        return this.contract.getMyInvites();
    }

    private async mutexify(label: string, func) {
        return await mutexify(this.mutex, 'share-contract', label, func);
    }

    private logContract(log: string) {
        console.log(`[share-contract-read]: ${log}`);
    }

}

export interface NewInvite {
    pointer: BigNumber;
    sender: string;
}

export interface HashUpdate {
    pointer: BigNumber;
    oldHash: string;
    newHash: string;
    sender: string;
}
