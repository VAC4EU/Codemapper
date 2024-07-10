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
import { PersistencyService, ProjectInfo } from '../persistency.service';
import { Mapping } from '../data';
import { ApiService, ImportedMapping } from '../api.service';
import { AuthService } from '../auth.service';
import { environment } from '../../../environments/environment';
import { MatDialog } from '@angular/material/dialog';
import * as ops from '../mapping-ops';

const DEFAULT_VOCABULARIES = ["ICD10CM", "SNOMEDCT_US"];

@Component({
  selector: 'app-projects-view',
  templateUrl: './projects-view.component.html',
  styleUrls: ['./projects-view.component.scss']
})
export class ProjectsViewComponent {
  projects : ProjectInfo[] = [];
  newNames : { [key : string] : string } = {};
  constructor(
    private persistency : PersistencyService,
    private api : ApiService,
    private auth : AuthService,
    private router : Router,
    private dialog : MatDialog
  ) {
    persistency.projectInfos().subscribe((projects) => {
      this.projects = projects;
    });
  }
}
