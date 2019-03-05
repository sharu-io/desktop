import { Injectable } from '@angular/core';
import { IpfsService } from './ipfs.service';
import { SidebarService } from './sidebar.service';
import { PausableIntervalTask } from '../util/pausableIntervalTask';
import { PeerInfo } from 'peer-info';

@Injectable({
    providedIn: 'root'
})
export class StatisticsService {
    private runStatistics = false;

    public id = null;

    public totalIn = null;
    public totalOut = null;

    private peers: PeerInfo[] = null;
    public filteredPeers: { id: string, addrs: string[] }[] = null;
    public filterForPeers: string = null;
    public selectedPeer: { id: string, addrs: string[] };

    private readonly allStats = [
        new PausableIntervalTask(async () => {
            const statisticsFrom = await this.ipfs.ipfs.stats.bw();
            this.totalIn = this.bytesToReadable(statisticsFrom.totalIn);
            this.totalOut = this.bytesToReadable(statisticsFrom.totalOut);
        }, 2000),
        new PausableIntervalTask(async () => {
            this.peers = await this.ipfs.ipfs.swarm.addrs();
            await this.filterPeers();
        }, 10000000),
        new PausableIntervalTask(async () => {
            this.id = await this.ipfs.ipfs.id();
        }, 2000)
    ];

    public async setFilterForPeers(filter: string) {
        this.filterForPeers = filter;
        await this.filterPeers();
    }

    private async filterPeers() {
        const raw = await this.peers.map(async peer => await this.peerInfoToPrint(peer));
        
        if (!this.filterForPeers) {
            this.filteredPeers = raw;
        } else {
            this.filteredPeers = raw.filter(r => {
                if (r.id.includes(this.filterForPeers)) {
                    return true;
                }
                for (let i = 0; i < r.addrs.length; i++) {
                    const toCheck = r.addrs[i];
                    console.log(toCheck);
                    if (toCheck.toLowerCase().includes(this.filterForPeers)) {
                        return true;
                    }
                }
                return false;
            });
                // r.id.includes(this.filterForPeers) ||
                // (r.addrs.find(a => a.includes(this.filterForPeers))));
            if (this.selectedPeer) {
                if (!this.filteredPeers.find(f => f.id === this.selectedPeer.id)) {
                    this.selectedPeer = null;
                }
            }
        }

    }
    private async peerInfoToPrint(peer: PeerInfo): Promise<{ id: string, addrs: string[] }> {
        const val = { id: await peer.id.toB58String(), addrs: [] };
        peer.multiaddrs.forEach(async maddr => {
            val.addrs.push(await maddr.toString());
        });
        return val;
    }

    constructor(
        private ipfs: IpfsService,
        public sidebar: SidebarService
    ) {
        sidebar.topic.subscribe(async whatToShow => {
            const start = (whatToShow === 'statistics');
            if (start) {
                this.runStatistics = true;
                this.allStats.forEach(f => f.start());
            } else {
                if (this.runStatistics) {
                    this.runStatistics = false;
                    this.allStats.forEach(f => f.stop());
                }
            }
        });
    }

    private bytesToReadable(incoming) {
        let suffix = 'B';
        if (incoming > 1024) {
            incoming /= 1024;
            suffix = 'kB';
        }
        if (incoming > 1024) {
            incoming /= 1024;
            suffix = 'MB';
        }
        if (incoming > 1024) {
            incoming /= 1024;
            suffix = 'GB';
        }
        incoming = incoming.toFixed(3);
        return incoming + ' ' + suffix;
    }
}
