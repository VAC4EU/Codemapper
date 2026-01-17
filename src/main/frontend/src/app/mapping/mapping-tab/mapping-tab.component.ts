import {
  Component,
  EventEmitter,
  Input,
  Output,
  viewChild,
} from '@angular/core';
import {
  CsvImport,
  Indexing,
  Start,
  StartType,
  ServerInfo,
  Vocabularies,
  EmptyStart,
} from '../mapping-data';
import { ApiService } from '../api.service';
import * as ops from '../operations';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  MappingInfo,
  PersistencyService,
  ProjectRole,
  RevisionInfo,
} from '../persistency.service';
import { MatDialog } from '@angular/material/dialog';
import { EditMetaComponent } from '../edit-meta/edit-meta.component';
import { MappingState } from '../mapping-state';
import { EditDescriptionComponent } from '../edit-description/edit-description.component';
import { CrepeComponent } from '../crepe/crepe.component';

@Component({
  selector: 'mapping-tab',
  templateUrl: './mapping-tab.component.html',
  styleUrls: ['./mapping-tab.component.scss'],
  standalone: false,
})
export class MappingTabComponent {
  @Input({ required: true }) projectName!: string;
  @Input({ required: true }) shortkey!: string | null;
  @Input({ required: true }) info!: MappingInfo;
  @Input({ required: true }) state!: MappingState;
  @Input({ required: true }) serverInfo!: ServerInfo;
  @Input({ required: true }) vocabularies!: Vocabularies;
  @Input({ required: true }) latest: RevisionInfo | null = null;
  @Input({ required: true }) revisions: RevisionInfo[] = [];
  @Input({ required: true }) projectRole: ProjectRole | null = null;
  @Input() userCanDownload: boolean = false;
  @Input() userCanEdit: boolean = false;
  @Output() run = new EventEmitter<ops.Operation>();
  description = viewChild.required<CrepeComponent>('description');

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

  isEmptyStart(start: Start): start is EmptyStart {
    return start != null && start.type == StartType.Empty;
  }

  toggleIncludeDescendants() {
    let value = !this.state.mapping.meta.includeDescendants;
    this.run.emit(new ops.SetIncludeDescendants(value));
  }

  async remap() {
    if (this.serverInfo.umlsVersion != null) {
      let { conceptsCodes, vocabularies, messages } = await this.api.remapData(
        this.state.mapping,
        this.vocabularies,
        this.state.mapping.meta
      );
      if (messages.length) {
        this.snackBar.open(messages.join('\n\n'), 'Ok', {
          panelClass: 'remap-snackbar',
        });
      }
      this.run.emit(
        new ops.Remap(this.serverInfo.umlsVersion, conceptsCodes, vocabularies)
      );
    } else {
      console.error('unknown UMLS version');
    }
  }

  editDescription() {
    let mappingName = `${this.info.meta.system}_${this.info.mappingName}_${this.info.meta.type}`;
    this.dialog
      .open(EditDescriptionComponent, {
        data: { description: this.info.description, mappingName },
        width: '1000px',
      })
      .afterClosed()
      .subscribe(async (description) => {
        if (description == undefined) return;
        this.info.description = description;
        this.description().setMarkdown(description);
        if (!this.shortkey) return;
        try {
          await EditDescriptionComponent.save(
            this.persistency,
            this.shortkey,
            description
          );
        } catch (e) {
          let msg = `Could not save description`;
          console.error(msg, e);
          alert(msg);
        }
      });
  }

  editMappingMeta() {
    this.dialog
      .open(EditMetaComponent, {
        data: { name: this.info.mappingName, meta: this.info.meta },
      })
      .afterClosed()
      .subscribe(async (result) => {
        if (result) {
          if (!this.shortkey) {
            EditMetaComponent.set(this.info, result);
          } else {
            try {
              await EditMetaComponent.save(
                this.info,
                this.persistency,
                this.shortkey,
                result
              );
            } catch (e) {
              let msg = `Could not save name or meta`;
              console.error(msg, e);
              alert(msg);
            }
          }
        }
      });
  }
}
