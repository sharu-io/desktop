import { Component, OnInit } from '@angular/core';
import { SettingsService } from '../../service/settings.service';
import { CryptoService } from '../../service/crypto.service';
import { FormControl } from '@angular/forms';

@Component({
  selector: 'sharu-settings',
  templateUrl: './sharu-settings.component.html',
  styleUrls: ['./sharu-settings.component.scss']
})
export class SharuSettingsComponent implements OnInit {

  constructor(private settings: SettingsService, private cs: CryptoService) { }
  public restartNeeded = false;

  public server = new FormControl();
  public port = new FormControl();

  ngOnInit() {
    this.server.setValue(this.settings.getIpfsConfig().server);
    this.port.setValue(this.settings.getIpfsConfig().port);
  }
  save(server: string, port: string) {
    this.settings.setIpfsConfig({ server, port });
    this.server.setValue(server);
    this.port.setValue(port);
    this.restartNeeded = true;
  }
}
