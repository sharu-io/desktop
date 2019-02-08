
import { Component } from '@angular/core';
import { IpfsService } from '../../service/ipfs.service';

@Component({
    // tslint:disable-next-line:component-selector
    selector: 'statistics',
    templateUrl: './statistics.component.html'
})
export class StatisticsComponent {
    constructor(public stats : IpfsService){}

  displayedColumns: string[] = ['key', 'value'];
}