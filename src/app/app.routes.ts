import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { ShellComponent } from './layout/shell.component';
import { LoginComponent } from './features/login/login.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'users', loadComponent: () => import('./features/users/users.component').then(m => m.UsersComponent) },
      { path: 'roles', loadComponent: () => import('./features/roles/roles.component').then(m => m.RolesComponent) },
      { path: 'permissions', loadComponent: () => import('./features/permissions/permissions.component').then(m => m.PermissionsComponent) },
      { path: 'identity-providers', loadComponent: () => import('./features/idp/idp.component').then(m => m.IdpComponent) },
      { path: 'oauth-clients', loadComponent: () => import('./features/oauth/oauth.component').then(m => m.OAuthComponent) },
      { path: 'service-accounts', loadComponent: () => import('./features/service-accounts/service-accounts.component').then(m => m.ServiceAccountsComponent) },
      { path: 'api-clients', loadComponent: () => import('./features/api-clients/api-clients.component').then(m => m.ApiClientsComponent) },
      { path: 'security-policy', loadComponent: () => import('./features/security-policy/security-policy.component').then(m => m.SecurityPolicyComponent) },
      { path: 'auth-config', loadComponent: () => import('./features/auth-config/auth-config.component').then(m => m.AuthConfigComponent) },
      { path: 'audit-logs', loadComponent: () => import('./features/audit/audit.component').then(m => m.AuditComponent) },
      { path: 'sessions', loadComponent: () => import('./features/sessions/sessions.component').then(m => m.SessionsComponent) }
    ]
  },
  { path: '**', redirectTo: '' }
];
