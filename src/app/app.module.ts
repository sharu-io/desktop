import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FileUploadModule } from 'primeng/fileupload';
import { TreeModule } from 'primeng/tree';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MenuModule } from 'primeng/menu';
import { PanelModule } from 'primeng/panel';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BlockUIModule } from 'primeng/blockui';
import { AccordionModule } from 'primeng/accordion';
import { LocalStorageModule } from 'angular-2-local-storage';
import { AppRoutingModule } from './app-routing.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { NgxElectronModule } from 'ngx-electron';
import { ElectronService } from './service/electron.service';
import { AppComponent } from './app.component';
import { HomeComponent } from './components/home/home.component';
import { EthWalletService } from './service/ethWallet.service';
import { IpfsService } from './service/ipfs.service';
import { RsaCryptoService } from './service/rsaCrypto.service';
import { AesCryptoService } from './service/aesCrypto.service';
import { CryptoService } from './service/crypto.service';
import { FileService } from './service/file.service';
import { SharuSettingsComponent } from './components/sharu-settings/sharu-settings.component';
import { SettingsService } from './service/settings.service';
import {
  MatGridListModule,
  MatTableModule,
  MatExpansionModule,
  MatTooltipModule,
  MatInputModule,
  MatButtonModule,
  MatCardModule,
  MatMenuModule,
  MatToolbarModule,
  MatIconModule,
  MatSidenavModule,
  MatListModule,
  MatAutocompleteModule,
  MatSnackBarModule,
  MatBadgeModule,
  MatTabsModule,
  MatChipsModule
} from '@angular/material';
import { WalletComponent } from './components/wallet/wallet.component';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { BlockService } from './service/block.service';
import { ShareListComponent } from './components/share-list/share-list.component';
import { ShareService } from './service/share.service';
import { ShareContentComponent } from './components/share-content/share-content.component';
import { ShareContentResolverService } from './service/shareContentResolver.service';
import { LocalShareContentResolverService } from './service/localShareContentResolver.service';
import { ContactsComponent } from './components/contacts/contacts.component';
import { ContactService } from './service/contact.service';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { SidebarService } from './service/sidebar.service';
import { JobsComponent } from './components/jobs/jobs.component';
import { JobsService } from './service/jobs.service';
import { ShowMnemonicComponent } from './components/show-mnemonic/show-mnemonic.component';
import { DndDirective } from './components/share-content/filednd.directive';
import { Location } from '@angular/common';
import { SharuSettingsService } from './service/sharusettings.service';
import { AvatarModule } from 'ng2-avatar';
import { MessageService } from 'primeng/api';
import { InviteService } from './service/invite.service';
import { InvitesComponent } from './components/invites/invites.component';
import { LicenceService } from './service/licence.service';
import { LicenceComponent } from './components/licence/licence.component';
import { StatisticsComponent } from './components/statistics/statistics.component';
import { StatisticsService } from './service/statistics.service';

// AoT requires an exported function for factories
export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    SharuSettingsComponent,
    WalletComponent,
    ShareListComponent,
    ShareContentComponent,
    ContactsComponent,
    SidebarComponent,
    JobsComponent,
    InvitesComponent,
    ShowMnemonicComponent,
    LicenceComponent,
    DndDirective,
    StatisticsComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    AppRoutingModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: (HttpLoaderFactory),
        deps: [HttpClient]
      }
    }),
    FileUploadModule,
    TreeModule,
    ButtonModule,
    DialogModule,
    BrowserAnimationsModule,
    MenuModule,
    PanelModule,
    ToastModule,
    MatButtonModule,
    MatMenuModule,
    MatCardModule,
    MatToolbarModule,
    MatIconModule,
    MatSidenavModule,
    MatBadgeModule,
    MatListModule,
    MatInputModule,
    MatExpansionModule,
    MatTooltipModule,
    MatAutocompleteModule,
    MatTableModule,
    ReactiveFormsModule,
    ProgressSpinnerModule,
    BlockUIModule,
    MatSnackBarModule,
    MatGridListModule,
    MatChipsModule,
    AccordionModule,
    ToastModule,
    MatTabsModule,
    AvatarModule.forRoot(),
    LocalStorageModule.withConfig({
      prefix: 'sharu',
      storageType: 'localStorage'
    }),
    NgxElectronModule
  ],
  providers: [
    ElectronService,
    EthWalletService,
    IpfsService,
    CryptoService,
    RsaCryptoService,
    AesCryptoService,
    FileService,
    SettingsService,
    BlockService,
    ShareService,
    ShareContentResolverService,
    LocalShareContentResolverService,
    ContactService,
    InviteService,
    SidebarService,
    JobsService,
    SharuSettingsService,
    Location,
    LicenceService,
    MessageService,
    StatisticsService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
