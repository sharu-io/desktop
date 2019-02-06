import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class SidebarService {
    constructor() { }

    whatToShow: string = null;

    select(whatToShow: string) {
        this.whatToShow = whatToShow;
    }
}
