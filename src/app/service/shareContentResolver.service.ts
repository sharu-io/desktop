import { Resolve, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ShareService } from './share.service';
import { Injectable } from '@angular/core';
import { RedirectedContent } from '../model/redirectedContent.model';

@Injectable({
    providedIn: 'root'
})
export class ShareContentResolverService implements Resolve<RedirectedContent> {
    constructor(
        private ss: ShareService,
    ) { }

    async resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<RedirectedContent> {
        const rootHash = route.paramMap.get('rootHash');
        const folderHash = route.paramMap.get('folderHash');
        if (!rootHash) {
            // this.bs.set(false);
            return null;
        }
        const share = await this.ss.getNodeByHash(rootHash);
        this.ss.setSelectedShare(share);
        const directory = await this.ss.getNodeByHash(rootHash, folderHash);
        // this.bs.set(false);
        return { share, directory };
    }
}
