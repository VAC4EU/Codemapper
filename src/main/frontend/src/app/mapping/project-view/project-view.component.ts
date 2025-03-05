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
  SimpleChanges,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SelectionModel } from '@angular/cdk/collections';
import { Title } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import {
  PersistencyService,
  MappingInfo,
  ProjectRole,
  mappingInfoLink,
  UserRole,
  roleAtLeast as roleAtLeast,
  userCanDownload,
  userCanRename,
  userCanCreate,
} from '../persistency.service';
import { AuthService, User } from '../auth.service';
import { ApiService, ImportedMapping } from '../api.service';
import {
  EMPTY_SERVER_INFO,
  Mapping,
  MappingFormat,
  Start,
  StartType,
  ServerInfo,
  MappingMeta,
} from '../data';
import { AllTopics } from '../review';
import { ImportCsvDialogComponent } from '../import-csv-dialog/import-csv-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DownloadDialogComponent } from '../download-dialog/download-dialog.component';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';

function usernameCompare(a: User | string, b: User | string) {
  let a1 = typeof a == 'string' ? a : a.username;
  let b1 = typeof b == 'string' ? b : b.username;
  return a1.toLowerCase().localeCompare(b1.toLowerCase());
}

@Component({
  selector: 'project-view',
  templateUrl: './project-view.component.html',
  styleUrls: ['./project-view.component.scss'],
})
export class ProjectViewComponent {
  serverInfo: ServerInfo = EMPTY_SERVER_INFO;
  folderName: string = "";
  newEventName: string = '';
  mappings: MappingInfo[] = [];
  selectedMappings: MappingInfo[] = [];
  role: ProjectRole | null = null;
  user: User | null = null;
  userRoles: UserRole[] = [];
  allUsers: User[] = []; // only available for admin, owner
  filter: string = '';
  selection = new SelectionModel<MappingInfo>(true, []);
  dataSource: MatTableDataSource<MappingInfo> =
    new MatTableDataSource<MappingInfo>();
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private api: ApiService,
    private persistency: PersistencyService,
    private route: ActivatedRoute,
    private router: Router,
    private title: Title,
    private dialog: MatDialog,
    private auth: AuthService,
    private snackbar: MatSnackBar
  ) {}

  async ngOnInit() {
    this.auth.user.then((user) => (this.user = user));
    this.persistency.allUsers().subscribe((allUsers) => {
      this.allUsers = allUsers;
      this.allUsers.sort(usernameCompare);
    });
  }

  async ngAfterViewInit() {
    this.serverInfo = await firstValueFrom(this.api.serverInfo());
    this.route.params.subscribe(async (params) => {
      this.folderName = params['folder'];
      await this.reloadUsersRoles();
      await this.reload();
    });
  }

  async reload() {
    this.filter = '';
    this.applyFilter('');
    this.selection.clear();
    this.title.setTitle(`CodeMapper: Folder ${this.folderName}`);
    this.mappings = await firstValueFrom(
      this.persistency.projectMappingInfos(this.folderName)
    );
    this.dataSource.data = Object.values(this.mappings);
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (item: any, property: string) => {
      switch (property) {
        case 'name':
          return item.mappingName;
        default:
          return item[property];
      }
    };
  }

  get selectedFilteredConcepts() {
    return Array.from(this.selection.selected).filter((m) =>
      this.dataSource.filteredData.some((m1) => m1.mappingName == m.mappingName)
    );
  }

  get userCanDownload() {
    return userCanDownload(this.role);
  }

  get userCanRename() {
    return userCanRename(this.role);
  }

  get userCanCreate() {
    return userCanCreate(this.role);
  }

  applyFilter(filterValue: string) {
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  async reloadUsersRoles() {
    this.role = await firstValueFrom(
      this.persistency.getProjectRole(this.folderName)
    );
    this.userRoles = await firstValueFrom(
      this.persistency.projectUsers(this.folderName)
    );
    this.userRoles.sort((a, b) => usernameCompare(a.user, b.user));
  }

  isAllFilteredSelected() {
    return (
      this.dataSource.filteredData.length <= this.selection.selected.length &&
      this.dataSource.filteredData.every(
        (c) => this.selection.selected.indexOf(c) != -1
      )
    );
  }

  toggleSelectAll() {
    if (this.isAllFilteredSelected()) {
      this.selection.clear();
    } else {
      this.selectAll();
    }
  }

  selectAll() {
    this.dataSource.filteredData.forEach((row) => this.selection.select(row));
  }
  allSelectedHaveRevision() {
    return this.selection.selected.every((i) => i.version != null);
  }
  async newMapping(
    projectName: string,
    mappingName: string,
    umlsVersion: string
  ) {
    if (!projectName || !mappingName) {
      return;
    }
    let vocs0 = await firstValueFrom(this.api.vocabularies());
    let vers = await firstValueFrom(this.api.serverInfo());
    let vocabularies = Object.fromEntries(
      vocs0
        .filter((v) => vers.defaultVocabularies.includes(v.id))
        .map((v) => [v.id, v])
    );
    let info = {
      formatVersion: MappingFormat.version,
      umlsVersion,
      allowedTags: this.serverInfo.defaultAllowedTags,
      ignoreTermTypes: this.serverInfo.defaultIgnoreTermTypes,
      ignoreSemanticTypes: this.serverInfo.defaultIgnoreSemanticTypes,
    };
    let mapping = new Mapping(info, null, vocabularies, {}, {});
    let initial = { mappingName, projectName, mapping };
    this.router.navigate(['/mapping'], { state: { initial } });
  }
  importNew(projectName: string) {
    if (!projectName) {
      return;
    }
    let ignoreTermTypes = this.serverInfo.defaultIgnoreTermTypes;
    this.dialog
      .open(ImportCsvDialogComponent, { data: { ignoreTermTypes } })
      .afterClosed()
      .subscribe((imported) => {
        console.log('IMPORTED', imported);
        if (typeof imported == 'object') {
          let start: Start = {
            type: StartType.CsvImport,
            csvContent: imported.csvContent,
          };
          let { mappingName, mapping } = imported as ImportedMapping;
          let { vocabularies, concepts, codes, umlsVersion } = mapping;
          let meta: MappingMeta = {
            formatVersion: MappingFormat.version,
            umlsVersion,
            ignoreTermTypes,
            ignoreSemanticTypes: this.serverInfo.defaultIgnoreSemanticTypes,
            allowedTags: this.serverInfo.defaultAllowedTags,
          };
          let mapping1 = new Mapping(
            meta,
            start,
            vocabularies,
            concepts,
            codes
          );
          let allTopics = AllTopics.fromRaw(
            imported.allTopics,
            null,
            Object.keys(concepts)
          );
          let initial = {
            mappingName,
            projectName,
            mapping: mapping1,
            allTopics,
          };
          this.router.navigate(['/mapping'], { state: { initial } });
        }
      });
  }
  async deleteSelectedMappings() {
    let names = this.selection.selected.map((c) => c.mappingName);
    if (
      !confirm(
        `Do you really want to delete ${names.length} mapping(s): ${names.join(
          ', '
        )}`
      )
    )
      return;
    let shortkeys = this.selection.selected.map((c) => c.mappingShortkey);
    try {
      await this.persistency.deleteMappings(shortkeys);
    } catch (e) {
      this.snackbar.open((e as Error).toString(), 'Ok');
    } finally {
      this.reload();
    }
  }
  openDialog(templateRef: TemplateRef<any>) {
    this.dialog.open(templateRef, { width: '700px' });
  }
  openDownloadDialog(mappings: MappingInfo[]) {
    let data = {
      projectName: this.folderName,
      mappingConfigs: mappings.map((i) => i.mappingShortkey),
    };
    this.dialog.open(DownloadDialogComponent, { data });
  }
  mappingLink(mapping: MappingInfo) {
    return mappingInfoLink(mapping);
  }
  async renameMapping(mapping: MappingInfo, newName: string) {
    await this.persistency
      .mappingSetName(mapping.mappingShortkey, newName)
      .toPromise();
    mapping.mappingName = newName;
    console.log('renamed');
  }
  addUserRole(username: string, role: ProjectRole) {
    console.log('ROLE', role, ProjectRole);
    this.persistency.setUserRole(this.folderName, username, role).subscribe({
      next: (_) => this.reloadUsersRoles(),
      error: (err) => this.snackbar.open(err.message, 'Ok'),
    });
  }
  selectedMappingConfigs(): string[] {
    return this.selection.selected.map((info) => info.mappingShortkey);
  }
  rolesDomain(): string[] {
    return Object.keys(ProjectRole);
  }
}
