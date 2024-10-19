// This file is part of CodeMapper.
//
// Copyright 2022-2024 VAC4EU - Vaccine monitoring Collaboration for Europe.
// Copyright 2017-2021 Erasmus Medical Center, Department of Medical Informatics.
//
// CodeMapper is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option) any
// later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { FormControl } from "@angular/forms";
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'login-form',
  templateUrl: './login-form.component.html',
  styleUrls: ['./login-form.component.scss'],
})
export class LoginFormComponent {
  hasUser : boolean = false;
  hide : boolean = true;
  error : string = "";
  username = new FormControl("");
  password = new FormControl("");

  constructor(
    private auth : AuthService,
    private snackBar : MatSnackBar,
    public router : Router,
  ) {
    this.auth.userSubject.subscribe(user => this.hasUser = user != null);
  }

  login() {
    let username = this.username.getRawValue();
    let password = this.password.getRawValue();
    if (username && password) {
      this.auth.login(username, password)
        .subscribe((res) => {
          console.log("form login res", res);
          if (res.success) {
            if (res.redirectUrl) {
              this.router.navigate([res.redirectUrl]);
            } else if (this.router.url == "/login") {
              this.router.navigate(["/"]);
            }
          } else {
            this.snackBar.open(res.error!, "Ok");
          }
        });
    }
  }
}
