
import { Component } from '@angular/core';
import { IpfsService } from '../../service/ipfs.service';

@Component({
    selector: 'statistics',
    templateUrl: './statistics.component.html'
})
export class StatisticsComponent {
    constructor(public stats : IpfsService){}

  displayedColumns: string[] = ['key', 'value'];
}