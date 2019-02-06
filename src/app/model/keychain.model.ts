import { AsyncBundle } from './asyncBundle.model';

export class Keychain {
    private keys: AsyncBundle[] = [];

    public static fromRaw(raw: string): Keychain {
        const populated: Keychain = new Keychain();
        populated.keys = JSON.parse(raw).keys;
        return populated;
    }

    private static toJson(bundle: AsyncBundle): AsyncBundle {
        return Object.assign({}, bundle, {
            rsaContent: btoa(bundle.rsaContent)
        });
    }
    private static fromJson(json: AsyncBundle): AsyncBundle {
        return Object.assign({}, json, {
            rsaContent: atob(json.rsaContent)
        });
    }

    /**
     * @param walletAddress
     * @returns the corresponding bundle or null if wallet is not known in keychain
     */
    public get(walletAddress: string): AsyncBundle {
        const lower = walletAddress;
        let v: AsyncBundle = null;
        this.keys.forEach(element => {
            if (element.wallet === lower) {
                v = Keychain.fromJson(element);
            }
        });
        return v;
    }

    /**
     * @param toAdd
     * @returns true if new entry or false if call modified the existing bundle
     */
    public addOrModify(toAdd: AsyncBundle): boolean {
        let existing = false;
        this.keys.forEach(element => {
            if (element.wallet === toAdd.wallet) {
                existing = true;
                element.rsaContent = Keychain.toJson(toAdd).rsaContent;
            }
        });
        if (!existing) {
            this.keys.push(Keychain.toJson(toAdd));
        }

        return existing;
    }

    /**
     * @param walletAddress
     * @returns true if walletAdress was in keychain
     */
    public remove(walletAddress: string): boolean {
        const lower = walletAddress;
        const oldsize = this.keys.length;
        this.keys = this.keys.filter(f => {
            return f.wallet !== lower;
        });
        const newsize = this.keys.length;
        return (oldsize !== newsize);
    }

    public getKeyOwners(): string[] {
        const receivers = [];
        this.keys.forEach(element => {
            receivers.push(element.wallet);
        });
        return receivers;
    }

    public getOwner(): string {
        return this.getKeyOwners()[0];
    }

    public getReceivers(): string[] {
        const keyowners = this.getKeyOwners();
        return keyowners.length > 1 ? keyowners.slice(1, keyowners.length) : [];
    }
}
