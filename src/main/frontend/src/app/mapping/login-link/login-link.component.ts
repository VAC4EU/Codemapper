import { Component } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
    selector: 'login-link',
    templateUrl: './login-link.component.html',
    styleUrls: ['./login-link.component.scss'],
    standalone: false
})
export class LoginLinkComponent {
  hasUser : boolean = false;

  constructor(
    private auth : AuthService,
  ) {
    this.auth.userSubject.subscribe(user => this.hasUser = user != null);
  }
}
