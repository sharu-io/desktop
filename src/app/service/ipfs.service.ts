import { Injectable } from '@angular/core';
import { Buffer } from 'buffer';
import { IpfsFile } from '../model/ipfsFile.model';
import { TreeNodeItem } from '../model/treeNodeItem.model';
import { SettingsService } from './settings.service';
import { ElectronService } from 'ngx-electron';
import { JobsService, IpfsCatJob, IpfsLsJob } from './jobs.service';

@Injectable({
    providedIn: 'root'
})
export class IpfsService {
    ipfs;

    constructor(
        private settings: SettingsService,
        private ngxElectron: ElectronService,
        private jobs: JobsService
    ) {
        console.log(this.ngxElectron);
        if (this.ngxElectron.isElectronApp) {
            console.log('This is electron');
            const electron = require('electron');
            const ipfsControl = electron.remote.require('./ipfsControl');
            ipfsControl.init().then(ipfsApi => {
                console.log(ipfsApi);
                this.ipfs = ipfsApi;
            }).catch(err => {
                console.log('ipfs init error');
                console.log(err);
            });
        } else {
            console.log('This is web');
            const ipfsConfig = this.settings.getIpfsConfig();
            this.ipfs = (window as any).IpfsApi(ipfsConfig.server, ipfsConfig.port);
        }
    }

    // this is doing a ls on the locally running ipfs, no need to jobify
    public async scanLocalRootFolder(): Promise<TreeNodeItem[]> {
        const dirs = await this.ipfs.files.ls('/');
        const content: TreeNodeItem[] = [];
        for (const localDir of dirs) {
            const stat = await this.ipfs.files.stat(`/${localDir.name}`);
            content.push({
                hash: stat.hash,
                label: localDir.name,
                leaf: stat.type !== 'directory',
                publishedToChain: false,
                owned: true,
                parent: null,
                root: true,
                local: true,
                localPath: '/' + localDir.name
            });
        }

        return content;
    }

    // this is doing a ls on the locally running ipfs, no need to jobify
    public async ls(dirname: string): Promise<TreeNodeItem[]> {
        const dirs = await this.ipfs.files.ls(dirname);
        const dirContent: TreeNodeItem[] = [];
        for (const d of dirs) {
            const f = await this.ipfs.files.stat(`${dirname}/${d.name}`);
            dirContent.push({
                label: d.name,
                local: true,
                hash: f.hash,
                leaf: f.type !== 'directory',
                owned: true,
                publishedToChain: undefined
            });
        }
        return dirContent;
    }

    public async lsRemote(ipfsPath: string): Promise<TreeNodeItem[]> {
        const job = new IpfsLsJob(ipfsPath, this.ipfs);
        const ls = await this.jobs.push(job);
        return ls;
    }

    // this is doing a stats on the locally running ipfs, no need to jobify
    public async getHash(ipfsPath: string): Promise<string> {
        return (await this.stats(ipfsPath)).hash;
    }

    // this is doing a stats on the locally running ipfs, no need to jobify
    public async stats(path: string): Promise<any> {
        return await this.ipfs.files.stat(path);
    }

    public async write(name: string, file: File) {
        const buffer = await this.fileToArrayBuffer(file);
        await this.ipfs.files.write(name, buffer, { create: true });
    }
    public async writeAB(name: string, arraybuffer: ArrayBuffer): Promise<void> {
        await this.ipfs.files.write(name, Buffer.from(arraybuffer), { create: true });
    }

    public async writeRaw(name: string, payload: string): Promise<void> {
        const buffer = Buffer.from(payload);
        await this.ipfs.files.write(name, buffer, { create: true });
    }

    public async read(name: string): Promise<Blob> {
        return new Blob([new Uint8Array((await this._read(name)).content)]);
    }

    public async readAsString(name: string): Promise<string> {
        return (await this._read(name)).toString();
    }

    private async _read(name: string): Promise<any> {
        const job = new IpfsCatJob(name, this.ipfs);
        const data = await this.jobs.push(job);
        return data;
    }

    // despite this is a remote-ipfs action we do not jobify this - as it is only used during DownloadJobs
    public async get(node: TreeNodeItem): Promise<IpfsFile[]> {
        const files = await this.ipfs.get(node.hash);
        const result = files.map(f => {
            const b = new Blob([new Uint8Array(f.content)]);
            return { blob: b, name: node.label };
        });
        return result;
    }

    public async createFolder(path: string) {
        return await this.ipfs.files.mkdir(path);
    }

    public async removeNode(path: string, ignoreNotExisting?: boolean) {
        try {
            return await this.ipfs.files.rm(path, { recursive: true });
        } catch (error) {
            if (ignoreNotExisting) {
                console.log(`we ignore that ${path} is not here`);
            } else {
                throw error;
            }
        }
    }

    private fileToArrayBuffer(file: File): Promise<Buffer> {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();

            reader.onerror = function onerror(ev) {
                reject();
            };

            reader.onload = function onload(ev: ProgressEvent) {
                const buffer = Buffer.from(this.result as ArrayBuffer);
                return resolve(buffer);
            };

            reader.readAsArrayBuffer(file);
        });
    }

    public async addPin(hash: string) {
        if (hash.length > 0) {
            console.log('adding pin: ' + hash);
            try {
                await this.ipfs.pin.add(hash);
                console.log('pinning is done for hash ' + hash);
            } catch (e) {
                console.log('pinning unsuccessful');
            }
        }
    }

    public async movePin(oldHash: string, newHash: string) {
        console.log(`moving pin: ${oldHash} -> ${newHash}`);
        await this.addPin(newHash);
        await this.delPin(oldHash);
    }

    public async delPin(hash: string) {
        if (hash.length > 0) {
            console.log('removing pin: ' + hash);
            try {
                await this.ipfs.pin.rm(hash);
                console.log('removed pin: ' + hash);
            } catch (e) {
                console.log('unpinning unsuccessfull');
            }
        }
    }

    public updateStatsBwRunning = false;
    public statsBw = null;
    public async updateStatsBw(){
        this.updateStatsBwRunning = true;
        const statisticsFrom = await this.ipfs.stats.bw();
        this.statsBw = [
            {
                key: "incoming total", value: this.bytesToReadable(statisticsFrom.totalIn) 
            },
            {
                key: "incoming rate", value: this.bytesToReadable(statisticsFrom.rateIn) + "/s"
            },
            {
                key: "outgoing total", value: this.bytesToReadable(statisticsFrom.totalOut)
            },
            {
                key: "outgoing rate", value: this.bytesToReadable(statisticsFrom.rateOut) + "/s"
            }
        ]
        
        this.updateStatsBwRunning = false;
    }
    private bytesToReadable(incoming) {
        let suffix = "B";
        if (incoming > 1024){
            incoming /= 1024;
            suffix = "kB";
        }
        if (incoming > 1024){
            incoming /= 1024;
            suffix = "MB";
        }
        if (incoming > 1024){
            incoming /= 1024;
            suffix = "GB";
        }
        incoming = incoming.toFixed(3);
        return incoming + " " + suffix;
    }
}
