import { Component } from '@angular/core';
import { AuthService, User } from '../auth.service';
import { PersistencyService, ProjectRole, ProjectsRoles } from '../persistency.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

const TESTS_PROJECT = "Tests";

interface UserRole { project : string, role : ProjectRole }

function parseProjectRoles(csv : string) {
  let result : UserRole[] = [];
  for (let line of csv.split('\n').filter(s => s.length)) {
    let [project, role0] = line.split(':');
    let role = ProjectRole[role0.trim() as keyof typeof ProjectRole];
    if (role === undefined) {
      throw Error("Invalid user role: " + role0);
    }
    result.push({ project: project.trim(), role });
  }
  return result;
}

@Component({
    selector: 'app-users-view',
    templateUrl: './users-view.component.html',
    styleUrls: ['./users-view.component.scss'],
    standalone: false
})
export class UsersViewComponent {
  user : User | null = null;
  newUserRoles : UserRole[] = [];
  hidePasswordNew : boolean = true;
  hidePasswordSet : boolean = true;
  users : User[] = [];
  admins : User[] = [];

  constructor(
    private auth : AuthService,
    private persistency : PersistencyService,
    private snackbar : MatSnackBar,
  ) {
    this.auth.userSubject.subscribe((user) => this.user = user);
    this.reloadUsers();
  }

  async reloadUsers() {
    this.users = await firstValueFrom(this.persistency.allUsers());
    this.users.sort((a, b) => a.username.localeCompare(b.username));
    this.admins = this.users.filter(u => u.admin);
  }

  async createUser(username : string, password : string, email : string, projectRolesCSV : string) {
    try {
      let projectRoles = parseProjectRoles(projectRolesCSV);
      await firstValueFrom(this.persistency.createUser(username, password, email));
      for (let { project, role } of projectRoles) {
        await firstValueFrom(this.persistency.setUserRole(project, username, role));
      }
      this.reloadUsers();
      this.snackbar.open("Create user and added to projects", "Ok", { duration: 2000 })
    } catch (err) {
      let msg = (err as HttpErrorResponse).error ?? (err as Error).message;
      this.snackbar.open("Could not create user: " + msg, "Ok");
    }
  }

  changePassword(username : string, password : string) {
    this.persistency.changePassword(username, password).subscribe({
      next: _ => this.snackbar.open("Changed password", "Ok", { duration: 2000 }),
      error: err => this.snackbar.open("Could not change password: " + err.error, "Ok"),
    })
  }

  setAdmin(username : string, isAdmin : boolean) {
    if (!confirm(`Really ${isAdmin ? "grant" : "retract"} admin status for ${username}?`)) {
      return;
    }
    this.persistency.setAdmin(username, isAdmin).subscribe({
      next: _ => {
        this.auth.reloadUser();
        this.reloadUsers();
        this.snackbar.open(`Admin status ${isAdmin ? "granted" : "retracted"}`, "Ok", { duration: 2000 });
      },
      error: err => this.snackbar.open("Could not set admin: " + err.error, "Ok"),
    })
  }
}
