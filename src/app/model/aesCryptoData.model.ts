export interface AesEncrypted {
    data: ArrayBuffer;
    iv: string;
    authTag: string;
}
