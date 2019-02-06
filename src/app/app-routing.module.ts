import { HomeComponent } from './components/home/home.component';
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ShareContentResolverService } from './service/shareContentResolver.service';
import { LocalShareContentResolverService } from './service/localShareContentResolver.service';
import { DependencyGuard } from './dependency.guard';
import { WalletGuard } from './wallet.guard';
import { LicenceGuard } from './licence.guard';

const routes: Routes = [
    {
        path: 'local/:rootHash/:localPath',
        component: HomeComponent,
        canActivate: [LicenceGuard, WalletGuard, DependencyGuard],
        resolve: {
            selections: LocalShareContentResolverService
        }
    },
    {
        path: 'share/:rootHash/:folderHash',
        component: HomeComponent,
        canActivate: [LicenceGuard, WalletGuard, DependencyGuard],
        resolve: {
            selections: ShareContentResolverService
        }
    },
    {
        path: 'share/:rootHash',
        component: HomeComponent,
        canActivate: [LicenceGuard, WalletGuard, DependencyGuard],
        resolve: {
            selections: ShareContentResolverService
        }
    },
    {
        path: '',
        component: HomeComponent,
        canActivate: [LicenceGuard, WalletGuard, DependencyGuard],
        resolve: {
            selections: ShareContentResolverService

        }
    }
];

@NgModule({
    imports: [RouterModule.forRoot(routes, { useHash: true, onSameUrlNavigation: 'reload' })],
    exports: [RouterModule]
})
export class AppRoutingModule { }
