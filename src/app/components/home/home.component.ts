import { Component, OnInit, ViewEncapsulation, ViewChild, ElementRef } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TreeNodeItem } from '../../model/treeNodeItem.model';
import { ActivatedRoute } from '@angular/router';
import { SidebarService } from '../../service/sidebar.service';
import { JobsService } from '../../service/jobs.service';
import { RedirectedContent } from '../../model/redirectedContent.model';
import { ElectronService } from 'ngx-electron';
import { ToastService } from '../../service/toast.service';
import { InviteService } from '../../service/invite.service';
import { ContactService } from '../../service/contact.service';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [MessageService]
})
export class HomeComponent implements OnInit {
  public showsettings: boolean;
  @ViewChild('file') fileUpload: ElementRef;
  title = 'sharu-frontend2';

  // inherited to share-list
  selectedShare: TreeNodeItem;

  // inherited to share-content
  selectedItem: TreeNodeItem;

  constructor(
    private route: ActivatedRoute,
    public messageService: MessageService,
    public jobs: JobsService,
    public contacts: ContactService,
    public toast: ToastService,
    public invites: InviteService,
    public sbs: SidebarService,
    public ngxElectron: ElectronService) {

  }

  async ngOnInit() {
    this.toast.toasts.subscribe(notification => {
      this.messageService.add(notification);
    });
    this.route.data
      .subscribe((data: {
        selections: RedirectedContent
      }) => {
        if (data.selections) {
          if (data.selections.share !== undefined) {
            this.selectedShare = data.selections.share;
          }
          if (data.selections.directory !== undefined) {
            this.selectedItem = data.selections.directory;
          }
        }
      });
  }

  public toastError(message: string) {
    this.messageService.add({ severity: 'error', summary: 'brickage!', detail: message });
  }

  public openElectronMailTo() {
    if (this.ngxElectron.isElectronApp) {
      this.ngxElectron.shell.openExternal('mailto:feedback@sharu.io');
    } else {
      window.open('mailto:feedback@sharu.io', 'blank');
    }
  }
}
