import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

/* DEMO ONLY (T1, 16 Oct 2026): ?tier=1, 2 or 3 shows the demo garage at that tier. The router drops the query string on its
   first navigation, so it is kept for this tab here, before the app starts. A link naming a garage without a tier clears it.
   tiers.ts ignores it for any workshop that is not a local demo. */
try { const q = new URLSearchParams(location.search); if (q.has('tier')) sessionStorage.setItem('wos_demo_tier', q.get('tier') || ''); else if (q.has('c')) sessionStorage.removeItem('wos_demo_tier'); } catch {}
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
