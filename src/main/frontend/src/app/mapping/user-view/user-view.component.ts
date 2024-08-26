import { Component, TemplateRef } from '@angular/core';
import { AuthService, User } from '../auth.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PersistencyService } from '../persistency.service';

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
  ) {
    this.auth.userSubject.subscribe((user) => this.user = user);
  }

  changePassword(oldPassword : string, newPassword : string) {
    this.auth.changePassword(oldPassword, newPassword);
  }
}
