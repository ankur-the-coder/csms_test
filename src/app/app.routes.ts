import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { Dashboard } from './features/onboarding/components/dashboard/dashboard';
import { MeetingsComponent } from './features/meetings/meetings';
import { AddOnboarding } from './features/onboarding/components/add-onboarding/add-onboarding';
import { Client } from './features/client/client/client';
import { ScheduleMeeting } from './features/meetings/schedule-meeting/schedule-meeting';
import { Implementation } from './features/implementations/component/implementation/implementation/implementation';

import { Training } from './features/trainings/Component/training/training';
import { MyTraining } from './features/trainings/Component/my-training/my-training';
import { TrainingMaterials } from './features/trainings/Component/training-materials/training-materials';


import { Login } from './layout/login/login';
import { Layout } from './layout/layout';
import { authGuard, checkGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  // Login renders standalone — no sidebar/navbar wrapper.
  { path: 'login', component: Login,
    //  canActivate: [checkGuard],
     },

  // Every other route is a child of Layout, so it renders inside the
  // sidebar + navbar shell (Layout owns its own nested <router-outlet>).
  {
    path: '',
    component: Layout,
    // canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'implementation', component: Implementation },
      { path: 'training', component: Training },
      { path: 'onboarding', component: Dashboard },
      { path: 'add-onboarding', component: AddOnboarding },
      { path: 'meetings', component: MeetingsComponent },
      { path: 'client', component: Client },
      { path: 'meetings/schedule', component: ScheduleMeeting },
      { path: 'trainings/my-training', component: MyTraining },
      { path: 'trainings/materials', component: TrainingMaterials },
    ],
  },

  { path: '**', redirectTo: 'login' },
];
    