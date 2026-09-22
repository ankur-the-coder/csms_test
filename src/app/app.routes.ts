import { Routes } from '@angular/router';
import { Dashboard } from './features/onboarding/components/dashboard/dashboard';
import { MeetingsComponent } from './features/meetings/meetings';
import { AddOnboarding } from './features/onboarding/components/add-onboarding/add-onboarding';
import { Client } from './features/client/client/client';
import { ScheduleMeeting } from './features/meetings/schedule-meeting/schedule-meeting';
import { Implementation } from './features/implementations/component/implementation/implementation/implementation';
import { Training } from './features/trainings/Component/training/training';
import { TrainingMaterials } from './features/trainings/Component/training-materials/training-materials';
import { VoiceShell } from './features/voice/voice-shell/voice-shell.component';
import { Softphone } from './features/voice/pages/softphone/softphone';
import { History } from './features/voice/pages/history/history';
import { Recordings } from './features/voice/pages/recordings/recordings';
import { Clients } from './features/voice/pages/clients/clients';
import { Login } from './layout/login/login';
import { Layout } from './layout/layout';
import { DashboardComponent } from './features/dashboard/component/dashboard/dashboard';
import { CourseCatalog } from './features/user/components/course-catalog/course-catalog';
import { CourseDetail } from './features/user/components/course-detail/course-detail';
import { MyLearning } from './features/user/components/my-learning/my-learning';
import { UserShell } from './features/user/user-shell/user-shell';
import { authGuard, checkGuard } from './core/guards/auth-guard';
import { VoiceAnalyticsDashboard } from './features/voice/pages/dashboard/voice-dashboard';
import { Feedback } from './features/dashboard/component/feedback/feedback';
import { Connected } from './features/dashboard/component/connected/connected';
import { Usages } from './features/dashboard/component/usages/usages';
import { ClientDashboard } from './features/client/client-dashboard/client-dashboard';
import { RenewalComponent } from './features/dashboard/component/renewal-component/renewal-component';
import { PendingRenewal } from './features/dashboard/component/pending-renewal/pending-renewal';


export const routes: Routes = [
  // Login renders standalone — no sidebar/navbar wrapper.
  {
    path: 'login', component: Login,
    canActivate: [checkGuard]
  },
  // User-facing learning pages — no login required, wrapped in UserShell with its own sidebar
  {
    path: 'user/courses',
    component: UserShell,
    children: [
      { path: '', component: CourseCatalog },
      { path: 'my-learning', component: MyLearning },
      { path: ':id', component: CourseDetail },
    ],
  },
  // Every other route is a child of Layout, so it renders inside the
  // sidebar + navbar shell (Layout owns its own nested <router-outlet>).
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'voice', pathMatch: 'full' },
      { path: 'help-guide', component: Training },



      { path: 'dashboard', component: DashboardComponent },
      { path: 'implementation', component: Implementation },
      { path: 'meetings', component: MeetingsComponent },
      { path: 'client', component: Client },
      { path: 'feedback', component: Feedback },
      { path: 'renewal', component: RenewalComponent },
      { path: 'pendingrenewal', component: PendingRenewal },
      {
        path: 'voice',
        component: VoiceShell,
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'dashboard', component: VoiceAnalyticsDashboard },
          { path: 'softphone', component: Softphone },
          { path: 'history', component: History },
          // { path: 'notes', component: Notes },
          { path: 'recordings', component: Recordings },
          { path: 'clients', component: Clients },
        ],
      },
      { path: 'meetings/schedule', component: ScheduleMeeting },
      { path: 'trainings/materials', component: TrainingMaterials },
      { path: 'client/client-dashboard', component: ClientDashboard },
      // { path: 'onboarding', component: Dashboard },
      // { path: 'add-onboarding', component: AddOnboarding },
      // { path: 'connected', component: Connected },
      // { path: 'usages', component: Usages },

    ],
  },

  { path: '**', redirectTo: 'login' },
];
