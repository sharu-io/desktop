import { Component, OnInit } from '@angular/core';
import { ContactService } from '../../service/contact.service';
import { FormControl } from '@angular/forms';

@Component({
  selector: 'contacts',
  templateUrl: './contacts.component.html',
  styleUrls: ['./contacts.component.scss']
})
export class ContactsComponent implements OnInit {
  public wallet = new FormControl();
  public name = new FormControl();
  constructor(
    public cs: ContactService
  ) { }

  ngOnInit() {
  }
}
