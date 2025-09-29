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
import { Location } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Vocabularies,
  ServerInfo,
  EMPTY_SERVER_INFO,
  MappingMeta,
  StartType,
  MappingFormat,
  DataMeta,
} from '../mapping-data';
import { MappingState } from "../mapping-state";
import { AllTopics, ReviewData } from '../review';
import * as ops from '../operations';
import { ApiService } from '../api.service';
import {
  emptyMappingInfo,
  MappingInfo,
  mappingInfoLink,
  PersistencyService,
  ProjectRole,
  RevisionInfo,
  slugifyMappingInfo,
  userCanDownload,
  userCanEdit,
} from '../persistency.service';
import { AuthService } from '../auth.service';
import { HasPendingChanges } from '../pending-changes.guard';
import { ReviewOperation } from '../review';
import {
  DownloadDialogComponent,
  includeDescendants,
} from '../download-dialog/download-dialog.component';
import { StartData } from '../start-mapping/start-mapping.component';
import { Mapping } from '../mapping';

export enum Tabs {
  Start = 0,
  Concepts = 1,
  Codes = 2,
  Vocabularies = 3,
  Review = 4,
  Tools = 5,
  History = 6,
}

function parseNameShortkey(name: string): string | null {
  let ix = name.lastIndexOf('-');
  return name.substring(ix == -1 ? 0 : ix + 1);
}

export interface Initial {
  mappingName: string;
  folderName: string;
  meta: MappingMeta;
}

@Component({
    selector: 'app-mapping-view',
    templateUrl: './mapping-view.component.html',
    styleUrls: ['./mapping-view.component.scss'],
    standalone: false
})
export class MappingViewComponent implements HasPendingChanges {
  initial: Initial | null = null; // non-null iff starting
  state: MappingState | null = null; // null iff starting

  shortkey: string | null = null; // non-null if saved
  info: MappingInfo = emptyMappingInfo();
  latest: RevisionInfo | null = null;
  revisions: RevisionInfo[] = [];
  allTopics: AllTopics = new AllTopics();
  reviewData: ReviewData = new ReviewData();

  vocabularies: Vocabularies = {};
  serverInfo: ServerInfo = EMPTY_SERVER_INFO;
  selectedIndex: number = 1;
  saveReviewRequired: boolean = false;
  saveRequired: boolean = false;
  error: string | null = null;
  projectRole: ProjectRole | null = null;
  importWarning: string | undefined;

  startMode: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private persistency: PersistencyService,
    private apiService: ApiService,
    private title: Title,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private auth: AuthService,
    private location: Location
  ) {}

  get hasPendingChanges(): boolean {
    return this.state != null && this.state.stacks.undoStack.length > 0;
  }

  get userCanEdit() {
    return userCanEdit(this.projectRole);
  }

  get userCanDownload() {
    return userCanDownload(this.projectRole);
  }

  async ngOnInit() {
    let vocabularies = await firstValueFrom(this.apiService.vocabularies());
    this.vocabularies = Object.fromEntries(vocabularies.map((v) => [v.id, v]));
    this.serverInfo = await firstValueFrom(this.apiService.serverInfo());

    let params = await firstValueFrom(this.route.params);
    let nameParam = params['name'];
    let initial =
      this.router.lastSuccessfulNavigation?.extras.state?.['initial'];

    if (initial) {
      await this.setInitialMapping(initial);
      this.setTitle();
      this.projectRole = await firstValueFrom(
        this.persistency.getProjectRole(this.info.projectName)
      );
      if (this.projectRole != ProjectRole.Owner)
        this.snackBar.open(
          'You are not owner of the project, you will not be able to save this new mapping',
          'Ok'
        );
    } else if (nameParam) {
      this.shortkey = parseNameShortkey(nameParam);
      if (this.shortkey == null) {
        this.snackBar.open('Invalid mapping name', 'Ok');
        return;
      }
      try {
        this.info = await firstValueFrom(
          this.persistency.mappingInfo(this.shortkey)
        );
        if (slugifyMappingInfo(this.info) != nameParam) {
          this.location.go(mappingInfoLink(this.info).join('/'));
        }
        this.setTitle();
        this.info.meta = await firstValueFrom(
          this.persistency.mappingMeta(this.shortkey)
        );
        if (this.info.status == 'IMPORTED') {
          this.snackBar.open(
            'This mapping was automatically imported, please review carefully and save it, or report any issues.',
            'Ok',
            { duration: undefined }
          );
        }
        this.projectRole = await firstValueFrom(
          this.persistency.getProjectRole(this.info.projectName)
        );
        let postOp: null | ops.Operation = null, mapping;
        try {
          ({ info: this.latest, mapping } = await firstValueFrom(
            this.persistency.loadLatestRevisionMapping(
              this.shortkey!,
              this.serverInfo
            )
          ));
          this.state = new MappingState(Mapping.fromData(mapping));
        } catch (err) {
          if ((err as HttpErrorResponse).status == 404) {
            try {
              let messages, mapping;
              ({
                mapping,
                postOp,
                messages,
              } = await this.loadLegacyMapping(this.shortkey));
              this.state = new MappingState(Mapping.fromData(mapping));
              this.latest = {
                version: -1,
                author: '?',
                timestamp: '?',
                summary: '?',
              };
              messages.unshift(
                `The mapping was automatically imported from the old version of CodeMapper and remapped. Please review and save.`
              );
              this.snackBar.open(messages.join('\n\n'), 'Ok', {
                panelClass: 'remap-snackbar',
              });
            } catch (err) {
              let msg = '';
              if ((err as HttpErrorResponse).status != 404) {
                console.error('error while loading legacy mapping', err);
                msg = ` (${(err as any).error})`;
              }
              this.snackBar.open('Could not load mapping' + msg, 'Ok');
              return;
            }
          } else {
            console.error('Error while loading latest revision', err);
            this.snackBar.open('Could not load mapping', 'Ok');
            return;
          }
        }
        this.state!.cacheAndCheck();
        this.reloadReviews();
        this.reloadRevisions();
        if (postOp != null) this.run(postOp);
      } catch (err) {
        console.error('Error while loading mapping info', err);
        this.snackBar.open('Could not load mapping', 'Ok');
      }
      return;
    } else {
      this.snackBar.open('There is no mapping', 'Ok');
      this.router.navigate(['/folders']);
    }
  }

  setTitle() {
    let name = this.info.meta.definition ?? this.info.mappingName;
    this.title.setTitle(`CodeMapper: ${name} (${this.info.projectName})`);
  }

  async setInitialMapping(initial: Initial) {
    this.saveRequired = true;
    this.initial = initial;
    this.info = {
      mappingShortkey: null,
      projectName: initial.folderName,
      mappingName: initial.mappingName,
      status: null,
      meta: initial.meta,
    };
  }

  defaultVocabularies(): Vocabularies {
    return Object.fromEntries(
      this.serverInfo.defaultVocabularies.map((id) => [
        id,
        this.vocabularies[id],
      ])
    );
  }

  async setStart(data: StartData) {
    if (!this.initial) return;
    let dataMeta: DataMeta = {
      formatVersion: MappingFormat.version,
      umlsVersion: this.serverInfo.umlsVersion,
      allowedTags: this.serverInfo.defaultAllowedTags,
      ignoreTermTypes: this.serverInfo.defaultIgnoreTermTypes,
      ignoreSemanticTypes: this.serverInfo.defaultIgnoreSemanticTypes,
      includeDescendants: false,
    };
    this.info = {
      mappingShortkey: null,
      mappingName: this.initial.mappingName,
      projectName: this.initial.folderName,
      meta: this.initial.meta as MappingMeta,
      status: null,
    };
    this.initial = null;
    this.state = new MappingState(Mapping.fromData({
      meta: dataMeta,
      start: data.start,
      vocabularies: data.vocabularies ?? this.defaultVocabularies(),
      concepts: data.concepts ?? {},
      codes: data.codes ?? {}
    }));
    this.latest = null;
    this.saveRequired = true;
    this.saveReviewRequired = true;
    this.importWarning = data.importWarning;
    this.allTopics = data.allTopics ?? new AllTopics();
    this.selectedIndex = 1;
    this.updateTopics();
  }

  async loadLegacyMapping(mappingShortkey: string) {
    let mapping = await firstValueFrom(
      this.persistency.loadLegacyMapping(mappingShortkey, this.serverInfo)
    );
    let { conceptsCodes, vocabularies, messages } =
      await this.apiService.remapData(mapping, this.vocabularies, mapping.meta);
    let umlsVersion = this.serverInfo.umlsVersion;
    let postOp = new ops.Remap(umlsVersion, conceptsCodes, vocabularies);
    return { mapping, postOp, messages };
  }

  async reloadReviews() {
    if (this.state && this.shortkey) {
      let allTopics0 = await firstValueFrom(
        this.apiService.allTopics(this.shortkey)
      );
      let user = await this.auth.user;
      let me = user?.username ?? 'anonymous';
      let cuis = Object.keys(this.state.mapping.concepts);
      this.allTopics = AllTopics.fromRaw(allTopics0, me, cuis);
    }
  }

  async reloadRevisions() {
    if (this.shortkey) {
      this.revisions = await firstValueFrom(
        this.persistency.getRevisions(this.shortkey)
      );
    }
  }

  run(op: ops.Operation) {
    if (!this.state) return;
    this.state.run(op, this.allTopics);
    op.afterRunCallback();
    this.state = this.state.cloneCacheAndCheck();
    this.updateTopics();
    if (op.saveRequired) {
      this.saveRequired = true;
    }
    if (op.saveReviewRequired) {
      this.saveReviewRequired = true;
    }
  }

  redo() {
    if (!this.state) return;
    this.state.redo(this.allTopics);
    this.state = this.state.cloneCacheAndCheck();
    this.updateTopics();
  }

  undo() {
    if (!this.state) return;
    this.state.undo(this.allTopics);
    this.state = this.state.cloneCacheAndCheck();
    this.updateTopics();
  }

  updateTopics() {
    if (this.state && this.allTopics != null) {
      this.allTopics.setConcepts(Object.keys(this.state.mapping.concepts));
    }
  }

  async reviewRun(op: ReviewOperation) {
    if (this.shortkey) {
      await firstValueFrom(op.run(this.apiService, this.shortkey))!;
      await this.reloadReviews();
    } else {
      alert('Please save the mapping before review');
    }
  }

  dump() {
    console.log('STATE', this);
  }

  openDialog(templateRef: TemplateRef<any>) {
    this.dialog.open(templateRef, {
      width: '700px',
    });
  }

  openDownloadDialog() {
    if (!this.shortkey) return;
    let data = {
      projectName: this.info.projectName,
      mappingConfigs: [this.shortkey],
      includeDescendants: includeDescendants(
        this.state?.mapping.meta.includeDescendants ?? false
      ),
      mappings: {
        [this.shortkey]: {
          name: this.info.mappingName,
          meta: this.info.meta,
        },
      },
    };
    this.dialog.open(DownloadDialogComponent, { data, disableClose: true });
  }

  async save(summary: string) {
    if (!this.state) return;
    if (this.importWarning != null) summary += '\n\n' + this.importWarning;
    try {
      let shortkey =
        this.shortkey ??
        (await this.persistency.createMapping(
          this.info.projectName,
          this.info.mappingName,
          this.info.meta
        ));
      this.latest = await firstValueFrom(
        this.persistency.saveRevision(shortkey, this.state.mapping, summary)
      );
      if (this.saveReviewRequired) {
        try {
          await firstValueFrom(
            this.apiService.saveAllTopics(shortkey, this.allTopics.toRaw())
          );
          this.saveReviewRequired = false;
        } catch (err) {
          console.error('Could not save all review topics', err);
          let msg = (err as any).error ?? 'unknown reason';
          alert('Could not save all review topics: ' + msg);
        }
      }
      this.snackBar.open('Saved version ' + this.latest.version, 'Ok', {
        duration: 2000,
      });
      this.state!.stacks.clear();
      this.reloadRevisions();
      if (!this.info.mappingShortkey) this.info.mappingShortkey = shortkey;
      if (!this.shortkey) {
        this.router.navigate(mappingInfoLink(this.info));
      }
    } catch (err) {
      console.error('Could not save mapping', err);
      this.snackBar.open(
        'Could not save mapping: ' + (err as any).message,
        'Close'
      );
    }
  }

  titleTooltip(): string {
    let snippets: string[] = [];
    if (this.info?.mappingName) {
      snippets.push(this.info?.mappingName);
    }
    if (this.info.meta?.system) {
      snippets.push(`system: ${this.info.meta.system}`);
    }
    if (this.info.meta?.type) {
      snippets.push(`type: ${this.info.meta.type}`);
    }
    snippets.push(
      `${
        this.state?.mapping.meta.includeDescendants ? 'include' : 'exclude'
      } descendant codes`
    );
    let res = snippets.join(', ') + '.';
    res = res[0].toUpperCase() + res.slice(1);
    if (this.saveRequired) {
      res += ` Mapping needs save.`;
    }
    res += ` You are ${
      this.projectRole?.toLowerCase() ?? 'not a member'
    } in this folder.`;
    return res;
  }

  shortMeta(): string {
    let snippets: string[] = [];
    if (this.info.meta?.system) {
      snippets.push(this.info.meta.system);
    }
    if (this.info.meta?.type) {
      snippets.push(this.info.meta.type);
    }
    return snippets.join('/');
  }

  setEmptyStart() {
    if (!this.state) return;
    this.state.mapping.start = { type: StartType.Empty };
  }
}
