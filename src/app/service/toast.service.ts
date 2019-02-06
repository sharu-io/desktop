import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Message } from 'primeng/api';


type Severities = 'success' | 'info' | 'warn' | 'error';
type Targets = 'invite';

@Injectable({
    providedIn: 'root'
})
export class ToastService {
    public toasts: Subject<Message> = new Subject<Message>();

    notify(severity: Severities, summary: string, detail: string, target?: Targets, data?: any) {
        this.toasts.next({ severity, summary, detail, key: (target) ? target : undefined, data });
    }
}
