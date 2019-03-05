import { Injectable } from '@angular/core';
import { IpfsService } from './ipfs.service';
import { SidebarService } from './sidebar.service';
import { PausableIntervalTask } from '../util/pausableIntervalTask';
import { MatTableDataSource } from '@angular/material';

@Injectable({
    providedIn: 'root'
})
export class StatisticsService {
    panelState = new Map<string, boolean>();

    public id = null;
    public totalIn = null;
    public totalOut = null;
    public peers = null;
    public peerIps = null;

    private runStatistics = false;
    private readonly allStats = [
        new PausableIntervalTask(async () => {
            const statisticsFrom = await this.ipfs.ipfs.stats.bw();
            this.totalIn = this.bytesToReadable(statisticsFrom.totalIn);
            this.totalOut = this.bytesToReadable(statisticsFrom.totalOut);
        }, 2000),
        new PausableIntervalTask(async () => {
            const statisticsFrom = await this.ipfs.ipfs.swarm.peers();
            this.peers = statisticsFrom.map(p => p.addr.toString()).map(s => ({peer: s}));
            this.peerIps = this.peers.map(p => ({
                ip: p.peer.split('/')[2],
                peer: p.peer,
                multiaddr: this.getShortedMultiAddress(p.peer.split('/')[6])
            }));
        }, 2000),
        new PausableIntervalTask(async () => {
            this.id = await this.ipfs.ipfs.id();
        }, 2000),
    ];

    private getShortedMultiAddress(multiaddr: string): string {
        const length = 6;
        const shorted = multiaddr.slice(0, length) + '...' + multiaddr.slice(multiaddr.length - length, multiaddr.length);
        return shorted;
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
