
import { Component } from '@angular/core';
import { StatisticsService } from '../../service/statistics.service';

@Component({
    // tslint:disable-next-line:component-selector
    selector: 'statistics',
    templateUrl: './statistics.component.html'
})
export class StatisticsComponent {
    constructor(public stats: StatisticsService) { }

    displayedColumnsBandWith: string[] = ['key', 'value'];
}
