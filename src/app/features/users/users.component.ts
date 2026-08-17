import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UiService } from '../../core/ui.service';
import { PageComponent } from '../../shared/page.component';

@Component({standalone:true,imports:[FormsModule,PageComponent],template:`
<app-page eyebrow="IDENTITY" title="Users" description="Manage administrator-visible users and their role assignments."><button actions class="primary" (click)="openCreate()">+ Create user</button></app-page>
<div class="toolbar"><input [(ngModel)]="search" (keyup.enter)="load()" placeholder="Search username, name or email"><select [(ngModel)]="status" (change)="load()"><option value="">All statuses</option><option>ACTIVE</option><option>INACTIVE</option><option>SUSPENDED</option></select><button class="secondary" (click)="load()">Refresh</button></div>
<div class="panel table-wrap"><table><thead><tr><th>User</th><th>Email</th><th>Type</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>@for(u of rows;track u.user_id || u.userId){<tr><td><strong>{{u.first_name || u.firstName}} {{u.last_name || u.lastName}}</strong><small>{{u.username}}</small></td><td>{{u.email}}</td><td>{{u.user_type || u.userType || 'USER'}}</td><td><span class="badge" [class.good]="u.status==='ACTIVE'">{{u.status}}</span></td><td>{{u.created_on || u.createdAt || '—'}}</td><td><button class="link" (click)="select(u)">View</button></td></tr>} @empty {<tr><td colspan="6" class="empty">No users returned.</td></tr>}</tbody></table></div>
@if(formOpen){<div class="modal-backdrop"><div class="modal"><h3>Create user</h3><div class="form-grid"><label>Username<input [(ngModel)]="form.username"></label><label>Email<input [(ngModel)]="form.email" type="email"></label><label>First name<input [(ngModel)]="form.firstName"></label><label>Last name<input [(ngModel)]="form.lastName"></label><label>User type<input [(ngModel)]="form.userType"></label></div><div class="modal-actions"><button class="secondary" (click)="formOpen=false">Cancel</button><button class="primary" (click)="create()">Create</button></div></div></div>}
@if(selected){<div class="modal-backdrop"><div class="modal"><h3>User details</h3><pre>{{selected | json}}</pre><div class="modal-actions"><button class="secondary" (click)="selected=null">Close</button></div></div></div>}`})
export class UsersComponent {
  rows:any[]=[]; search=''; status=''; formOpen=false; selected:any=null; form:any={username:'',email:'',firstName:'',lastName:'',userType:'USER'};
  constructor(private api:ApiService,private ui:UiService){this.load()}
  load(){this.api.get<any>('/users',{page:1,limit:50,search:this.search,status:this.status}).subscribe({next:r=>this.rows=r?.data?.items||r?.items||r?.data||r?.rows||[]})}
  openCreate(){this.formOpen=true}
  create(){this.api.post('/users',this.form).subscribe({next:()=>{this.formOpen=false;this.ui.show('User created');this.load()}})}
  select(u:any){this.api.get<any>(`/users/${u.user_id||u.userId}`).subscribe({next:r=>this.selected=r?.data||r})}
}
