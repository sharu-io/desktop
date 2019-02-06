import { Injectable } from '@angular/core';
import { TreeNodeItem } from '../model/treeNodeItem.model';
import { IpfsFile } from '../model/ipfsFile.model';
import { FileService } from './file.service';
import { SharuIcons } from '../model/icon.model';
import { IpfsUtils } from '../util/ipfs.utils';
import { ToastService } from './toast.service';
import Semaphore from 'semaphore-async-await';

const RETRIES = 3;

export interface JobItem<T> {
    type: string;
    name: string;
    icon: string;
    currentActivity: string;
    isResolved: boolean;
    toast: boolean;
    start(): Promise<T>;
    print(): string;
}

export class IpfsLsJob implements JobItem<TreeNodeItem[]> {
    type = 'IPFS Directory scan';
    currentActivity: string;
    name: string;
    icon: string;
    toast = false;
    isResolved = false;
    retries = RETRIES;

    constructor(private ipfsPath: string, private ipfs: any) {
        this.name = ipfsPath;
        this.icon = 'folder';
    }

    public async start(): Promise<TreeNodeItem[]> {
        this.currentActivity = 'looking up';

        try {
            const ls = await this.ipfs.ls(this.ipfsPath);
            if (ls == null) {
                console.log('ls returned nothing, throwing');
                throw new Error('ls returned nothing');
            }
            this.currentActivity = 'transforming';
            const list = IpfsUtils.translateLsToTreenodeItemList(ls);
            this.currentActivity = 'done';
            this.isResolved = true;
            return list;
        } catch (e) {
            if (this.retries > 0) {
                console.log(`... retrying ${this.print()} one more time (remaining retries: ${this.retries})`);
                this.retries -= 1;
                return this.start();
            } else {
                throw e;
            }
        }
    }

    public print(): string {
        return `IpfsLs: ${this.name}`;
    }
}

export class IpfsCatJob implements JobItem<any> {
    type = 'IPFS Cat';
    currentActivity: string;
    name: string;
    icon: string;
    isResolved = false;
    toast = false;
    retries = RETRIES;

    constructor(private hash: string, private ipfs: any) {
        this.name = hash;
        this.icon = 'get_app';
    }

    public async start(): Promise<any> {
        this.currentActivity = 'looking up';
        try {
            const data = await this.ipfs.cat(this.hash);
            if (data == null) {
                console.log('cat returning nothing, throwing');
                throw new Error('cat returned nothing');
            }
            this.currentActivity = 'done!';
            this.isResolved = true;
            return data;
        } catch (e) {
            if (this.retries > 0) {
                console.log(`... retrying ${this.print()} one more time (remaining retries: ${this.retries})`);
                this.retries -= 1;
                return this.start();
            } else {
                throw e;
            }
        }
    }

    public print(): string {
        return `IpfsCat: ${this.name}`;
    }
}

export class DownloadJob implements JobItem<IpfsFile> {
    type = 'Download';
    name: string;
    icon: string;
    currentActivity: string;
    isResolved = false;
    toast = false;
    retries = RETRIES;
    private toDownload: TreeNodeItem;

    constructor(
        node: TreeNodeItem,
        private file: FileService
    ) {
        this.toDownload = node;
        this.name = node.label;
        this.icon = 'cloud_download';
    }

    public async start(): Promise<IpfsFile> {
        // fetch content from ipfs
        this.currentActivity = 'downloading crypted content from ipfs';
        try {
            const encrypted = await this.file.getCryptedContent(this.toDownload);
            if (encrypted == null) {
                console.log('download returned nothing, throwing');
                throw new Error('download encrypted returned nothing');
            }
            this.currentActivity = 'decrypting content';
            const decrypted = await this.file.decryptContent(this.toDownload, encrypted);
            this.isResolved = true;
            return decrypted;
        } catch (e) {
            if (this.retries > 0) {
                console.log(`... retrying ${this.print()} one more time (remaining retries: ${this.retries})`);
                this.retries -= 1;
                return this.start();
            } else {
                throw e;
            }
        }
    }

    public print(): string {
        return `Download: ${this.name}`;
    }
}
export class UploadJob implements JobItem<void> {
    type = 'Upload';
    name: string;
    icon: string;
    currentActivity: string;
    toast = false;
    isResolved = false;
    retries = RETRIES;

    constructor(
        private file: File,
        private dir: TreeNodeItem,
        private fileservice: FileService
    ) {
        this.name = file.name;
        this.icon = 'cloud_upload';
    }

    public async start(): Promise<void> {
        this.currentActivity = 'encrypting file';

        try {
            const crypted = await this.fileservice.encryptFile(this.dir, this.file);
            this.currentActivity = 'uploading to ipfs';
            const newFile = await this.fileservice.uploadCrypted(this.dir, this.file, crypted);
            if (newFile == null) {
                console.log('upload crypted returned nothing, throwing');
                throw new Error('upload crypted returned nothing');
            }
            this.currentActivity = 'uploading done';
            SharuIcons.setIcon(newFile);
            this.dir.children.push(newFile);
            this.isResolved = true;
        } catch (e) {
            if (this.retries > 0) {
                console.log(`... retrying ${this.print()} one more time (remaining retries: ${this.retries})`);
                this.retries -= 1;
                return this.start();
            } else {
                throw e;
            }
        }

    }

    public print(): string {
        return `Upload: ${this.name}`;
    }
}

export class DownloadStreamedJob implements JobItem<void> {
    type = 'Download';
    name: string;
    icon: string;
    currentActivity: string;
    isResolved = false;
    toast = false;
    retries = RETRIES;
    private toDownload: TreeNodeItem;

    constructor(
        node: TreeNodeItem,
        private filePath: string,
        private file: FileService
    ) {
        this.toDownload = node;
        this.name = node.label;
        this.icon = 'cloud_download';
    }

    public async start(): Promise<void> {
        // fetch content from ipfs
        this.currentActivity = 'downloading crypted content from ipfs';
        try {
            await this.file.downloadDecryptStreamed(this.toDownload, this.filePath);
            this.isResolved = true;
        } catch (e) {
            if (this.retries > 0) {
                console.log(`... retrying ${this.print()} one more time (remaining retries: ${this.retries})`);
                this.retries -= 1;
                return this.start();
            } else {
                throw e;
            }
        }
    }

    public print(): string {
        return `Download: ${this.name}`;
    }
}

export class UploadStreamedJob implements JobItem<void> {
    static mutex = new Semaphore(1);
    type = 'Upload';
    name: string;
    icon: string;
    currentActivity: string;
    toast = false;
    isResolved = false;
    retries = RETRIES;

    constructor(
        private fileName: string,
        private filePath: string,
        private dir: TreeNodeItem,
        private fileservice: FileService
    ) {
        this.name = fileName;
        this.icon = 'cloud_upload';
    }

    public async start(): Promise<void> {
        this.currentActivity = 'waiting';
        await UploadStreamedJob.mutex.acquire();
        try {
            await this.executeInMutex();
        } finally {
            UploadStreamedJob.mutex.release();
        }
    }

    private async executeInMutex(): Promise<void> {
        this.currentActivity = 'encrypting file';
        try {
            await this.fileservice.encryptUploadStreamed(this.dir, this.fileName, this.filePath);
            this.currentActivity = 'uploading done';
            this.isResolved = true;
        } catch (e) {
            if (this.retries > 0) {
                console.log(`... retrying ${this.print()} one more time (remaining retries: ${this.retries})`);
                this.retries -= 1;
                return this.executeInMutex();
            } else {
                throw e;
            }
        }
    }

    public print(): string {
        return `Upload: ${this.name}`;
    }
}

@Injectable({
    providedIn: 'root'
})
export class JobsService {
    constructor(private toast: ToastService) { }
    jobs: JobItem<any>[] = [];

    async push(job: JobItem<any>): Promise<any> {
        const val = job.start();
        setTimeout(() => {
            if (!job.isResolved) {
                this.jobs.push(job);
            }
        }, 50);
        setTimeout(() => {
            if (!job.isResolved) {
                job.toast = true;
            }
        }, 1000);
        val.then(() => {
            this.removeJob(job);
        });
        val.catch(error => {
            console.error(error);
            this.toast.notify('error', job.type + ' failed', job.print() + ' - ' + error);
            this.removeJob(job);
        });
        return val;
    }

    private async removeJob(job: JobItem<any>) {
        this.jobs = this.jobs.filter(f => {
            return f !== job;
        });
        if (job.toast) {
            this.toast.notify('success', job.type + ' done!', job.name);
        }

    }
}
