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

import { Injectable } from '@angular/core';
import { Router, ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, map } from 'rxjs';
import { AuthService, User } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    public auth : AuthService,
    public router : Router,
  ) { }

  loginIfNecessary(user : User | null, redirectUrl : string) : boolean | UrlTree {
    if (user == null) {
      this.auth.redirectUrl = redirectUrl;
      return this.router.parseUrl('/login');
    } else {
      return true;
    }
  }

  canActivate(
    route : ActivatedRouteSnapshot,
    state : RouterStateSnapshot,
  ) : Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if (this.auth.user instanceof Promise) {
      return this.auth.user
        .then((user) => this.loginIfNecessary(user, state.url))
        .catch((err) => {
          console.error("GUARD ERR", err);
          alert("Error getting user: " + err.message);
          return false;
        });
    } else {
      return this.loginIfNecessary(this.auth.user, state.url);
    }
  }
}


@Injectable({
  providedIn: 'root'
})
export class NoAuthGuard implements CanActivate {

  constructor(
    public auth : AuthService,
    public router : Router,
  ) { }

  mappingsIfPossible(user : User | null) : boolean | UrlTree {
    if (user != null) {
      return this.router.parseUrl('/mappings');
    } else {
      return true;
    }
  }

  canActivate(
    route : ActivatedRouteSnapshot,
    state : RouterStateSnapshot,
  ) : Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if (this.auth.user instanceof Promise) {
      return this.auth.user
        .then((user) => this.mappingsIfPossible(user))
        .catch((err) => {
          console.log("NO AUTH GUARD ERR", err);
          return true;
        });
    } else {
      return this.mappingsIfPossible(this.auth.user);
    }
  }
}
