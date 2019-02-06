import { Contact } from './contacts.model';

export interface SharuSettings {
    random?: string;
    contacts: Contact[];
    invites: Invite[];
}

export interface Invite {
    pointerAsHex: string;
    accepted: boolean;
    pinned?: boolean;
}

export interface EncryptedSharuSettings {
    data: string;
    iv: string;
    encryptedKey: string;
    authTag: string;
}
