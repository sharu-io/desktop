import { TreeNodeItem } from './treeNodeItem.model';

export class SharuIcon {
    readonly name: string;
    readonly description: string;
    constructor(name: string, description: string) {
        this.name = name;
        this.description = description;
    }
}

export class SharuIcons {
    static readonly none = new SharuIcon('', '');
    static readonly desynced = new SharuIcon('error', 'not yet synced');
    static readonly ownShare = new SharuIcon('folder', 'Share is owned by you');
    static readonly receivedShare = new SharuIcon('folder_shared', 'Shared with you');

    static readonly remoteShare = new SharuIcon('cloud', 'share is available remotely');
    static readonly localShare = new SharuIcon('laptop', 'share is available locally');

    static readonly folder = new SharuIcon('folder', 'Folder');
    static readonly file = new SharuIcon('note', 'File');

    public static setIcon(node: TreeNodeItem) {
        if (node.icon === null || node.icon === undefined) {
            if (node.leaf === false) {
                node.icon = SharuIcons.folder;
            } else {
                node.icon = SharuIcons.file;
            }
        }
    }

    public static updateIcons(nodes: TreeNodeItem[]) {
        // set icons
        nodes.forEach(node => {
            this.setIcon(node);
        });
    }
}
