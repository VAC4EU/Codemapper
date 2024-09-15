import { Component } from '@angular/core';
import { AuthService, User } from '../auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-view',
  templateUrl: './user-view.component.html',
  styleUrls: ['./user-view.component.scss']
})
export class UserViewComponent {

  hidePassword : boolean = true;
  user : User | null = null;

  constructor(
    private auth : AuthService,
    private snackbar : MatSnackBar,
    public router : Router,
  ) {
    this.auth.userSubject.subscribe((user) => this.user = user);
  }

  logout() {
    if (confirm("Really want to logout?")) {
      this.auth.logout()
        .subscribe(() => {
          this.router.navigate(['login']);
        });
    }
  }

  changePassword(oldPassword : string, newPassword : string) {
    this.auth.changePassword(oldPassword, newPassword).subscribe({
      next: () => this.snackbar.open("Password changed", "Ok", { duration: 2000 }),
      error: err => this.snackbar.open("Could not change password: " + err.error, "Ok", { duration: 2000 }),
    })
  }
}
