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

import {
  Input,
  Output,
  Component,
  SimpleChanges,
  EventEmitter,
  ViewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs';
import { VocabulariesDialogComponent } from '../vocabularies-dialog/vocabularies-dialog.component';
import { VocabulariesTableComponent } from '../vocabularies-table/vocabularies-table.component';
import { CustomVocabularyDialogComponent } from '../custom-vocabulary-dialog/custom-vocabulary-dialog.component';
import { ApiService } from '../api.service';
import { Mapping, Vocabulary } from '../data';
import * as ops from '../mapping-ops';

@Component({
  selector: 'vocabularies',
  templateUrl: './vocabularies.component.html',
  styleUrls: ['./vocabularies.component.scss'],
})
export class VocabulariesComponent {
  @Input() mapping: Mapping | null = null;
  @Output() run = new EventEmitter<ops.Operation>();
  @Input() userCanEdit: boolean = false;
  @ViewChild('table') table!: VocabulariesTableComponent;
  vocabularies: Vocabulary[] = [];

  constructor(private dialog: MatDialog, private api: ApiService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (this.mapping == null) {
      this.vocabularies = [];
    } else {
      this.vocabularies = Object.values(this.mapping.vocabularies);
      this.vocabularies.sort(Vocabulary.compare);
    }
  }

  delete(vocs: Vocabulary[]) {
    this.run.emit(new ops.DeleteVocabularies(vocs.map((v) => v.id)));
    this.table.selection.clear();
  }

  addStandard() {
    let vocIds = new Set(this.vocabularies.map((v) => v.id));
    this.api
      .vocabularies()
      .pipe(
        map((vocs) => {
          return vocs.filter((v) => !vocIds.has(v.id));
        })
      )
      .subscribe((vocs) => {
        vocs.sort(Vocabulary.compare);
        return this.dialog
          .open(VocabulariesDialogComponent, { data: { vocabularies: vocs } })
          .afterClosed()
          .subscribe(async (vocs) => {
            if (vocs == null) return;
            let cuis = Object.keys(this.mapping!.concepts);
            let vocIds = (vocs as Vocabulary[]).map((v) => v.id);
            let { concepts, codes } = await this.api.concepts(
              cuis,
              vocIds,
              this.mapping!.meta
            );
            let conceptCodes = Object.fromEntries(
              Object.entries(concepts).map(([cui, concept]) => [
                cui,
                Object.fromEntries(
                  Object.entries(concept.codes).map(([vocId, codeIds]) => [
                    vocId,
                    Array.from(codeIds),
                  ])
                ),
              ])
            );
            let codes1 = Object.fromEntries(
              Object.entries(codes).map(([vocId, codes]) => [
                vocId,
                Object.values(codes),
              ])
            );
            this.run.emit(new ops.AddVocabularies(vocs, codes1, conceptCodes));
          });
      });
  }

  createCustom() {
    this.dialog
      .open(CustomVocabularyDialogComponent, {
        data: { id: '', name: '', codesCSV: '' },
      })
      .afterClosed()
      .subscribe((data) => {
        let voc = new Vocabulary(data.id, data.name, null, true);
        this.run.emit(new ops.AddVocabularies([voc], {}, {}));
      });
  }
}
