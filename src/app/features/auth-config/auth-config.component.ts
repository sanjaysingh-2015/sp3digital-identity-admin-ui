import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { UiService } from '../../core/ui.service';
import { PageComponent } from '../../shared/page.component';
@Component({standalone:true,imports:[FormsModule,PageComponent],template:`<app-page eyebrow="SECURITY" title="Authentication Configuration" description="Tenant-level authentication behavior and provider selection."/><div class="panel form-panel"><div class="form-grid"><label>Primary authentication mode<input [(ngModel)]="config.authenticationMode" placeholder="PASSWORD / OIDC / SSO"></label><label>Default identity provider<input [(ngModel)]="config.defaultIdentityProviderId"></label><label>Session policy<input [(ngModel)]="config.sessionPolicy"></label><label>Login channel<input [(ngModel)]="config.loginChannel"></label><label class="check"><input type="checkbox" [(ngModel)]="config.mfaEnabled"> MFA enabled</label></div><div class="modal-actions"><button class="primary" (click)="save()">Save configuration</button></div></div>`})
export class AuthConfigComponent {config:any={};constructor(private api:ApiService,private auth:AuthService,private ui:UiService){const t=auth.tenantUuid();if(t)api.get<any>(`/auth-configs/${t}`).subscribe({next:r=>this.config=r?.data||r})}save(){const t=this.auth.tenantUuid();if(!t)return;this.api.put(`/auth-configs/${t}`,this.config).subscribe({next:()=>this.ui.show('Authentication configuration updated')})}}
