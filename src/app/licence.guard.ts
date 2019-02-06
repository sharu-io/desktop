import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { LicenceService } from './service/licence.service';

@Injectable({
    providedIn: 'root',
})
export class LicenceGuard implements CanActivate {
    constructor(private licence: LicenceService) { }

    canActivate(): Observable<boolean> {
        this.licence.checkAccepted();
        return this.licence.status().asObservable().pipe(filter(b => b === true));
    }
}
