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
import { Component, ChangeDetectorRef, NgZone, TemplateRef } from '@angular/core';
import { Title } from "@angular/platform-browser";
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { map } from 'rxjs';
import { Start, StartType, Indexing, CsvImport, Vocabularies, Mapping, Revision, VersionInfo } from '../data';
import { AllTopics, ReviewData } from '../review';
import * as ops from '../mapping-ops';
import { ApiService } from '../api.service';
import { PersistencyService } from '../persistency.service';
import { AuthService } from '../auth.service';
import { HasPendingChanges } from '../pending-changes.guard';
import { ReviewOperation } from '../review';

enum Tabs {
  Start = 0,
  Concepts = 1,
  Codes = 2,
  Vocabularies = 3,
  Review = 4,
  Tools = 5,
  History = 6,
}

@Component({
  selector: 'app-mapping-view',
  templateUrl: './mapping-view.component.html',
  styleUrls: ['./mapping-view.component.scss']
})
export class MappingViewComponent implements HasPendingChanges {
  mappingUUID : string | null = null;
  mappingName : string = "??";
  projectName : string = "??";
  viewName! : string;
  mapping : Mapping = new Mapping(null, {}, {}, {}, null); // initial value needed to avoid Expression has changed after it was checked
  versionInfo! : VersionInfo;
  version : number = -1;
  revisions : Revision[] = [];
  allTopics : AllTopics = new AllTopics();
  reviewData : ReviewData = new ReviewData();
  vocabularies! : Vocabularies;
  selectedIndex : number = 0;
  saveRequired : boolean = false;
  error : string | null = null;

  constructor(
    private http : HttpClient,
    private route : ActivatedRoute,
    private router : Router,
    private cdr : ChangeDetectorRef,
    private ngZone : NgZone,
    private persistency : PersistencyService,
    private apiService : ApiService,
    private title : Title,
    private dialog : MatDialog,
    private snackBar : MatSnackBar,
    public auth : AuthService,
  ) { }

  hasPendingChanges() {
    return this.mapping.undoStack.length > 0;
  }

  async ngOnInit() {
    let params = await firstValueFrom(this.route.params);
    let vocabularies = await firstValueFrom(this.apiService.vocabularies());
    this.vocabularies = Object.fromEntries(vocabularies.map(v => [v.id, v]));
    this.versionInfo = await firstValueFrom(this.apiService.versionInfo());
    this.mappingUUID = params['mappingUUID'];
    if (this.mappingUUID == null) {
      let initial = this.router.lastSuccessfulNavigation?.extras.state?.['initial'];
      if (initial && initial.mapping instanceof Mapping) {
        this.saveRequired = true;
        this.mappingName = initial.mappingName;
        this.projectName = initial.projectName;
        this.setInitialMapping(initial.mapping as Mapping, initial.allTopics);
        this.setTitle();
        if (this.auth.projectRole(this.projectName) != 'Admin') {
          this.error = "you are not a PI, you won't be able to save";
        }
      } else {
        this.error = "no mapping found";
      }
    } else {
      try {
        let info = await firstValueFrom(this.persistency.mappingInfo(this.mappingUUID));
        this.mappingName = info.mappingName;
        this.projectName = info.projectName;
        this.setTitle();
        let postOp : null | ops.Operation = null;
        let version, mapping;
        try {
          [version, mapping] = await firstValueFrom(
            this.persistency.latestRevisionMapping(this.mappingUUID));
        } catch (err) {
          console.log(err, typeof err);
          if ((err as HttpErrorResponse).status == 404) {
            [version, mapping] = await firstValueFrom(
              this.persistency.legacyMapping(this.mappingUUID));
            let ignoreTermTypes = this.versionInfo.ignoreTermTypes;
            let { conceptsCodes, vocabularies } =
              await this.apiService.remapData(mapping, this.vocabularies, ignoreTermTypes);
            let umlsVersion = this.versionInfo.umlsVersion;
            postOp = new ops.Remap(umlsVersion, conceptsCodes, vocabularies);
            this.snackBar.open("Imported mapping from the old version of CodeMapper and remapped, please save.", "Close");
          } else {
            throw err;
          }
        }
        mapping.cleanupRecacheCheck()
        this.version = version;
        this.mapping = mapping;
        this.reloadReviews();
        this.reloadRevisions();
        if (postOp != null) this.run(postOp);
      } catch (err) {
        this.error = "not mapping found";
        console.error(this.error, err);
      }
    }
  }

  setTitle() {
    this.title.setTitle(`CodeMapper: ${this.mappingName} (${this.projectName})`);
  }

  setInitialMapping(mapping : Mapping, allTopics : any) {
    this.mapping = mapping;
    if (allTopics) {
      this.allTopics = allTopics;
    }
    if (mapping.start == null) {
      this.selectedIndex = 0;
    }
    this.updateMapping(this.mapping);
  }

  async reloadReviews() {
    if (this.mappingUUID != null) {
      let allTopics0 = (await this.apiService.allTopics(this.mappingUUID).toPromise())!;
      let me = this.auth.userSubject.value!.username;
      let cuis = Object.keys(this.mapping.concepts);
      this.allTopics = AllTopics.fromRaw(allTopics0, me, cuis)
    }
  }


  async reloadRevisions() {
    if (this.mappingUUID != null) {
      this.revisions = (await this.persistency.getRevisions(this.mappingUUID).toPromise())!;
    }
  }

  run(op : ops.Operation) {
    this.mapping.run(op);
    op.afterRunCallback();
    this.updateMapping(this.mapping);
    if (op.saveRequired) {
      this.saveRequired = true;
    }
  }

  redo() {
    this.mapping.redo();
    this.updateMapping(this.mapping);
  }

  undo() {
    this.mapping.undo();
    this.updateMapping(this.mapping);
  }

  updateMapping(mapping : Mapping) {
    if (this.allTopics != null) {
      this.allTopics.setConcepts(Object.keys(mapping.concepts));
    }
    this.mapping = mapping.clone();
  }

  async reviewRun(op : ReviewOperation) {
    console.log("review run", op);
    if (this.mappingUUID == null) {
      alert("Please save the mapping before review");
    } else {
      await op.run(this.apiService, this.mappingUUID).toPromise()!;
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
    (this.mappingUUID == null
      ? this.persistency.createMapping(this.projectName, this.mappingName)
        .pipe(map(m => m.mappingUUID))
      : of(this.mappingUUID)
    ).subscribe(mappingUUID => {
      console.log("MAPPING UUID", mappingUUID);
      this.persistency.saveRevision(mappingUUID, this.mapping, summary)
        .subscribe(async version => {
          if (this.saveRequired) {
            try {
              await this.apiService.saveAllTopics(mappingUUID, this.allTopics.toRaw())
                .toPromise()!;
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
          if (this.mappingUUID == null) {
            this.router.navigate(["/mapping", mappingUUID]);
          }
        }, err => {
          console.error("Could not save mapping", err);
          this.snackBar.open("Could not save mapping: " + err.message, "Close");
        });
    });
  }

  undoTooltip() : string | undefined {
    if (this.mapping.undoStack.length == 0) {
      return;
    }
    return `Undo (${this.mapping.undoStack[0][0]})`
  }

  redoTooltip() : string | undefined {
    if (this.mapping.redoStack.length == 0) {
      return;
    }
    return `Redo (${this.mapping.redoStack[0][0]})`
  }

  titleTooltip() : string {
    let role = this.auth.projectRole(this.projectName)?.toLowerCase();
    let res = `Project: ${this.projectName} (you are ${role})`;
    if (this.saveRequired) {
      res += `, mapping needs save`;
    }
    return res;
  }

  async setStartIndexing(indexing : Indexing) {
    if (this.mapping.start === null) {
      let vocIds = Object.keys(this.mapping.vocabularies);
      await this.apiService.concepts(indexing.selected, vocIds)
        .subscribe(({ concepts, codes }) => {
          let op = new ops.SetStartIndexing(indexing, concepts, codes)
            .withAfterRunCallback(() => this.selectedIndex = 1);
          this.run(op);
        });
    }
  }
}
