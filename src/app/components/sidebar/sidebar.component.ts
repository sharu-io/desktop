import { Component, OnInit } from '@angular/core';
import { SidebarService } from '../../service/sidebar.service';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  constructor(
    public sbs: SidebarService
  ) { }

  ngOnInit() {
  }
}
