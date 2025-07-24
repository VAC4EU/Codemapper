import {
  Component,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
} from '@angular/core';
import {
  CsvImport,
  Indexing,
  Mapping,
  Start,
  StartType,
  ServerInfo,
  Vocabularies,
  Revision,
  MappingMeta,
} from '../data';
import { ApiService } from '../api.service';
import * as ops from '../mapping-ops';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PersistencyService, ProjectRole } from '../persistency.service';
import { MatDialog } from '@angular/material/dialog';
import { EditMetaComponent } from '../edit-meta/edit-meta.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'mapping-tab',
  templateUrl: './mapping-tab.component.html',
  styleUrls: ['./mapping-tab.component.scss'],
})
export class MappingTabComponent {
  @Input({ required: true }) projectName!: string;
  @Input({ required: true }) mappingShortkey!: string | null;
  @Input({ required: true }) mapping!: Mapping;
  @Input({ required: true }) meta!: MappingMeta;
  @Input({ required: true }) serverInfo!: ServerInfo;
  @Input({ required: true }) vocabularies!: Vocabularies;
  @Input() userCanDownload: boolean = false;
  @Input() userCanEdit: boolean = false;
  @Input() revisions: Revision[] = [];
  @Input() version: number = -1;
  @Output() run = new EventEmitter<ops.Operation>();
  @Input({ required: true }) projectRole: ProjectRole | null = null;

  constructor(
    private api: ApiService,
    private persistency: PersistencyService,
    public dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  isIndexing(start: Start): start is Indexing {
    return start != null && start.type == StartType.Indexing;
  }

  isCsvImport(start: Start): start is CsvImport {
    return start != null && start.type == StartType.CsvImport;
  }

  remap() {
    if (this.serverInfo.umlsVersion != null) {
      (async () => {
        let { conceptsCodes, vocabularies, messages } =
          await this.api.remapData(
            this.mapping,
            this.vocabularies,
            this.mapping.meta
          );
        if (messages.length) {
          this.snackBar.open(messages.join('\n\n'), 'Ok', {
            panelClass: 'remap-snackbar',
          });
        }
        this.run.emit(
          new ops.Remap(
            this.serverInfo.umlsVersion,
            conceptsCodes,
            vocabularies
          )
        );
      })();
    } else {
      console.error('unknown UMLS version');
    }
  }

  editMappingMeta() {
    this.dialog
      .open(EditMetaComponent, { data: { meta: this.meta } })
      .afterClosed()
      .subscribe(async (meta) => {
        if (meta != null) {
          try {
            await firstValueFrom(
              this.persistency.setMappingMeta(this.mappingShortkey, meta)
            );
            this.meta = meta;
          } catch (e) {
            let msg = `Could not save metadata`;
            console.error(msg, e);
            alert(msg);
          }
        }
      });
  }
}
