import { Component, computed } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { UiService } from '../core/ui.service';

@Component({
  selector:'app-shell',
  standalone:true,
  imports:[RouterOutlet, RouterLink, RouterLinkActive],
  template:`
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">SP3</div><div><b>SP3 Digital</b><small>Identity Admin</small></div></div>
      <nav>
        <a routerLink="/dashboard" routerLinkActive="active">▦ <span>Dashboard</span></a>
        <div class="nav-label">IDENTITY</div>
        <a routerLink="/users" routerLinkActive="active">◉ <span>Users</span></a>
        <a routerLink="/roles" routerLinkActive="active">◆ <span>Roles</span></a>
        <a routerLink="/permissions" routerLinkActive="active">◇ <span>Permissions</span></a>
        <a routerLink="/identity-providers" routerLinkActive="active">⇄ <span>Identity Providers</span></a>
        <a routerLink="/sessions" routerLinkActive="active">◷ <span>Sessions</span></a>
        <div class="nav-label">APPLICATIONS</div>
        <a routerLink="/oauth-clients" routerLinkActive="active">▣ <span>OAuth / OIDC Clients</span></a>
        <a routerLink="/api-clients" routerLinkActive="active">⌘ <span>API Clients</span></a>
        <a routerLink="/service-accounts" routerLinkActive="active">⚙ <span>Service Accounts</span></a>
        <div class="nav-label">SECURITY</div>
        <a routerLink="/security-policy" routerLinkActive="active">◈ <span>Security Policy</span></a>
        <a routerLink="/auth-config" routerLinkActive="active">⚿ <span>Auth Configuration</span></a>
        <a routerLink="/audit-logs" routerLinkActive="active">☷ <span>Audit Logs</span></a>
      </nav>
      <div class="sidebar-foot">Tenant<br><strong>{{auth.tenantUuid() || 'JWT tenant claim'}}</strong></div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div><span class="eyebrow">IDENTITY PLATFORM</span><h1>Administration Console</h1></div>
        <div class="top-actions"><span class="status-dot"></span> Connected <button class="avatar" (click)="auth.clear()">A</button></div>
      </header>
      @if (ui.toast()) { <div class="toast">{{ui.toast()}}</div> }
      <section class="content"><router-outlet /></section>
    </main>
  </div>`
})
export class ShellComponent {
  constructor(public auth: AuthService, public ui: UiService) {}
}
