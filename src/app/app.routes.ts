import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ImplementationComponent } from './features/implementation/implementation.component';
import { MeetingsComponent } from './features/meetings/meetings';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'implementation', component: ImplementationComponent },
  { path: 'meetings', component: MeetingsComponent },
  { path: '**', redirectTo: 'dashboard' }
];
