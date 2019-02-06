import { Component, OnInit } from '@angular/core';
import { SidebarService } from '../../service/sidebar.service';

@Component({
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
