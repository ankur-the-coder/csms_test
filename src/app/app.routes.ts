import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ImplementationComponent } from './features/implementation/implementation.component';

import { Dashboard } from './features/onboarding/components/dashboard/dashboard';

import { MeetingsComponent } from './features/meetings/meetings';
import { Client } from './features/client/client/client';
import { Training } from './features/trainings/Dashboard/training/training';


export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'implementation', component: ImplementationComponent },
  { path: 'onboarding', component: Dashboard },
  { path: 'training', component: Training},
  { path: 'meetings', component: MeetingsComponent },
  { path: 'client', component: Client },
  { path: '**', redirectTo: 'dashboard' }
];
