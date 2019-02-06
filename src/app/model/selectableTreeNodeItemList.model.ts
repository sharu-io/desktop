import { TreeNodeItem } from './treeNodeItem.model';

export interface SelectableTreeNodeItemList {
    items: TreeNodeItem[];
    selected: TreeNodeItem;
}
