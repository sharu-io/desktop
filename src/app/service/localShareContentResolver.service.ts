import { TreeNodeItem } from '../model/treeNodeItem.model';
import { Resolve, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ShareService } from './share.service';
import { Injectable } from '@angular/core';
import { RedirectedContent } from '../model/redirectedContent.model';

@Injectable({
    providedIn: 'root',
})
export class LocalShareContentResolverService implements Resolve<RedirectedContent> {
    constructor(
        private ss: ShareService,
    ) { }

    async resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<RedirectedContent> {
        const rootHash = route.paramMap.get('rootHash');
        const localPath = route.paramMap.get('localPath');
        let directory: TreeNodeItem;
        await this.ss.loadChildren(rootHash);
        const share = await this.ss.getNodeByHash(rootHash);
        this.ss.setSelectedShare(share);
        if (localPath) {
            await share.localMatch;
            directory = await this.ss.loadChildrenByLocal(localPath);
        }
        return { share, directory };
    }
}
