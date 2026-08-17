import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UiService } from '../../core/ui.service';
import { PageComponent } from '../../shared/page.component';

@Component({standalone:true,imports:[FormsModule,PageComponent],template:`
<app-page eyebrow="AUTHORIZATION" title="Roles" description="Define reusable RBAC roles and assign permissions."><button actions class="primary" (click)="formOpen=true">+ Create role</button></app-page>
<div class="panel table-wrap"><table><thead><tr><th>Role</th><th>Code</th><th>Description</th><th>Status</th></tr></thead><tbody>@for(r of rows;track r.role_id||r.roleId){<tr><td><strong>{{r.role_name||r.roleName}}</strong></td><td><code>{{r.role_code||r.roleCode}}</code></td><td>{{r.description||'—'}}</td><td><span class="badge good">{{r.status}}</span></td></tr>}@empty{<tr><td colspan="4" class="empty">No roles returned.</td></tr>}</tbody></table></div>
@if(formOpen){<div class="modal-backdrop"><div class="modal"><h3>Create role</h3><label>Role name<input [(ngModel)]="form.roleName"></label><label>Role code<input [(ngModel)]="form.roleCode"></label><label>Description<textarea [(ngModel)]="form.description"></textarea></label><div class="modal-actions"><button class="secondary" (click)="formOpen=false">Cancel</button><button class="primary" (click)="create()">Create</button></div></div></div>}`})
export class RolesComponent {
 rows:any[]=[];formOpen=false;form={roleName:'',roleCode:'',description:''};
 constructor(private api:ApiService,private ui:UiService){this.load()}
 load(){this.api.get<any>('/authorization/roles',{page:1,limit:100}).subscribe({next:r=>this.rows=r?.data?.items||r?.items||r?.data||[]})}
 create(){this.api.post('/authorization/roles',this.form).subscribe({next:()=>{this.formOpen=false;this.ui.show('Role created');this.load()}})}
}
