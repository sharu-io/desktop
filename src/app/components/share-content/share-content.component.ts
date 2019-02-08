import { Component, OnInit, Input, ViewChild, ElementRef, ViewEncapsulation } from '@angular/core';
import { ShareService } from '../../service/share.service';
import { TreeNodeItem } from '../../model/treeNodeItem.model';
import { FileService } from '../../service/file.service';
import { MessageService } from 'primeng/api';
import { JobsService, DownloadJob, DownloadStreamedJob } from '../../service/jobs.service';
import { FormControl, Validators, ValidatorFn, AbstractControl } from '@angular/forms';
import { ElectronService } from 'ngx-electron';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'share-content',
  templateUrl: './share-content.component.html',
  styleUrls: ['./share-content.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [MessageService]
})
export class ShareContentComponent implements OnInit {
  @ViewChild('file') fileUpload: ElementRef;

  constructor(
    private ss: ShareService, // needed by html, do not remove
    private fileService: FileService,
    private jobs: JobsService, // needed by html, do not remove
    private ngxElectron: ElectronService
  ) {
  }
  @Input()
  selected: TreeNodeItem;
  @Input()
  fromShare: TreeNodeItem;

  item2delete: TreeNodeItem = null;
  newFolderControl = new FormControl('', [
    Validators.pattern('^[a-zA-Z0-9 ]{1,30}$'),
    this.existingFolderNameValidator()
  ]);

  public isFolderNameValid(): boolean {
    const isNull: boolean = (this.newFolderControl.value === null)
      || (this.newFolderControl.value === undefined)
      || (this.newFolderControl.value.length === 0);
    return !this.newFolderControl.hasError('pattern') && !this.newFolderControl.hasError('nameAlreadyAvailable') && !isNull;
  }

  existingFolderNameValidator(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: boolean } | null => {
      if (this.selected === null
        || this.selected === undefined
        || this.selected.children === null
        || this.selected.children === undefined) {
        return null;
      }
      const foundFolderWithSameName = this.selected.children.filter(item => (!item.leaf && (item.label === control.value)));
      if (foundFolderWithSameName !== null && foundFolderWithSameName.length > 0) {
        return { 'nameAlreadyAvailable': true };
      }
      return null;
    };
  }

  ngOnInit() {
  }

  public async downloadFile(node: TreeNodeItem) {

    if (this.ngxElectron.isElectronApp) {
      const app = require('electron');
      app.remote.dialog.showSaveDialog({ defaultPath: node.label }, async (filePath) => {
        if (filePath) {
          const job: DownloadStreamedJob = new DownloadStreamedJob(node, filePath, this.fileService);
          const f = await this.jobs.push(job);
        } else {
          console.log('no target for download specified, aborting');
        }
      });
    } else {
      const job: DownloadJob = new DownloadJob(node, this.fileService);
      const f = await this.jobs.push(job);

      const a = document.createElement('a');
      document.body.appendChild(a);
      const url = window.URL.createObjectURL(f.blob);
      a.href = url;
      a.download = f.name;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  }

  public async upload() {
    if (this.ngxElectron.isElectronApp) {
      const app = require('electron');
      app.remote.dialog.showOpenDialog({ properties: ['openFile'] }, async (filePaths) => {
        this.ss.uploadStreamed(this.selected, filePaths);
      });
    } else {
      const files = this.fileUpload.nativeElement.files;
      await this.ss.upload(this.selected, files);
      this.fileUpload.nativeElement.value = '';
    }
  }

  public uploadWebDialog() {
    if (!this.ngxElectron.isElectronApp) {
      this.fileUpload.nativeElement.click();
    }
  }
}
