import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ImplementationComponent } from './features/implementation/implementation.component';
import { Dashboard } from './features/onboarding/components/dashboard/dashboard';
import { MeetingsComponent } from './features/meetings/meetings';
import { AddOnboarding } from './features/onboarding/components/add-onboarding/add-onboarding';
import { Client } from './features/client/client/client';
import { Training } from './features/trainings/Dashboard/training/training';
import { ScheduleMeeting } from './features/meetings/schedule-meeting/schedule-meeting';
import { MyTraining } from './features/trainings/my-training/my-training';
import { TrainingMaterials } from './features/trainings/training-materials/training-materials';
;

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'implementation', component: ImplementationComponent },
  { path: 'training', component: Training},
  { path: 'onboarding', component: Dashboard },
  { path: 'add-onboarding', component: AddOnboarding },
  { path: 'meetings', component: MeetingsComponent },
  { path: 'client', component: Client },
  { path: 'meetings/schedule', component: ScheduleMeeting },
  { path: 'trainings/my-training', component: MyTraining },
  { path: 'trainings/materials', component: TrainingMaterials },
  { path: '**', redirectTo: 'dashboard' }
];
