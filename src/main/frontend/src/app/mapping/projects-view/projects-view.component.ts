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

import { Component, TemplateRef } from '@angular/core';
import { PersistencyService, ProjectInfo } from '../persistency.service';
import { AuthService, User } from '../auth.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

const DEFAULT_VOCABULARIES = ["ICD10CM", "SNOMEDCT_US"];

@Component({
  selector: 'app-projects-view',
  templateUrl: './projects-view.component.html',
  styleUrls: ['./projects-view.component.scss']
})
export class ProjectsViewComponent {
  projects : ProjectInfo[] = [];
  newNames : { [key : string] : string } = {};
  user : User | null = null;
  constructor(
    private persistency : PersistencyService,
    private auth : AuthService,
    private dialog : MatDialog,
    private snackbar : MatSnackBar,
    private router : Router,
  ) {
    this.reloadProjects();
    this.auth.userSubject.subscribe((user) => this.user = user);
  }

  reloadProjects() {
    this.persistency.projectInfos().subscribe((projects) => {
      this.projects = projects;
      this.projects.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  createProject(name : string) {
    this.persistency.createProject(name).subscribe({
      next: _ => this.reloadProjects(),
      error: err => this.snackbar.open(err.error, "Ok"),
    })
  }

  openDialog(templateRef : TemplateRef<any>) {
    this.dialog.open(templateRef, {
      width: '700px'
    });
  }
}
