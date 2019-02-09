import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class SidebarService {
    constructor() { }

    topic: BehaviorSubject<string> = new BehaviorSubject('');
    whatToShow: string = null;

    select(whatToShow: string) {
        this.whatToShow = whatToShow;
        this.topic.next(whatToShow);
    }
}
