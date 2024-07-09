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

import { Component, Input, SimpleChanges } from '@angular/core';
import { AuthService } from '../auth.service';
import { ProjectInfo } from '../persistency.service';

const DEFAULT_PROJECTS : string[] = ["Tests", "VAC4EU"];

@Component({
  selector: 'app-navigation',
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.scss']
})
export class NavigationComponent {
  @Input() projectName : string | null = null;
  projects! : Promise<ProjectInfo[]>;
  public constructor(
    private auth : AuthService,
  ) {
    this.updateProjects();
  }
  ngOnChanges(changes : SimpleChanges) : void {
    this.updateProjects();
  }
  updateProjects() {
    this.projects = this.auth.projects
      .then(ps => {
        let projects = ps.filter(p => DEFAULT_PROJECTS.includes(p.name) || p.name == this.projectName);
        projects.sort();
        return projects;
      });
  }
}
