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

import { inject } from '@angular/core';
import {
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  CanActivateFn,
} from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard : CanActivateFn = async (_next : ActivatedRouteSnapshot, state : RouterStateSnapshot) => {
  let auth = inject(AuthService);
  let router = inject(Router);
  let user = await auth.user;
  if (user == null) {
    auth.redirectUrl = state.url;
    return router.parseUrl('/login');
  } else {
    return true;
  }
}

export const noAuthGuard : CanActivateFn = async (_next : ActivatedRouteSnapshot, state : RouterStateSnapshot) => {
  let auth = inject(AuthService);
  let router = inject(Router);
  let user = await auth.user;
  if (user == null) {
    return true;
  } else {
    return router.parseUrl('/');
  }
}

export const adminGuard : CanActivateFn = async (
  _next : ActivatedRouteSnapshot,
  state : RouterStateSnapshot
) => {
  let auth = inject(AuthService);
  let router = inject(Router);
  let user = await auth.user;
  if (user?.admin) {
    return true;
  }
  if (user == null) {
    auth.redirectUrl = state.url;
    return router.parseUrl('/login');
  }
  return router.parseUrl('/');
}

