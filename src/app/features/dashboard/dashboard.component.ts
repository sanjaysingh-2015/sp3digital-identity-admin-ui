import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { PageComponent } from '../../shared/page.component';

@Component({standalone:true,imports:[RouterLink,PageComponent],template:`
<app-page eyebrow="OVERVIEW" title="Identity Administration" description="Control users, authorization, authentication providers and security policy from one console."/>
<div class="stat-grid">
 @for (s of stats; track s.label) { <div class="stat-card"><span>{{s.icon}}</span><div><small>{{s.label}}</small><strong>{{s.value}}</strong><em>{{s.hint}}</em></div></div> }
</div>
<div class="grid-2">
 <div class="panel"><div class="panel-title"><h3>Administration areas</h3></div>
  <div class="quick-grid">@for (q of quick; track q.title) { <a [routerLink]="q.link" class="quick"><b>{{q.icon}}</b><span><strong>{{q.title}}</strong><small>{{q.text}}</small></span><i>→</i></a> }</div>
 </div>
 <div class="panel"><div class="panel-title"><h3>JWT context</h3></div>
  <div class="claims"><div><small>Issuer</small><strong>{{claims['iss'] || '—'}}</strong></div><div><small>Subject</small><strong>{{claims['sub'] || '—'}}</strong></div><div><small>Tenant</small><strong>{{claims['tenant_uuid'] || claims['tid'] || '—'}}</strong></div><div><small>Scopes</small><strong>{{scopeText}}</strong></div></div>
 </div>
</div>`})
export class DashboardComponent {
  stats=[{label:'Users',value:'—',hint:'Live from API',icon:'◉'},{label:'Roles',value:'—',hint:'Live from API',icon:'◆'},{label:'Permissions',value:'—',hint:'Live from API',icon:'◇'},{label:'Identity Providers',value:'—',hint:'Live from API',icon:'⇄'}];
  quick=[{title:'Users',text:'Accounts and role assignments',link:'/users',icon:'◉'},{title:'Identity Providers',text:'OIDC / SAML provider administration',link:'/identity-providers',icon:'⇄'},{title:'Security Policy',text:'Password, token and MFA controls',link:'/security-policy',icon:'◈'},{title:'Audit Logs',text:'Administrative activity trail',link:'/audit-logs',icon:'☷'}];
  claims:any={}; scopeText='—';
  constructor(api:ApiService){ api.get<any>('/users',{page:1,limit:1}).subscribe({next:r=>this.stats[0].value=String(r?.total ?? r?.data?.total ?? r?.count ?? '—')}); api.get<any>('/authorization/roles',{page:1,limit:1}).subscribe({next:r=>this.stats[1].value=String(r?.total ?? r?.data?.total ?? '—')}); api.get<any>('/authorization/permissions',{page:1,limit:1}).subscribe({next:r=>this.stats[2].value=String(r?.total ?? r?.data?.total ?? '—')}); api.get<any>('/identity-providers',{page:1,limit:1}).subscribe({next:r=>this.stats[3].value=String(r?.total ?? r?.data?.total ?? '—')}); }
}
