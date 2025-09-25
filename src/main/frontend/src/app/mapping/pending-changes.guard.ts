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

import { ActivatedRouteSnapshot, RouterStateSnapshot, CanDeactivateFn } from '@angular/router';

export interface HasPendingChanges {
  get hasPendingChanges() : boolean;
}

export const pendingChangesGuard : CanDeactivateFn<HasPendingChanges> = async (component : HasPendingChanges, _currentRoute : ActivatedRouteSnapshot, _currentState : RouterStateSnapshot, _nextState : RouterStateSnapshot) => {
  return !component.hasPendingChanges
    || confirm('This mapping has unsaved changes, which are lost when you navigate away. Continue?');
}
