import { Injectable } from '@angular/core';
import { LocalStorageService } from 'angular-2-local-storage';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class LicenceService {
    private readonly LICENCE_MARKER = 'sharu-licence';
    constructor(private localStorage: LocalStorageService) { }
    private accepted;
    private topic: BehaviorSubject<boolean> = new BehaviorSubject(false);

    public accept() {
        this.localStorage.set(this.LICENCE_MARKER, 'true');
        this.accepted = true;
        this.topic.next(true);
    }

    public checkAccepted(): boolean {
        if (this.accepted === undefined) {
            this.accepted = this.localStorage.get(this.LICENCE_MARKER) === 'true';
        }
        this.topic.next(this.accepted);
        return this.accepted;
    }

    public status(): BehaviorSubject<boolean> {
        return this.topic;
    }
}
