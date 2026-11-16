import { storageCfg } from './app/core/storage-prefix';
storageCfg.prefix = 'ubiclient_';

import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { provideRouter, Routes } from '@angular/router';
import { LocationStrategy } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { authInterceptor } from './app/core/interseptor/auth-interceptor';
import { MemoryLocationStrategy } from './app/embed/memory-location.strategy';
import { PortalEmbedComponent, EmbedLogoutComponent } from './app/embed/portal-embed.component';

const EMBED_ROUTES: Routes = [
  { path: 'client-portal', loadChildren: () => import('./app/features/client-portal/client-portal.routes').then(m => m.CLIENT_PORTAL_ROUTES) },
  { path: 'login', component: EmbedLogoutComponent },
  { path: '**', redirectTo: 'client-portal' },
];

(async () => {
  if (customElements.get('ubi-client-portal')) return;
  const app = await createApplication({
    providers: [
      provideRouter(EMBED_ROUTES),
      { provide: LocationStrategy, useClass: MemoryLocationStrategy },
      provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
      provideAnimations(),
      provideToastr({ timeOut: 3500, positionClass: 'toast-top-right', preventDuplicates: true, progressBar: false, closeButton: true }),
    ],
  });
  customElements.define('ubi-client-portal', createCustomElement(PortalEmbedComponent, { injector: app.injector }));
})();
