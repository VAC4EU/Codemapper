import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  Codes,
  Concepts,
  EMPTY_SERVER_INFO,
  Indexing,
  ServerInfo,
  Start,
  StartType,
  Vocabularies,
} from '../mapping-data';
import { ApiService, ImportedMapping, TypesInfo } from '../api.service';
import { AllTopics } from '../review';
import { MappingInfo } from '../persistency.service';

export interface StartData {
  start: Start;
  vocabularies?: Vocabularies;
  concepts?: Concepts;
  codes?: Codes;
  allTopics?: AllTopics;
  importWarning?: string;
}

@Component({
  selector: 'start-mapping',
  templateUrl: './start-mapping.component.html',
  styleUrls: ['./start-mapping.component.scss'],
})
export class StartMappingComponent {
  mode: string = 'edf';

  @Input({ required: true }) vocIds: string[] = [];
  @Input({ required: true }) serverInfo!: ServerInfo;
  @Input({ required: true }) mappingInfo!: MappingInfo;
  @Output() start = new EventEmitter<StartData>();

  constructor(private apiService: ApiService) {}

  async ngOnInit() {}

  setStartEmpty() {
    let start: Start = { type: StartType.Empty };
    let data: StartData = {
      start,
    };
    this.start.emit(data);
  }

  async setStartIndexing(indexing: Indexing) {
    let { concepts, codes } = await this.apiService.concepts(
      indexing.selected,
      this.vocIds,
      this.typesInfo(this.serverInfo)
    );
    let data: StartData = {
      start: indexing,
      concepts,
      codes,
    };
    this.start.emit(data);
  }

  setImportedMapping(imported: ImportedMapping) {
    if (imported.warnings) {
      let warnings = imported.warnings.join(', ');
      if (!confirm(`${warnings}. Continue?`)) return;
    }
    let data: StartData = {
      start: { type: StartType.CsvImport, csvContent: imported.csvContent },
      vocabularies: imported.mapping.vocabularies,
      concepts: imported.mapping.concepts,
      codes: imported.mapping.codes,
      allTopics: AllTopics.fromRaw(
        imported.allTopics,
        null,
        Object.keys(imported.mapping.concepts)
      ),
    };
    this.start.emit(data);
  }

  typesInfo(info: ServerInfo): TypesInfo {
    return {
      ignoreSemanticTypes: info.defaultIgnoreSemanticTypes,
      ignoreTermTypes: info.defaultIgnoreTermTypes,
    };
  }
}
