import { Injectable } from '@angular/core';
import { LocalStorageService } from 'angular-2-local-storage';

@Injectable({
    providedIn: 'root'
})
export class SettingsService {
    public readonly IPFSserver = 'ipfsserver';
    public readonly IPFSport = 'ipfsport';

    constructor(
        private localStorage: LocalStorageService
    ) {
    }

    public getIpfsConfig(): IpfsConfig {
        const server: string = this.localStorage.get(this.IPFSserver);
        const port: string = this.localStorage.get(this.IPFSport);

        if (server !== null &&
            server !== undefined &&
            port !== null &&
            port !== undefined) {
            return { server, port };
        }

        this.setIpfsConfig({ server: '127.0.0.1', port: '5001' });
        return this.getIpfsConfig();
    }

    public setIpfsConfig(config: IpfsConfig) {
        this.localStorage.set(this.IPFSserver, config.server);
        this.localStorage.set(this.IPFSport, config.port);

    }
}

export interface IpfsConfig {
    server: string;
    port: string;
}
