import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideAppInitializer, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { firstValueFrom, of } from 'rxjs';


import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { authInterceptor } from './core/interseptor/auth-interceptor';
import { AuthService } from './core/services/auth-service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAnimations(),
    provideToastr({
      timeOut: 3500,
      positionClass: 'toast-top-right',
      preventDuplicates: true,
      progressBar: false,
      closeButton: true
    }),

    provideAppInitializer(() => {
      const platformId = inject(PLATFORM_ID);
      const auth = inject(AuthService);
      if (isPlatformBrowser(platformId)) {
        if (auth.getToken()) {
          return firstValueFrom(auth.autoLogin()).catch(() => of(false));
        }
      }
      return Promise.resolve();
    }),
  ]
};
