import { Injectable } from '@angular/core';
import { IpfsService } from './ipfs.service';
import { SidebarService } from './sidebar.service';

@Injectable({
    providedIn: 'root'
})
export class StatisticsService {
    private runStatistics = false;
    
    constructor(
        private ipfs: IpfsService,
        public sidebar: SidebarService
    ) {
        sidebar.topic.subscribe(async whatToShow => {
            this.runStatistics = (whatToShow === 'statistics');
            if (this.runStatistics) {
                this.updateStatsBw();
            }
        });
    }

    public statsBw = null;
    private async updateStatsBw() {
        while (this.runStatistics) {
            const statisticsFrom = await this.ipfs.ipfs.stats.bw();
            this.statsBw = [
                {
                    key: 'incoming total', value: this.bytesToReadable(statisticsFrom.totalIn)
                },
                {
                    key: 'incoming rate', value: this.bytesToReadable(statisticsFrom.rateIn) + '/s'
                },
                {
                    key: 'outgoing total', value: this.bytesToReadable(statisticsFrom.totalOut)
                },
                {
                    key: 'outgoing rate', value: this.bytesToReadable(statisticsFrom.rateOut) + '/s'
                }
            ];
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

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
