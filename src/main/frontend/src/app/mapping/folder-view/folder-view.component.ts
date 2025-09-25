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

import { firstValueFrom } from 'rxjs';
import {
  Component,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  PersistencyService,
  ProjectRole,
  MappingInfo,
} from '../persistency.service';
import { AuthService, User } from '../auth.service';
import { FolderMappingsComponent } from '../folder-mappings/folder-mappings.component';

@Component({
    selector: 'folder-view',
    templateUrl: './folder-view.component.html',
    styleUrls: ['./folder-view.component.scss'],
    standalone: false
})
export class FolderViewComponent {
  user: User | null = null;
  folderName: string | null = null;
  role: ProjectRole | null = null;

  numMappings: number = 0;
  @ViewChild(FolderMappingsComponent) mappings!: FolderMappingsComponent;

  setNumMappings(n: number) {
    this.numMappings = n;
  }

  constructor(
    private persistency: PersistencyService,
    private auth: AuthService,
    private route: ActivatedRoute,
  ) {}

  async ngAfterContentInit() {
    this.user = await this.auth.user;
    this.route.params.subscribe(async (params) => {
      let folderName = params['folder'];
      this.folderName = folderName;
      this.role = await firstValueFrom(
        this.persistency.getProjectRole(folderName)
      );
    });
  }
}
