import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CsvImport, Indexing, Mapping, Start, StartType, ServerInfo, Vocabularies, Revision } from '../data';
import { ApiService } from '../api.service';
import * as ops from '../mapping-ops';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProjectRole } from '../persistency.service';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'mapping-tab',
  templateUrl: './mapping-tab.component.html',
  styleUrls: ['./mapping-tab.component.scss']
})
export class MappingTabComponent {
  @Input({ required: true }) projectName! : string;
  @Input() mappingShortkey! : string | null;
  @Input() mapping! : Mapping;
  @Input() serverInfo! : ServerInfo;
  @Input() vocabularies! : Vocabularies;
  @Input() userCanDownload : boolean = false;
  @Input() userCanEdit : boolean = false;
  @Input() revisions : Revision[] = [];
  @Input() version : number = -1;
  @Output() run = new EventEmitter<ops.Operation>();
  @Input({ required: true }) projectRole : ProjectRole | null = null;

  constructor(
    private api : ApiService,
    public dialog : MatDialog,
    private snackBar : MatSnackBar,
  ) { }

  isIndexing(start : Start) : start is Indexing {
    return start != null && start.type == StartType.Indexing
  }

  isCsvImport(start : Start) : start is CsvImport {
    return start != null && start.type == StartType.CsvImport
  }

  remap() {
    if (this.serverInfo.umlsVersion != null) {
      (async () => {
        let { conceptsCodes, vocabularies, messages } =
          await this.api.remapData(this.mapping, this.vocabularies, this.mapping.meta);
        if (messages.length) {
          this.snackBar.open(messages.join("\n\n"), "Ok", { panelClass: 'remap-snackbar' });
        }
        this.run.emit(new ops.Remap(this.serverInfo.umlsVersion, conceptsCodes, vocabularies));
      })();
    } else {
      console.error("unknown UMLS version");
    }
  }
}
