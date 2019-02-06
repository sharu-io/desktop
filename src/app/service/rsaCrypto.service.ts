import { Injectable } from '@angular/core';
import { pki, util } from 'node-forge';
import { SharuKey } from '../model/sharukey.model';

@Injectable()
export class RsaCryptoService {

  public static encrypt(data: string, pem: string): string {
    if (!data) {
      throw new Error('No input data to encrypt');
    }

    if (!pem) {
      throw new Error('No keyfile specified for encryption');
    }

    let encryptionKey;

    if (pem.startsWith('-----BEGIN RSA PRIVATE KEY-----')) {
      const privateKey = pki.privateKeyFromPem(pem);
      encryptionKey = (pki.rsa as any).setPublicKey(privateKey.n, privateKey.e);
    } else if (pem.startsWith('-----BEGIN PUBLIC KEY-----')) {
      encryptionKey = pki.publicKeyFromPem(pem);
    } else {
      throw new Error('Bad PEM');
    }

    const encrypted: string = encryptionKey.encrypt(data, 'RSA-OAEP');

    if (!encrypted) {
      throw new Error('encryption failed');
    }

    const encrypted64 = util.encode64(encrypted);

    return encrypted64;
  }

  public static decrypt(data64: string, pem: string): string {
    if (!data64) {
      throw new Error('no input');
    }

    if (!pem) {
      throw new Error('no keyfile');
    }

    if (!pem.startsWith('-----BEGIN RSA PRIVATE KEY-----')) {
      throw new Error('invalid PEM');
    }

    const privateKey = pki.privateKeyFromPem(pem);

    const data = util.decode64(data64);
    try {
      const decrypted = privateKey.decrypt(data, 'RSA-OAEP');
      if (!decrypted) {
        throw new Error('decryption failed.');
      }

      return decrypted;
    } catch (e) {
      console.error(e);
    }
  }

  public static createKeyPair(password: string): Promise<SharuKey> {
    return new Promise((resolve, reject) => {
      pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (error, keypair) => {
        if (error) {
          return reject(error);
        }
        const publicKey = pki.publicKeyToPem(keypair.publicKey);
        const encryptedPrivateKey = pki.encryptRsaPrivateKey(keypair.privateKey, password);
        resolve({ publicKey, encryptedPrivateKey });
      });
    });
  }
}
