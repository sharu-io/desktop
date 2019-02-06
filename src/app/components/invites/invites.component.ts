import { Component } from '@angular/core';
import { InviteService } from '../../service/invite.service';
import { SettingsService } from '../../service/settings.service';

@Component({
  selector: 'invites',
  templateUrl: './invites.component.html',
  styleUrls: ['./invites.component.scss']
})
export class InvitesComponent {

  constructor(
    public invites: InviteService,
    public settings: SettingsService
  ) { }
}
