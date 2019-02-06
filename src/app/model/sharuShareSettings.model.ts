import { BigNumber } from 'ethers/utils';

export interface SharuShareSettings {
    pointer: BigNumber;
    name: string;
    owner: string;
}

export interface EncryptedSharuShareSettings {
    data: string;
    iv: string;
    authTag: string;
}
