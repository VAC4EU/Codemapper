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
import { ServerInfo, EMPTY_SERVER_INFO } from '../mapping-data';
import { AuthService } from '../auth.service';
import { ApiService } from '../api.service';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-welcome-view',
  templateUrl: './welcome-view.component.html',
  styleUrls: ['./welcome-view.component.scss']
})
export class WelcomeViewComponent {
  info : ServerInfo = EMPTY_SERVER_INFO;
  isProduction : boolean = environment.isProduction;
  constructor(
    private auth : AuthService,
    private api : ApiService,
    private snackbar : MatSnackBar,
  ) {
    firstValueFrom(this.api.serverInfo()).then((info) => this.info = info);
    if (auth.redirectUrl != null) {
      this.snackbar.open("Please log in", "Ok", { duration: 2000 });
    }
  }
}
