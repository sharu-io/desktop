
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
    public addPeerInput = '';

    public filterForPeers: string = null;
    public peers: { id: string, addrs: string[] }[];
    public filteredPeers: { id: string, addrs: string[] }[] = null;
    public selectedPeer: { id: string, addrs: string[] };

    public searchHash = '';
    public findHash: {search: string, result: string}  = null;


    constructor(public stats: StatisticsService, public ipfs: IpfsService, public toast: ToastService) {
        stats.peersSubject.subscribe(f => {
            this.peers = f;
            this.filterPeers();
        });
     }

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
    public getShortedMultiAddress(multiaddr: string): string {
        const length = 6;
        const shorted = multiaddr.slice(0, length) + '...' + multiaddr.slice(multiaddr.length - length, multiaddr.length);
        return shorted;
    }

    public async setFilterForPeers(filter: string) {
        this.filterForPeers = filter;
        await this.filterPeers();
    }

    private async filterPeers() {
        if (!this.filterForPeers) {
            this.filteredPeers = this.peers;
        } else {
            this.filteredPeers = this.peers.filter(r => {
                if (r.id.toLowerCase().includes(this.filterForPeers.toLowerCase())) {
                    return true;
                }
                for (let i = 0; i < r.addrs.length; i++) {
                    const toCheck = r.addrs[i];
                    if (toCheck.toLowerCase().includes(this.filterForPeers.toLowerCase())) {
                        return true;
                    }
                }
                return false;
            });
            if (this.selectedPeer) {
                if (!this.filteredPeers.find(f => f.id === this.selectedPeer.id)) {
                    this.selectedPeer = null;
                }
            }
            if (this.filteredPeers.length === 1) {
                this.selectedPeer = this.filteredPeers[0];
            }
        }

    }
}
