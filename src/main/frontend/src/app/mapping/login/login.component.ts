import { Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  constructor(private snackbar: MatSnackBar, private auth: AuthService) {
  }

  async ngOnInit() {
    if (this.auth.redirectUrl) {
      this.snackbar.open('Please login', undefined, {duration: 0});
    }
  }
}
