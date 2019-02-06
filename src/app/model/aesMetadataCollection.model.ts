import { AesMeta } from './aesMetadata.model';

export class AesMetaDataCollection {
    private items: AesMeta[] = [];

    public static fromRaw(raw: string): AesMetaDataCollection {
        const populated: AesMetaDataCollection = new AesMetaDataCollection();
        populated.items = JSON.parse(raw).items;
        return populated;
    }

    public get(filename: string): AesMeta {
        let a: AesMeta = null;
        this.items.forEach(element => {
            if (element.filename === filename) {
                a = element;
            }
        });
        return a;
    }
    public addOrModify(toAdd: AesMeta): boolean {
        let existing = false;
        this.items.forEach(element => {
            if (element.filename === toAdd.filename) {
                existing = true;
                element.filename = toAdd.filename;
                element.iv = toAdd.iv;
                element.authTag = toAdd.authTag;
            }
        });
        if (!existing) {
            this.items.push(toAdd);
        }

        return existing;
    }
    public remove(filename: string): boolean {
        let existing = false;
        const newItems = this.items.filter(f => {
            return f.filename !== filename;
        });
        if (newItems.length === this.items.length - 1) {
            existing = true;
            this.items = newItems;
        }

        return existing;
    }
}
