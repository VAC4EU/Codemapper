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
import { PersistencyService, ProjectInfo, ProjectPermission } from './persistency.service';

export interface User {
  username : string,
  projectPermissions : { [key : string] : ProjectPermission },
  admin : boolean
}

export interface LoginResult {
  success : boolean,
  user : User,
  error : string | undefined,
}

type UserFunction = (user : User | null | PromiseLike<User | null>) => void;
type ProjectsFunction = (projects : ProjectInfo[] | PromiseLike<ProjectInfo[]>) => void;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private url : string = environment.apiUrl + '/authentification'
  private resolveUser! : UserFunction;
  private rejectUser! : UserFunction;
  private resolveProjects! : ProjectsFunction;
  private rejectProjects! : ProjectsFunction;
  public redirectUrl : string | null = null;

  user : Promise<User | null> | User | null;
  projects! : Promise<ProjectInfo[]>;
  userIsEditor : boolean = false;
  userSubject : BehaviorSubject<User | null> = new BehaviorSubject(null as User | null);
  private redirectURL : string | null = null

  constructor(
    private http : HttpClient,
    private persistency : PersistencyService,
  ) {
    console.log("ENV", environment.name);
    this.user = new Promise((resolve, reject) => {
      this.resolveUser = resolve;
      this.rejectUser = reject;
    });
    this.http.get<User | null>(this.url + '/user')
      .subscribe(
        (user) => {
          this.resolveUser(user);
          this.userSubject.next(user);
        },
        (err) => {
          this.rejectUser(err);
        });
    this.projects = new Promise((resolve, reject) => {
      this.resolveProjects = resolve;
      this.rejectProjects = reject;
    });
    this.persistency.projectInfos().subscribe((pps) => {
      this.resolveProjects(pps);
    });
  }

  login(username : string, password : string) : Observable<{ success : boolean, error : string | undefined, redirectUrl : string | null }> {
    let body = new URLSearchParams();
    body.set('username', username);
    body.set('password', password);
    return this.http.post<LoginResult>(this.url + '/login', body, urlEncodedOptions)
      .pipe(map((res) => {
        if (res.success) {
          console.log("auth login user = ", res.user);
          this.user = res.user;
          this.userSubject.next(res.user);
          let redirectUrl = this.redirectUrl;
          this.redirectUrl = null;
          this.persistency.projectInfos().subscribe((projects) => {
            this.resolveProjects(projects);
          });
          return { success: true, error: undefined, redirectUrl };
        } else {
          this.user = null;
          this.userSubject.next(null);
          return { success: false, error: res.error, redirectUrl: null }
        }
      }));
  }

  logout() {
    return this.http.post<void>(this.url + '/logout', {})
      .pipe(map(() => {
        this.userSubject.next(null);
        this.resolveProjects([]);
        this.user = null;
      }));
  }

  projectRole(projectName : string) : ProjectPermission | undefined {
    return this.userSubject.value?.projectPermissions[projectName];
  }
  changePassword(oldPassword : string, newPassword : string) {
    let body = new URLSearchParams();
    body.set('oldPassword', oldPassword);
    body.set('newPassword', newPassword);
    return this.http.post<void>(this.url + '/change-password', body, urlEncodedOptions)
  }
}
