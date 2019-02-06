import { Directive, HostBinding, HostListener, Input } from '@angular/core';
import { TreeNodeItem } from '../../model/treeNodeItem.model';
import { ShareService } from '../../service/share.service';
import { ElectronService } from 'ngx-electron';

@Directive({
  selector: '[fileDnd]'
})

export class DndDirective {
  @Input()
  selectedNode: TreeNodeItem;

  @HostBinding('style.background') private background = '#303030';

  constructor(
    private ss: ShareService,
    private electron: ElectronService
  ) { }

  @HostListener('dragover', ['$event']) public onDragOver(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    this.background = '#999';
  }

  @HostListener('dragleave', ['$event']) public onDragLeave(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    this.background = '#303030';
  }

  @HostListener('drop', ['$event']) public async onDrop(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    this.background = '#303030';
    const files = evt.dataTransfer.files;
    if (files.length > 0) {
      if (this.electron.isElectronApp) {

        await this.ss.uploadStreamed(this.selectedNode, Array.from(files).map((f: any) => f.path));
      } else {
        await this.ss.upload(this.selectedNode, files);
      }
    }
  }
}
