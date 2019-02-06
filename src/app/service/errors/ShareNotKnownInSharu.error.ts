import { TreeNodeItem } from '../../model/treeNodeItem.model';

export class ShareNotKnownInSharu extends Error {
    readonly share: TreeNodeItem;
    constructor(share: TreeNodeItem) {
        super();
        this.share = share;
        Object.setPrototypeOf(this, ShareNotKnownInSharu.prototype);
    }
}
