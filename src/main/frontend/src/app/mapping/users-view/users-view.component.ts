import { Component } from '@angular/core';
import { AuthService, User } from '../auth.service';
import { PersistencyService, ProjectRole } from '../persistency.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

const TESTS_PROJECT = "Tests";

@Component({
  selector: 'app-users-view',
  templateUrl: './users-view.component.html',
  styleUrls: ['./users-view.component.scss']
})
export class UsersViewComponent {
  user : User | null = null;
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

  async createUser(username : string, password : string, email : string, addToProjectTest : boolean) {
    try {
      await firstValueFrom(this.persistency.createUser(username, password, email));
      if (addToProjectTest) {
        await firstValueFrom(this.persistency.setUserRole(TESTS_PROJECT, username, ProjectRole.Owner));
      }
      this.reloadUsers();
      this.snackbar.open("Create user and added to project " + TESTS_PROJECT, "Ok", { duration: 2000 })
    } catch (err) {
      console.log(err);
      this.snackbar.open("Could not create user: " + (err as HttpErrorResponse).error, "Ok");
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
