import { Injectable } from '@angular/core';
import { IpfsService } from './ipfs.service';
import { SidebarService } from './sidebar.service';
import { PausableIntervalTask } from '../util/pausableIntervalTask';
import { MatTableDataSource } from '@angular/material';

@Injectable({
    providedIn: 'root'
})
export class StatisticsService {

    public statsBw = null;
    public peers = null;
    public peersSource = new MatTableDataSource(this.peers);

    private runStatistics = false;
    private readonly allStats = [
        new PausableIntervalTask(async () => {
            const statisticsFrom = await this.ipfs.ipfs.stats.bw();
            this.statsBw = [
                {
                    key: 'incoming total', value: this.bytesToReadable(statisticsFrom.totalIn)
                },
                {
                    key: 'outgoing total', value: this.bytesToReadable(statisticsFrom.totalOut)
                },
                {
                    key: 'incoming rate', value: this.bytesToReadable(statisticsFrom.rateIn) + '/s'
                },
                {
                    key: 'outgoing rate', value: this.bytesToReadable(statisticsFrom.rateOut) + '/s'
                }
            ];
        }, 2000),
        new PausableIntervalTask(async () => {
            const statisticsFrom = await this.ipfs.ipfs.swarm.peers();
            this.peers = statisticsFrom.map(p => p.addr.toString()).map(s => ({peer: s}));
            this.peersSource.data = this.peers;
        }, 2000),
    ];

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

    public applyFilterPeers(filterValue: string) {
        this.peersSource.filter = filterValue.trim().toLowerCase();
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
