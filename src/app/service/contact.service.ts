import { Contact } from '../model/contacts.model';
import { Injectable } from '@angular/core';
import { SharuSettingsService } from './sharusettings.service';
import { ToastService } from './toast.service';

@Injectable({
    providedIn: 'root'
})
export class ContactService {
    contacts: Contact[];
    walletsToNames: Map<string, string> = new Map();

    constructor(
        private sharuSettings: SharuSettingsService,
        private toast: ToastService
    ) {
        sharuSettings.topic.subscribe(b => {
            if (b) {
                this.contacts = sharuSettings.settings.contacts;
                this.mapify();
            }
        });
    }
    private initProm: Promise<void>;
    public async init(): Promise<void> {
        if (this.initProm !== undefined) {
            return this.initProm;
        }
        this.initProm = new Promise(async (resolve, reject) => {
            this.contacts = this.sharuSettings.settings.contacts;
            this.mapify();
            resolve();
        });
        return this.initProm;
    }

    addNewContact(name: string, wallet: string) {
        const newContact = { name: name, wallet: wallet };
        const existing = this.findExisting(newContact);
        if (existing !== undefined && existing !== null) {
            this.toast.notify('error', 'contact error', 'you already have an contact with this wallet');
        } else {
            this.sharuSettings.settings.contacts.push(newContact);
            this.save();
        }
    }

    changeNameOfContact(modifiedContact: Contact) {
        const existing = this.findExisting(modifiedContact);
        if (existing === null || existing === undefined) {
            throw new Error('there is no existing entry for this contact');
        }
        existing.name = modifiedContact.name;
        this.save();
    }

    removeContact(walletToRemove: string) {
        this.sharuSettings.settings.contacts = this.sharuSettings.settings.contacts.filter(f => {
            return f.wallet !== walletToRemove;
        });
        this.save();
    }

    private findExisting(contact: Contact) {
        return this.sharuSettings.settings.contacts.find(f => {
            return f.wallet === contact.wallet;
        });
    }

    private async save() {
        this.sharuSettings.sync();
    }

    private mapify() {
        this.walletsToNames = new Map<string, string>();
        this.sharuSettings.settings.contacts.forEach(c => {
            if (c.wallet !== null && c.name !== null) {
                this.walletsToNames[c.wallet] = c.name;
            }
        });
    }
}
