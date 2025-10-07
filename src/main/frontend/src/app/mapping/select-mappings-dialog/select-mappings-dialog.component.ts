import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SelectionModel } from '@angular/cdk/collections';
import { AuthService } from '../auth.service';
import {
  MappingInfo,
  PersistencyService,
  userCanDownload,
} from '../persistency.service';
import { firstValueFrom } from 'rxjs';
import { MatTableDataSource } from '@angular/material/table';

export interface SelectMappingsResult {
  folderName: string;
  mappingInfos: MappingInfo[];
}

@Component({
  selector: 'copy-mappings',
  standalone: false,
  templateUrl: './select-mappings-dialog.component.html',
  styleUrl: './select-mappings-dialog.component.scss',
})
export class SelectMappingsDialogComponent {
  folderNames: string[] = [];
  selectedFolder: string | undefined = undefined;
  dataSource = new MatTableDataSource<MappingInfo>([]);
  displayedColumns: string[] = ['select', 'name', 'type', 'system'];
  selection = new SelectionModel<MappingInfo>(true, []);
  constructor(
    private dialogRef: MatDialogRef<
      SelectMappingsDialogComponent,
      SelectMappingsResult
    >,
    @Inject(MAT_DIALOG_DATA)
    protected data: {
      title?: string;
      description?: string;
    },
    private auth: AuthService,
    private persistency: PersistencyService
  ) {
    this.auth.rolesSubject.subscribe((roles) => {
      this.folderNames = Object.entries(roles)
        .filter(([_, role]) => userCanDownload(role))
        .map(([name, _]) => name);
      this.selectedFolder = this.folderNames[0];
      this.changedFolder(this.selectedFolder);
    });
  }
  async changedFolder(selectedFolder: string) {
    this.dataSource.data = [];
    this.selection = new SelectionModel<MappingInfo>(true, []);
    if (this.selectedFolder !== undefined) {
      this.dataSource.data = await firstValueFrom(
        this.persistency.projectMappingInfos(this.selectedFolder)
      );
    }
  }
  submit() {
    let info = this.selection.selected;
    if (
      this.selectedFolder === undefined ||
      this.selection.selected.length == 0
    )
      return;
    this.dialogRef.close({
      folderName: this.selectedFolder,
      mappingInfos: this.selection.selected,
    });
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected == numRows;
  }

  toggleAllRows() {
    this.isAllSelected()
      ? this.selection.clear()
      : this.dataSource.data.forEach((row) => this.selection.select(row));
  }
}
