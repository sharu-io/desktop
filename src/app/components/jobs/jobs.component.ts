import { Component, OnInit } from '@angular/core';
import { JobsService } from '../../service/jobs.service';
import { FileService } from '../../service/file.service';

@Component({
  selector: 'jobs',
  templateUrl: './jobs.component.html',
  styleUrls: ['./jobs.component.scss']
})
export class JobsComponent implements OnInit {

  constructor(
    private fs: FileService,
    public jobs: JobsService,
  ) { }

  ngOnInit() {
  }
}
