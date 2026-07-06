import { Component, Inject, ViewChild, AfterViewInit } from '@angular/core';
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
import { MatSort } from '@angular/material/sort';

export interface SelectMappingsResult {
  folderName: string;
  mappingInfos: MappingInfo[];
  copyComments: boolean;
}

@Component({
  selector: 'copy-mappings',
  standalone: false,
  templateUrl: './select-mappings-dialog.component.html',
  styleUrl: './select-mappings-dialog.component.scss',
})
export class SelectMappingsDialogComponent implements AfterViewInit {
  @ViewChild(MatSort) sort!: MatSort;
  folderNames: string[] = [];
  selectedFolder: string | undefined = undefined;
  dataSource = new MatTableDataSource<MappingInfo>([]);
  displayedColumns: string[] = ['select', 'name', 'type', 'system'];
  selection = new SelectionModel<MappingInfo>(true, []);
  searchQuery = '';
  copyComments = false;
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
    this.dataSource.sortingDataAccessor = (row, column) => {
      switch (column) {
        case 'name': return (row.meta.definition ?? row.mappingName).toLowerCase();
        case 'type': return (row.meta.type ?? '').toLowerCase();
        case 'system': return (row.meta.system ?? '').toLowerCase();
        default: return '';
      }
    };
    this.dataSource.filterPredicate = (row, filter) => {
      const name = (row.meta.definition ?? row.mappingName).toLowerCase();
      const type = (row.meta.type ?? '').toLowerCase();
      const system = (row.meta.system ?? '').toLowerCase();
      return name.includes(filter) || type.includes(filter) || system.includes(filter);
    };
    this.auth.rolesSubject.subscribe((roles) => {

      this.folderNames = Object.entries(roles)
        .filter(([_, role]) => userCanDownload(role))
        .map(([name, _]) => name);
      this.selectedFolder = this.folderNames[0];
      this.changedFolder(this.selectedFolder);
    });
  }
  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
  }

  async changedFolder(selectedFolder: string) {
    this.dataSource.data = [];
    this.dataSource.filter = '';
    this.searchQuery = '';
    this.selection = new SelectionModel<MappingInfo>(true, []);
    if (this.selectedFolder !== undefined) {
      this.dataSource.data = await firstValueFrom(
        this.persistency.projectMappingInfos(this.selectedFolder)
      );
    }
  }

  applyFilter(query: string) {
    this.dataSource.filter = query.trim().toLowerCase();
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
      copyComments: this.copyComments,
    });
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.filteredData.length;
    return numSelected == numRows;
  }

  toggleAllRows() {
    this.isAllSelected()
      ? this.selection.clear()
      : this.dataSource.filteredData.forEach((row) => this.selection.select(row));
  }
}
