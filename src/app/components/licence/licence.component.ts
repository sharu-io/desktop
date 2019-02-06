import { Component } from '@angular/core';
import { LicenceService } from '../../service/licence.service';
import { githash } from '../../util/gitversion';

@Component({
    selector: 'licence',
    templateUrl: './licence.component.html',
    styleUrls: ['../wallet/wallet.component.css']
})
export class LicenceComponent {
    public gitHash;
    constructor(public licence: LicenceService) {

        this.gitHash = githash;

    }
}
