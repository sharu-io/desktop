import { Injectable } from '@angular/core';
import { IpfsService } from './ipfs.service';
import { SidebarService } from './sidebar.service';
import { PausableIntervalTask } from '../util/pausableIntervalTask';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class StatisticsService {
    private runStatistics = false;

    public id = null;

    public totalIn = null;
    public totalOut = null;

    public fetchingPeers: boolean; // undefined: uninited
    public peersSubject: BehaviorSubject<{ id: string, addrs: string[] }[]> = new BehaviorSubject<{ id: string, addrs: string[] }[]>(null);

    private readonly allStats = [
        new PausableIntervalTask(async () => {
            const statisticsFrom = await this.ipfs.ipfs.stats.bw();
            this.totalIn = this.bytesToReadable(statisticsFrom.totalIn);
            this.totalOut = this.bytesToReadable(statisticsFrom.totalOut);
        }, 2000),
        // new PausableIntervalTask(async () => {
            // this.peersSubject.next(
            //     (await this.ipfs.ipfs.swarm.addrs()).map(peer => {
            //         return {
            //             id: peer.id.toB58String(), addrs: peer.multiaddrs.toArray().map(a => a.toString())
            //         };
            //     })
            // );
        // }, 5000),
        new PausableIntervalTask(async () => {
            this.id = await this.ipfs.ipfs.id();
        }, 2000)
    ];


    constructor(
        private ipfs: IpfsService,
        public sidebar: SidebarService
    ) {
        sidebar.topic.subscribe(async whatToShow => {
            const start = (whatToShow === 'statistics');
            if (start) {
                // if (this.fetchingPeers === undefined) {
                //     this.fetchPeers();
                // }
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

    public async fetchPeers() {
        if (!this.fetchingPeers) {
            this.fetchingPeers = true;
            this.peersSubject.next(await this.getSwarmAddrs());
            this.fetchingPeers = false;
        }
    }

    private async getSwarmAddrs(): Promise<{ id: string, addrs: string[] }[]> {

        console.log('fetching from server');
        const fromServer = await this.ipfs.ipfs.swarm.addrs();
        console.log('fetched from server');
        const val = fromServer.map(peer => {
            return {
                id: peer.id.toB58String(), addrs: peer.multiaddrs.toArray().map(a => a.toString())
            };
        });
        console.log('transformed');
        return val;
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
