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
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../src/environments/environment';
import { map } from 'rxjs/operators';
import { BehaviorSubject, Observable } from 'rxjs';
import { urlEncodedOptions } from '../app.module';
import { PersistencyService, ProjectsRole } from './persistency.service';

export interface User {
  username : string,
  admin : boolean,
  email : string,
}

export interface LoginResult {
  success : boolean,
  user : User,
  error : string | undefined,
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private url : string = environment.apiUrl + '/authentification'
  public redirectUrl : string | null = null

  user! : Promise<User | null>;
  userSubject : BehaviorSubject<User | null> = new BehaviorSubject(null as User | null);
  private resolveUser! : (value : User | PromiseLike<User | null> | null) => void;
  private rejectUser! : (reason ?: any) => void;

  roles! : Promise<ProjectsRole>;
  rolesSubject : BehaviorSubject<ProjectsRole> = new BehaviorSubject({});
  private resolveRoles! : (value : ProjectsRole | PromiseLike<ProjectsRole>) => void;
  private rejectRoles! : (reason ?: any) => void;

  constructor(
    private http : HttpClient,
    private persistency : PersistencyService,
  ) {
    this.reload();
  }

  async reload() {
    this.reloadUser();
    this.reloadRoles();
  }

  async reloadUser() {
    this.user = new Promise((resolve, reject) => {
      this.resolveUser = resolve;
      this.rejectUser = reject;
    })
    this.http.get<User | null>(this.url + '/user').subscribe({
      next: (user) => {
        this.resolveUser(user);
        this.userSubject.next(user);
      },
      error: (err) => {
        this.rejectUser(err);
        this.userSubject.next(null);
      }
    });
  }

  async reloadRoles() {
    this.roles = new Promise((resolve, reject) => {
      this.resolveRoles = resolve;
      this.rejectRoles = reject;
    });
    this.persistency.getProjectsRoles().subscribe({
      next: (roles) => {
        this.resolveRoles(roles);
        this.rolesSubject.next(roles);
      },
      error: (err) => {
        this.rejectRoles(err),
          this.rolesSubject.next({});
      }
    });
  }

  setUserRoles(user : User | null, roles : ProjectsRole) {
    this.user = Promise.resolve(null);
    this.userSubject.next(null);
    this.roles = Promise.resolve({});
    this.rolesSubject.next({});
  }

  login(username : string, password : string) : Observable<{ success : boolean, error : string | undefined, redirectUrl : string | null }> {
    let body = new URLSearchParams();
    body.set('username', username);
    body.set('password', password);
    return this.http.post<LoginResult>(this.url + '/login', body, urlEncodedOptions)
      .pipe(map((res) => {
        if (res.success) {
          console.log("auth login user = ", res.user);
          this.user = Promise.resolve(res.user);
          this.userSubject.next(res.user);
          this.reloadRoles();
          let redirectUrl = this.redirectUrl;
          this.redirectUrl = null;
          return { success: true, error: undefined, redirectUrl };
        } else {
          this.setUserRoles(null, {});
          return { success: false, error: res.error, redirectUrl: null }
        }
      }));
  }

  logout() {
    return this.http.post<void>(this.url + '/logout', {})
      .pipe(map(() => this.setUserRoles(null, {})));
  }

  changePassword(oldPassword : string, newPassword : string) {
    let body = new URLSearchParams();
    body.set('oldPassword', oldPassword);
    body.set('newPassword', newPassword);
    return this.http.post<void>(this.url + '/change-password', body, urlEncodedOptions)
  }

  changeEmail(newEmail : string) {
    let body = new URLSearchParams();
    body.set('email', newEmail);
    return this.http.post<void>(this.url + '/change-email', body, urlEncodedOptions)
  }
}
