import { Component, OnInit, Input } from '@angular/core';
import { TreeNodeItem } from '../../model/treeNodeItem.model';
import { ShareService } from '../../service/share.service';
import { ContactService } from '../../service/contact.service';
import { Observable, merge, from } from 'rxjs';
import { Contact } from '../../model/contacts.model';
import { FormControl, Validators, ValidatorFn, AbstractControl } from '@angular/forms';
import { map, startWith } from 'rxjs/operators';
import { ShareWithYourselfError } from '../../service/errors/ShareWithYourself.error';
import { ReceiverUnknownInSharuError } from '../../service/errors/ReceiverUnkownInSharu.error';
import { ShareAlreadySentToReceiverError } from '../../service/errors/ShareAlreadySentToReceiver.error';
import { ShareNotKnownInSharu } from '../../service/errors/ShareNotKnownInSharu.error';
import { SharuSettingsService } from '../../service/sharusettings.service';
import { ToastService } from '../../service/toast.service';
import { InviteService } from '../../service/invite.service';
import { githash } from '../../util/gitversion';
import * as baffle from 'baffle';
import { ElectronService } from 'ngx-electron';

@Component({
  selector: 'share-list',
  templateUrl: './share-list.component.html',
  styleUrls: ['./share-list.component.scss']
})
export class ShareListComponent implements OnInit {

  constructor(
    private cs: ContactService,
    private settings: SharuSettingsService,
    private toast: ToastService,
    private invite: InviteService,
    public ngxElectron: ElectronService,
    public ss: ShareService // needed for html! do not remove
  ) {
    this.gitHash = githash;
  }

  public readonly gitHash;
  private selectedReceiver: string | Contact;
  shareReceivers: string[] = [];
  knownShareReceivers: string[] = [];
  unknownShareReceivers: string[] = [];
  shareOwner: string = null;
  nodeForAutocomplete: TreeNodeItem = null;

  // inputs are coming from router
  @Input()
  selected: TreeNodeItem;

  receiversControl = new FormControl();
  filteredReceivers: Observable<Contact[]>;
  item2delete: TreeNodeItem = null;
  newShareControl = new FormControl('', [
    Validators.pattern('^[a-zA-Z0-9 ]{1,30}$'),
    this.existingShareNameValidator()
  ]);

  public isShareNameValid(): boolean {
    const isNull: boolean = (this.newShareControl.value === null)
      || (this.newShareControl.value === undefined)
      || (this.newShareControl.value.length === 0);
    return !this.newShareControl.hasError('pattern') && !this.newShareControl.hasError('nameAlreadyAvailable') && !isNull;
  }

  existingShareNameValidator(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: boolean } | null => {
      const foundShareWithSameName = this.ss.shares.filter(item => item.label === control.value);
      if (foundShareWithSameName !== null && foundShareWithSameName.length > 0) {
        return { 'nameAlreadyAvailable': true };
      }
      return null;
    };
  }

  async shareWith(share: TreeNodeItem) {
    if (this.selectedReceiver !== null && this.selectedReceiver !== undefined) {
      let asString: string;
      let asContact: Contact;
      if (typeof this.selectedReceiver === 'string') {
        asString = this.selectedReceiver as string;
        console.log(`pressed shareWith as string (${asString})`);
      } else {
        asContact = this.selectedReceiver as Contact;
        console.log(`pressed shareWith as contact (${asContact.name}|${asContact.wallet})`);
        asString = asContact.wallet;
      }
      try {
        await this.ss.shareWith(share, asString);
        this.receiversControl.setValue(null);
        this.focusOn(share);
      } catch (e) {
        console.log(e);
        if (e instanceof ShareWithYourselfError) {
          this.errorToast('you shall not share with yourself');
        } else if (e instanceof ReceiverUnknownInSharuError) {
          this.errorToast('receiver is not known in sharu');
        } else if (e instanceof ShareAlreadySentToReceiverError) {
          this.errorToast('share already shared with receiver');
        } else if (e instanceof ShareNotKnownInSharu) {
          this.errorToast('share is not registered in sharu yet');
        } else {
          this.errorToast(e.message);
        }
      }

    }
  }

  private errorToast(message: string) {
    this.toast.notify('error', 'Sharing Failure', message);
  }

  async revokeShare(share: TreeNodeItem, receiver: string) {
    await this.ss.revokeShare(share, receiver);
    this.focusOn(share);
  }

  ngOnInit() {
    this.filteredReceivers = merge(
      this.receiversControl.valueChanges.pipe(
        startWith<string | Contact>(''),
        map(inputValue => this._renderContacts(inputValue))
      ),
      this.ss.newReceiversCalculated.pipe(
        startWith<TreeNodeItem>(null as TreeNodeItem),
        map(i => this._renderContacts(null))
      )
    );

    setTimeout(() => {
      const b = baffle('.baffle', { characters: '█▓▒░', speed: 150 }).reveal(5000);
      b.start();
    }, 100);

  } 
  public openGatewayIo(hash: string) {
    if (this.ngxElectron.isElectronApp) {
      this.ngxElectron.shell.openExternal(`http://gateway.ipfs.io/ipfs/${hash}/`);
    } else {
      window.open(`http://gateway.ipfs.io/ipfs/${hash}/`, 'blank');
    }
  }
  public copyHashToClipBoard(hash: string){
    const selBox = document.createElement('textarea');
    selBox.style.position = 'fixed';
    selBox.style.left = '0';
    selBox.style.top = '0';
    selBox.style.opacity = '0';
    selBox.value = hash;
    document.body.appendChild(selBox);
    selBox.focus();
    selBox.select();
    document.execCommand('copy');
    document.body.removeChild(selBox);
  }


  async focusOn(share: TreeNodeItem) {
    await this.ss.loadDetailsForShare(share);
    this.shareReceivers = this.ss.shareReceivers.get(share);
    this.knownShareReceivers = this.shareReceivers.filter(r => {
      return this.cs.walletsToNames[r] !== undefined;
    });
    this.unknownShareReceivers = this.shareReceivers.filter(r => {
      return this.cs.walletsToNames[r] === undefined;
    });
    this.shareOwner = this.ss.shareOwner.get(share);
    this.nodeForAutocomplete = share;
  }


  private _renderContacts(value: string | Contact): Contact[] {
    if (value !== undefined && value !== null) {
      if (typeof value === 'string') {
        this.selectedReceiver = value;
        const filterValue = value.toLowerCase();

        return this.settings.settings.contacts.
          filter(c =>
            c.name.toLowerCase().includes(filterValue)
          ).filter(d => {
            return this.notIncluded(d.wallet);
          })
          ;
      } else {
        this.selectedReceiver = value;
      }
    } else {
      return this.settings.settings.contacts.slice().filter(f => this.notIncluded(f.wallet));
    }
  }

  private notIncluded(wallet: string): boolean {
    if (this.nodeForAutocomplete === null) {
      return false;
    }
    const knownReceivers = this.ss.shareReceivers.get(this.nodeForAutocomplete);
    if (knownReceivers === undefined) {
      return false;
    }
    const inReceivers = knownReceivers.find(sr => {
      return sr === wallet;
    });
    return (inReceivers === null || inReceivers === undefined);
  }

  // used in html, do not remove
  private displayFn(contact?: Contact): string | undefined {
    return contact ? contact.name + '(' + contact.wallet + ')' : undefined;
  }
}
