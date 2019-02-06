import { AesEncrypted } from '../model/aesCryptoData.model';
import { Injectable } from '@angular/core';

@Injectable()
export class AesCryptoService {

  public static async generateRandomKey(): Promise<string> {
    const key = await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
    const rawKey = await window.crypto.subtle.exportKey('raw', key);
    return this.ab2str(rawKey);
  }

  public static async encryptFile(file: Blob, key: string): Promise<AesEncrypted> {
    const fileContent: ArrayBuffer = await this.fromFile(file);
    return await this.encrypt(fileContent, key);
  }

  public static async encrypt(rawFile: ArrayBuffer, key: string): Promise<AesEncrypted> {

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      this.str2ab(key),
      'AES-GCM',
      false,
      ['encrypt']
    );

    const ivUint = window.crypto.getRandomValues(new Uint8Array(12));
    const dataAndAuthTag = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        // Don't re-use initialization vectors!
        // Always generate a new iv every time your encrypt!
        // Recommended to use 12 bytes length
        iv: ivUint,
        tagLength: 128
      },
      cryptoKey,
      rawFile
    );
    const iv = this.ab2str(ivUint.buffer as ArrayBuffer);
    const data = dataAndAuthTag.slice(0, dataAndAuthTag.byteLength - 16);
    const authTag = this.ab2str(dataAndAuthTag.slice(dataAndAuthTag.byteLength - 16));
    return { data, iv, authTag };
  }

  public static async decryptFile(aesCryptoData: AesEncrypted,
    key: string): Promise<Blob> {
    const fileContent: ArrayBuffer = await this.decrypt(aesCryptoData, key);

    return new Blob([fileContent]);
  }

  public static async decrypt(aesCryptoData: AesEncrypted, key: string): Promise<ArrayBuffer> {
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      this.str2ab(key),
      'AES-GCM',
      false,
      ['decrypt']
    );

    const authTagAb = this.str2ab(aesCryptoData.authTag);
    const dataAndAuthTag = new Uint8Array(aesCryptoData.data.byteLength + authTagAb.byteLength);
    dataAndAuthTag.set(new Uint8Array(aesCryptoData.data), 0);
    dataAndAuthTag.set(new Uint8Array(authTagAb), aesCryptoData.data.byteLength);

    const ab = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: this.str2ab(aesCryptoData.iv),
        tagLength: 128
      },
      cryptoKey,
      dataAndAuthTag
    );
    return ab;
  }

  public static ab2str(buf) {
    const bufView = new Uint8Array(buf);
    const length = bufView.length;
    let result = '';
    let addition = Math.pow(2, 16) - 1;

    for (let i = 0; i < length; i += addition) {

      if (i + addition > length) {
        addition = length - i;
      }
      result += String.fromCharCode.apply(null, bufView.subarray(i, i + addition));
    }
    return result;
  }

  public static str2ab(str) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  }

  public static async fromFile(file: Blob): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader: FileReader = new FileReader();

      reader.onload = async () => {
        const buffer: ArrayBuffer = reader.result as ArrayBuffer;
        resolve(buffer);
      };

      reader.onerror = () => {
        reject(reader.error);
      };

      reader.readAsArrayBuffer(file);
    });
  }
}
