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

import { of, firstValueFrom } from 'rxjs';
import { Component, TemplateRef } from '@angular/core';
import { Location } from '@angular/common';
import { Title } from "@angular/platform-browser";
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { map } from 'rxjs';
import { Indexing, Vocabularies, Mapping, Revision, ServerInfo, MappingMeta, MappingFormat, EMPTY_SERVER_INFO } from '../data';
import { AllTopics, ReviewData } from '../review';
import * as ops from '../mapping-ops';
import { ApiService, TypesInfo } from '../api.service';
import { mappingInfoLink, PersistencyService, ProjectRole, slugify, userCanEdit } from '../persistency.service';
import { AuthService } from '../auth.service';
import { HasPendingChanges } from '../pending-changes.guard';
import { ReviewOperation } from '../review';

export enum Tabs {
  Start = 0,
  Concepts = 1,
  Codes = 2,
  Vocabularies = 3,
  Review = 4,
  Tools = 5,
  History = 6,
}

const EMPTY_MAPPING_INFO : MappingMeta = {
  formatVersion: MappingFormat.version,
  umlsVersion: null,
  allowedTags: [],
  ignoreTermTypes: [],
  ignoreSemanticTypes: []
};

@Component({
  selector: 'app-mapping-view',
  templateUrl: './mapping-view.component.html',
  styleUrls: ['./mapping-view.component.scss']
})
export class MappingViewComponent implements HasPendingChanges {
  mappingShortkey : string | null = null; // null means mapping is not saved
  mappingName : string = "(unknown)";
  projectName : string = "(unknown)";
  mapping : Mapping | null = null;
  serverInfo : ServerInfo = EMPTY_SERVER_INFO;
  version : number = -1;
  revisions : Revision[] = [];
  allTopics : AllTopics = new AllTopics();
  reviewData : ReviewData = new ReviewData();
  vocabularies! : Vocabularies;
  selectedIndex : number = 1;
  saveRequired : boolean = false;
  error : string | null = null;
  projectRole : ProjectRole | null = null;

  constructor(
    private route : ActivatedRoute,
    private router : Router,
    private persistency : PersistencyService,
    private apiService : ApiService,
    private title : Title,
    private dialog : MatDialog,
    private snackBar : MatSnackBar,
    private auth : AuthService,
    private location : Location,
  ) { }

  get hasPendingChanges() : boolean {
    return this.mapping != null && this.mapping.undoStack.length > 0;
  }

  get userCanEdit() {
    return userCanEdit(this.projectRole);
  }

  async ngOnInit() {
    let vocabularies = await firstValueFrom(this.apiService.vocabularies());
    this.vocabularies = Object.fromEntries(vocabularies.map(v => [v.id, v]));
    this.serverInfo = await firstValueFrom(this.apiService.serverInfo());

    let params = await firstValueFrom(this.route.params);
    let mappingNameSlug = params['mappingName'];
    let projectNameSlug = params['projectName'];
    this.mappingShortkey = params['shortkey'];

    if (this.mappingShortkey == null) {
      let initial = this.router.lastSuccessfulNavigation?.extras.state?.['initial'];
      if (initial && initial.mapping instanceof Mapping) {
        await this.setInitialMapping(initial);
        if (this.projectRole != ProjectRole.Owner) {
          this.snackBar.open("You are not owner of the project, you will not be able to save this new mapping", "Ok");
        }
      } else {
        this.snackBar.open("No mapping", "Ok");
      }
    } else {
      try {
        let info = await firstValueFrom(this.persistency.mappingInfo(this.mappingShortkey));
        if (projectNameSlug != slugify(info.projectName) || mappingNameSlug != slugify(info.mappingName)) {
          console.log("redirect", projectNameSlug, slugify(this.projectName), mappingNameSlug, slugify(this.mappingName));
          this.location.go(mappingInfoLink(info).join('/'));
        }
        this.setNames(info.projectName, info.mappingName);
        this.persistency.getProjectRole(info.projectName).subscribe(role => this.projectRole = role);

        let postOp : null | ops.Operation = null;
        try {
          ({ version: this.version, mapping: this.mapping } = await firstValueFrom(
            this.persistency.loadLatestRevisionMapping(this.mappingShortkey, this.serverInfo)));
        } catch (err) {
          if ((err as HttpErrorResponse).status == 404) {
            try {
              let messages;
              ({ version: this.version, mapping: this.mapping, postOp, messages } =
                await this.loadLegacyMapping(this.mappingShortkey));
              messages.unshift(`The mapping was automatically imported from the old version of CodeMapper and remapped. Please save.`);
              this.snackBar.open(messages.join("\n\n"), "Ok", { panelClass: 'remap-snackbar' });
            } catch (err) {
              if ((err as HttpErrorResponse).status != 404) {
                console.error("error while loading legacy mapping", err);
              }
              this.snackBar.open("Could not load mapping", "Ok");
            }
          } else {
            console.error("Error while loading latest revision", err);
            this.snackBar.open("Could not load mapping", "Ok");
          }
        }
        this.mapping!.cleanupRecacheCheck();
        this.reloadReviews();
        this.reloadRevisions();
        if (postOp != null) this.run(postOp);
      } catch (err) {
        console.error("Error while loading mapping info", err);
        this.snackBar.open("Could not load mapping", "Ok");
      }
    }
  }

  setNames(projectName : string, mappingName : string) {
    this.title.setTitle(`CodeMapper: ${mappingName} (${projectName})`);
    this.projectName = projectName;
    this.mappingName = mappingName;
  }

  async setInitialMapping(initial : any) {
    console.log("Initial mapping", initial.mapping);
    this.saveRequired = true;
    this.mappingName = initial.mappingName;
    this.projectName = initial.projectName;
    this.mapping = initial.mapping as Mapping;
    if (initial.allTopics) {
      this.allTopics = initial.allTopics;
    }
    if (this.mapping.start == null) {
      this.selectedIndex = 0;
    }
    this.updateMapping(this.mapping);
    this.setNames(initial.projectName, initial.mappingName);
    this.projectRole = await firstValueFrom(this.persistency.getProjectRole(this.projectName));
  }

  async loadLegacyMapping(mappingShortkey : string) {
    this.version = -1;
    let mapping = await firstValueFrom(
      this.persistency.loadLegacyMapping(mappingShortkey, this.serverInfo));
    let { conceptsCodes, vocabularies, messages } =
      await this.apiService.remapData(mapping, this.vocabularies, mapping.meta);
    let umlsVersion = this.serverInfo.umlsVersion;
    let postOp = new ops.Remap(umlsVersion, conceptsCodes, vocabularies);
    return { version: -1, mapping, postOp, messages };
  }

  async reloadReviews() {
    if (this.mapping && this.mappingShortkey != null) {
      let allTopics0 = await firstValueFrom(this.apiService.allTopics(this.mappingShortkey));
      let user = await this.auth.user;
      let me = user?.username ?? "anonymous";
      let cuis = Object.keys(this.mapping.concepts);
      this.allTopics = AllTopics.fromRaw(allTopics0, me, cuis)
    }
  }

  async reloadRevisions() {
    if (this.mappingShortkey != null) {
      this.revisions = await firstValueFrom(this.persistency.getRevisions(this.mappingShortkey));
    }
  }

  run(op : ops.Operation) {
    if (!this.mapping) return;
    this.mapping.run(op);
    op.afterRunCallback();
    this.updateMapping(this.mapping);
    if (op.saveRequired) {
      this.saveRequired = true;
    }
  }

  redo() {
    if (!this.mapping) return;
    this.mapping.redo();
    this.updateMapping(this.mapping);
  }

  undo() {
    if (!this.mapping) return;
    this.mapping.undo();
    this.updateMapping(this.mapping);
  }

  updateMapping(mapping : Mapping) {
    this.mapping = mapping.clone();
    if (this.allTopics != null) {
      this.allTopics.setConcepts(Object.keys(mapping.concepts));
    }
  }

  async reviewRun(op : ReviewOperation) {
    console.log("review run", op);
    if (this.mappingShortkey == null) {
      alert("Please save the mapping before review");
    } else {
      await op.run(this.apiService, this.mappingShortkey).toPromise()!;
      await this.reloadReviews();
    }
  }

  dump() {
    console.log("MAPPING", this.mapping);
    console.log("ALL TOPICS", this.allTopics);
  }

  openDialog(templateRef : TemplateRef<any>) {
    let dialogRef = this.dialog.open(templateRef, {
      width: '700px'
    });
  }

  save(summary : string) {
    (this.mappingShortkey == null
      ? this.persistency.createMapping(this.projectName, this.mappingName)
        .pipe(map(m => m.mappingShortkey))
      : of(this.mappingShortkey)
    ).subscribe(mappingShortkey => {
      if (!this.mapping) return;
      this.persistency.saveRevision(mappingShortkey, this.mapping, summary)
        .subscribe({
          next: async version => {
            if (this.saveRequired) {
              try {
                await firstValueFrom(this.apiService.saveAllTopics(mappingShortkey, this.allTopics.toRaw()));
                this.saveRequired = false;
              } catch (err) {
                console.error("Could not save all review topics", err);
                this.snackBar.open("Could not save all review topics: " + err, "Close");
              }
            }
            this.snackBar.open("Saved version " + version, "Ok", { duration: 2000 });
            this.mapping!.undoStack = [];
            this.mapping!.redoStack = [];
            this.version = version;
            this.reloadRevisions();
            if (this.mappingShortkey == null) {
              this.router.navigate(mappingInfoLink({
                projectName: this.projectName,
                mappingName: this.mappingName,
                mappingShortkey
              }));
            }
          },
          error: err => {
            console.error("Could not save mapping", err);
            this.snackBar.open("Could not save mapping: " + err.message, "Close");
          }
        });
    });
  }

  undoTooltip() : string | undefined {
    if (this.mapping && this.mapping.undoStack.length > 0) {
      return `Undo (${this.mapping.undoStack[0][0]})`
    }
    return;
  }

  redoTooltip() : string | undefined {
    if (this.mapping && this.mapping.redoStack.length > 0) {
      return `Redo (${this.mapping.redoStack[0][0]})`
    }
    return;
  }

  titleTooltip() : string {
    let res = `In project ${this.projectName}`;
    if (this.saveRequired) {
      res += `, mapping needs save`;
    }
    return res;
  }

  async setStartIndexing(indexing : Indexing) {
    if (!this.mapping) return;
    if (this.mapping.start === null) {
      let vocIds = Object.keys(this.mapping.vocabularies);
      await this.apiService.concepts(indexing.selected, vocIds, this.mapping.meta)
        .subscribe(({ concepts, codes }) => {
          let op = new ops.SetStartIndexing(indexing, concepts, codes)
            .withAfterRunCallback(() => this.selectedIndex = 1);
          this.run(op);
        });
    }
  }

  typesInfo(info : ServerInfo) : TypesInfo {
    return {
      ignoreSemanticTypes: info.defaultIgnoreSemanticTypes,
      ignoreTermTypes: info.defaultIgnoreTermTypes,
    };
  }
}
