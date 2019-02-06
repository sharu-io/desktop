import { BigNumber } from 'ethers/utils';

export interface SharuShare {
    pointer: BigNumber;
    hash: string;
    name?: string;
    sent?: boolean;
    pinned?: boolean;
}
