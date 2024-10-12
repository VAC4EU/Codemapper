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
import { Component, TemplateRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SelectionModel } from '@angular/cdk/collections';
import { Title } from "@angular/platform-browser";
import { MatDialog } from '@angular/material/dialog';
import { PersistencyService, MappingInfo, ProjectRole, mappingInfoLink, UserRole, roleAtLeast as roleAtLeast, userCanDownload, userCanRename, userCanCreate } from '../persistency.service';
import { AuthService, User } from '../auth.service';
import { ApiService } from '../api.service';
import { EMPTY_SERVER_INFO, Mapping, MappingFormat, Start, StartType, ServerInfo } from '../data';
import { AllTopics } from '../review';
import { ImportCsvDialogComponent } from '../import-csv-dialog/import-csv-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DownloadDialogComponent } from '../download-dialog/download-dialog.component';

function usernameCompare(a : User | string, b : User | string) {
  let a1 = typeof a == 'string' ? a : a.username;
  let b1 = typeof b == 'string' ? b : b.username;
  return a1.toLowerCase().localeCompare(b1.toLowerCase());
}

@Component({
  selector: 'project-view',
  templateUrl: './project-view.component.html',
  styleUrls: ['./project-view.component.scss']
})
export class ProjectViewComponent {
  serverInfo : ServerInfo = EMPTY_SERVER_INFO;
  projectName! : string;
  newEventName : string = "";
  mappings : MappingInfo[] = [];
  role : ProjectRole | null = null;
  selected = new SelectionModel<MappingInfo>(true, []);
  user : User | null = null;
  userRoles : UserRole[] = [];
  allUsers : User[] = []; // only available for admin, owner
  constructor(
    private api : ApiService,
    private persistency : PersistencyService,
    private route : ActivatedRoute,
    private router : Router,
    private title : Title,
    private dialog : MatDialog,
    private auth : AuthService,
    private snackbar : MatSnackBar,
  ) { }
  get userCanDownload() {
    return userCanDownload(this.role);
  }
  get userCanRename() {
    return userCanRename(this.role);
  }
  get userCanCreate() {
    return userCanCreate(this.role);
  }
  ngOnInit() {
    this.api.serverInfo().subscribe(info => this.serverInfo = info);
    this.route.params.subscribe(params => {
      this.projectName = params['project'];
      this.title.setTitle(`CodeMapper: Project ${this.projectName}`);
      this.persistency.projectMappingInfos(this.projectName)
        .subscribe((mappings) => this.mappings = mappings);
      this.auth.user.then((user) => this.user = user);
      this.persistency.allUsers().subscribe(allUsers => {
        this.allUsers = allUsers;
        this.allUsers.sort(usernameCompare);
      });
      this.reloadUsersRoles();
      this.selected.clear();
    });
  }
  async reloadUsersRoles() {
    this.role = await firstValueFrom(this.persistency.getProjectRole(this.projectName));
    this.userRoles = await firstValueFrom(this.persistency.projectUsers(this.projectName));
    this.userRoles.sort((a, b) => usernameCompare(a.user, b.user));
  }
  isAllSelected() {
    const numSelected = this.selected.selected.length;
    const numRows = this.mappings.length;
    return numSelected == numRows;
  }
  toggleSelectAll() {
    if (this.isAllSelected()) {
      this.selected.clear();
    } else {
      this.mappings.forEach(row => this.selected.select(row));
    }
  }
  allSelectedHaveRevision() {
    return this.selected.selected.every(i => i.version != null)
  }
  async newMapping(projectName : string, mappingName : string, umlsVersion : string) {
    if (!projectName || !mappingName) {
      return;
    }
    let vocs0 = await firstValueFrom(this.api.vocabularies());
    let vers = await firstValueFrom(this.api.serverInfo());
    let vocabularies = Object.fromEntries(
      vocs0
        .filter(v => vers.defaultVocabularies.includes(v.id))
        .map(v => [v.id, v]));
    let info = {
      formatVersion: MappingFormat.version,
      umlsVersion,
      allowedTags: this.serverInfo.defaultAllowedTags,
      ignoreTermTypes: this.serverInfo.defaultIgnoreTermTypes,
      ignoreSemanticTypes: this.serverInfo.defaultIgnoreSemanticTypes,
    };
    let mapping = new Mapping(info, null, vocabularies, {}, {});
    let initial = { mappingName, projectName, mapping };
    this.router.navigate(["/mapping"], { state: { initial } });
  }
  importNew(projectName : string) {
    if (!projectName) {
      return;
    }
    this.dialog.open(ImportCsvDialogComponent)
      .afterClosed()
      .subscribe(imported => {
        if (typeof (imported) == 'object') {
          let start : Start = {
            type: StartType.CsvImport,
            csvContent: imported.csvContent
          };
          let { mappingName, mapping: { vocabularies, concepts, codes, umlsVersion } } = imported;
          let info = {
            formatVersion: MappingFormat.version,
            umlsVersion,
            allowedTags: this.serverInfo.defaultAllowedTags,
            ignoreTermTypes: this.serverInfo.defaultIgnoreTermTypes,
            ignoreSemanticTypes: this.serverInfo.defaultIgnoreSemanticTypes,
          };
          let mapping = new Mapping(info, start, vocabularies, concepts, codes);
          let allTopics = AllTopics.fromRaw(imported.allTopics, null, Object.keys(concepts));
          let initial = { mappingName, projectName, mapping, allTopics };
          this.router.navigate(["/mapping"], { state: { initial } });
        }
      });
  }
  openDialog(templateRef : TemplateRef<any>) {
    this.dialog.open(templateRef, { width: '700px' });
  }
  openDownloadDialog(mappings : MappingInfo[]) {
    let data = {
      projectName: this.projectName,
      mappingConfigs: mappings.map(i => i.mappingShortkey),
    };
    this.dialog.open(DownloadDialogComponent, { data })
  }
  mappingLink(mapping : MappingInfo) {
    return mappingInfoLink(mapping)
  }
  async renameMapping(mapping : MappingInfo, newName : string) {
    await this.persistency.mappingSetName(mapping.mappingShortkey, newName).toPromise();
    mapping.mappingName = newName;
    console.log("renamed");
  }
  addUserRole(username : string, role : ProjectRole) {
    console.log("ROLE", role, ProjectRole);
    this.persistency.setUserRole(this.projectName, username, role).subscribe({
      next: _ => this.reloadUsersRoles(),
      error: err => this.snackbar.open(err.message, "Ok"),
    });
  }
  selectedMappingConfigs() : string[] {
    return this.selected.selected.map(info => info.mappingShortkey)
  }
  rolesDomain() : string[] {
    return Object.keys(ProjectRole)
  }
}
