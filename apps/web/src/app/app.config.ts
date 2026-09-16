import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { CastService } from './core/cast.service';
import { SessionService } from './core/session.service';
import { DataService } from './core/data.service';

/* Boot: the runtime config (where the API is), then a saved seat if there is one,
   which carries the cast and paints the palette, then the data. No seat means the
   front door. The hash is the router so GitHub Pages deep-links without rewrites. */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideAppInitializer(async () => {
      const cast = inject(CastService), session = inject(SessionService), data = inject(DataService);
      await cast.loadConfig();
      if (session.restore()) await data.init(); else await cast.loadStatic();
      /* the owner's saved names and hours, kept in this browser in the demo */
      try { const c = cast.cast(); const o = c && localStorage.getItem('wos_override_' + c.slug); if (c && o) cast.use({ ...c, ...JSON.parse(o) }); } catch {}
    })
  ]
};
