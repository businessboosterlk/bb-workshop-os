import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SessionService } from './core/session.service';
import { WelcomeComponent } from './pages/welcome.component';
import { CustomerLoginComponent } from './pages/customer/login.component';
import { CustomerShellComponent } from './pages/customer/shell.component';
import { CarsComponent } from './pages/customer/cars.component';
import { CustomerJobComponent } from './pages/customer/job.component';
import { CustomerHistoryComponent } from './pages/customer/history.component';
import { CustomerSettingsComponent } from './pages/customer/settings.component';
import { WorkshopLoginComponent } from './pages/workshop/login.component';
import { WorkshopShellComponent } from './pages/workshop/shell.component';
import { FloorComponent } from './pages/workshop/floor.component';
import { WorkshopCarsComponent } from './pages/workshop/cars.component';
import { WorkshopJobComponent } from './pages/workshop/job.component';
import { WorkshopNewComponent } from './pages/workshop/new.component';
import { WorkshopCustomersComponent } from './pages/workshop/customers.component';
import { WorkshopMoneyComponent } from './pages/workshop/money.component';
import { WorkshopSettingsComponent } from './pages/workshop/settings.component';
import { WorkshopActivityComponent } from './pages/workshop/activity.component';
import { WorkshopEnquiriesComponent } from './pages/workshop/enquiries.component';
import { WorkshopQuotesComponent } from './pages/workshop/quotes.component';
import { WorkshopQuoteComponent } from './pages/workshop/quote.component';

/* Two surfaces, two guards. A customer seat never reaches /workshop and a staff seat
   never reaches /car; an owner-only screen does not exist for a staff seat. */
const customer: CanActivateFn = () => { const s = inject(SessionService), r = inject(Router); return s.kind() === 'customer' ? true : r.createUrlTree(['/car/login']); };
const staff: CanActivateFn = () => { const s = inject(SessionService), r = inject(Router); return s.kind() === 'staff' ? true : r.createUrlTree(['/workshop/login']); };
const owner: CanActivateFn = () => { const s = inject(SessionService), r = inject(Router); return s.owner() ? true : r.createUrlTree(['/workshop/floor']); };

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: WelcomeComponent },
  { path: 'car/login', component: CustomerLoginComponent },
  { path: 'car', component: CustomerShellComponent, canActivate: [customer], children: [
    { path: '', pathMatch: 'full', component: CarsComponent, data: { title: 'Your cars' } },
    { path: 'job/:id', component: CustomerJobComponent, data: { title: 'Your car' } },
    { path: 'history', component: CustomerHistoryComponent, data: { title: 'History' } },
    { path: 'settings', component: CustomerSettingsComponent, data: { title: 'Settings' } }
  ] },
  { path: 'workshop/login', component: WorkshopLoginComponent },
  { path: 'workshop', component: WorkshopShellComponent, canActivate: [staff], children: [
    { path: '', pathMatch: 'full', redirectTo: 'floor' },
    { path: 'floor', component: FloorComponent, data: { title: 'The floor' } },
    { path: 'cars', component: WorkshopCarsComponent, data: { title: 'Cars' } },
    { path: 'job/:id', component: WorkshopJobComponent, data: { title: 'Job card' } },
    { path: 'new', component: WorkshopNewComponent, data: { title: 'Car in' } },
    { path: 'enquiries', component: WorkshopEnquiriesComponent, data: { title: 'Enquiries' } },
    { path: 'quotes', component: WorkshopQuotesComponent, canActivate: [owner], data: { title: 'Quotes' } },
    { path: 'quote/:id', component: WorkshopQuoteComponent, canActivate: [owner], data: { title: 'Quote' } },
    { path: 'customers', component: WorkshopCustomersComponent, data: { title: 'Customers' } },
    { path: 'activity', component: WorkshopActivityComponent, data: { title: 'Activity' } },
    { path: 'money', component: WorkshopMoneyComponent, canActivate: [owner], data: { title: 'Money' } },
    { path: 'settings', component: WorkshopSettingsComponent, canActivate: [owner], data: { title: 'Settings' } }
  ] },
  { path: '**', redirectTo: '' }
];
