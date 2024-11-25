import { Component } from '@angular/core';
import { AuthService, User } from '../auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-logout',
  templateUrl: './user-logout.component.html',
  styleUrls: ['./user-logout.component.scss']
})
export class UserLogoutComponent {

  user : User | null = null;

  constructor(
    private auth : AuthService,
    public router : Router,
  ) {
    this.auth.userSubject.subscribe((user) => this.user = user);
  }

  logout() {
    if (confirm("Really want to logout?")) {
      this.auth.logout()
        .subscribe(() => {
          this.router.navigate(['/']);
        });
    }
  }
}
