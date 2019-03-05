
import { Component } from '@angular/core';
import { StatisticsService } from '../../service/statistics.service';
import { IpfsService } from '../../service/ipfs.service';
import { ToastService } from '../../service/toast.service';

@Component({
    // tslint:disable-next-line:component-selector
    selector: 'statistics',
    templateUrl: './statistics.component.html'
})
export class StatisticsComponent {
    addPeerInput = '';
    public peerFilter = '';
    public selectedPeer = null;

    public searchHash = '';
    public findHash: {search: string, result: string}  = null;


    constructor(public stats: StatisticsService, public ipfs: IpfsService, public toast: ToastService) { }

    displayedColumnsBandWith: string[] = ['key', 'value'];
    displayedColumnsPeers: string[] = ['peer'];

    public async lookupHash(hash: string) {
        this.findHash = {
            search: hash,
            result: null
        };
        try {
            this.findHash.result = await this.ipfs.ipfs.dht.findProvs(hash);
        } catch (error) {
            this.toast.notify('error', `findHash(${hash}) failed`, error);
            console.error(error);
            this.findHash = null;
        }
    }
}
