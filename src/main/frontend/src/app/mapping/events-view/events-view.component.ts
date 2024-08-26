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
import { environment } from '../../../environments/environment';
import { PersistencyService, MappingInfo, ProjectPermission } from '../persistency.service';
import { AuthService } from '../auth.service';
import { ApiService } from '../api.service';
import { Mapping, Start, StartType } from '../data';
import { AllTopics } from '../review';
import { ImportCsvDialogComponent } from '../import-csv-dialog/import-csv-dialog.component';

@Component({
  selector: 'events-view',
  templateUrl: './events-view.component.html',
  styleUrls: ['./events-view.component.scss']
})
export class EventsViewComponent {
  projectName! : string;
  newEventName : string = "";
  mappings : MappingInfo[] = [];
  projectPerm : ProjectPermission | undefined = undefined;
  selected = new SelectionModel<MappingInfo>(true, []);
  constructor(
    private api : ApiService,
    private persistency : PersistencyService,
    private route : ActivatedRoute,
    private router : Router,
    private title : Title,
    private dialog : MatDialog,
    public auth : AuthService,
  ) { }
  ngOnInit() {
    this.route.params.subscribe(params => {
      this.projectName = params['project'];
      this.title.setTitle(`CodeMapper: Project ${this.projectName}`);
      this.projectPerm = this.auth.projectRole(this.projectName);
      this.persistency.projectMappingInfos(this.projectName)
        .subscribe((mappings) => this.mappings = mappings);
    });
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
  async newMapping(projectName : string, mappingName : string) {
    if (!projectName || !mappingName) {
      return;
    }
    let vocs0 = await firstValueFrom(this.api.vocabularies());
    let vers = await firstValueFrom(this.api.versionInfo());
    let vocabularies = Object.fromEntries(
      vocs0
        .filter(v => environment.defaultVocabularies.includes(v.id))
        .map(v => [v.id, v]));
    let mapping = new Mapping(null, vocabularies, {}, {}, vers.umlsVersion);
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
          let mapping = new Mapping(start, vocabularies, concepts, codes, umlsVersion);
          let allTopics = AllTopics.fromRaw(imported.allTopics, null, Object.keys(concepts));
          let initial = { mappingName, projectName, mapping, allTopics };
          this.router.navigate(["/mapping"], { state: { initial } });
        }
      });
  }
  openDialog(templateRef : TemplateRef<any>) {
    this.dialog.open(templateRef, { width: '700px' });
  }
  async renameMapping(mapping : MappingInfo, newName : string) {
    await this.persistency.mappingSetName(mapping.mappingUUID, newName).toPromise();
    mapping.mappingName = newName;
    console.log("renamed");
  }
  download(project : string, includeDescendants : boolean) {
    let url = new URL(this.api.downloadProjectUrl);
    url.searchParams.set('project', project);
    url.searchParams.set('includeDescendants', "" + includeDescendants);
    url.searchParams.set('url', window.location.href);
    window.open(url, '_blank');
  }
}
