import { Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../auth.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    standalone: false
})
export class LoginComponent {
  
  pleaseLogin : boolean = false;

  constructor(private snackbar: MatSnackBar, private auth: AuthService) {
  }

  async ngOnInit() {
    this.pleaseLogin = this.auth.redirectUrl != null;
  }
}
