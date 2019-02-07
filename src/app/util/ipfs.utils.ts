import { TreeNodeItem } from '../model/treeNodeItem.model';

export class IpfsUtils {
    static translateLsToTreenodeItemList(dirs: any) {
        const content: TreeNodeItem[] = [];
        dirs.forEach(d => {
            content.push({
                size: d.size,
                label: d.name,
                leaf: d.type !== 'dir',
                publishedToChain: undefined,
                hash: d.hash,
                owned: undefined
            });
        });
        // Remove hash of an empty folder
        return content.filter(f => {
            return f.hash !== 'QmRtWtTtisLmK6ymGtNroBPF7R11sWaqR6ibfy3RPYBqRM';
        });
    }
}
