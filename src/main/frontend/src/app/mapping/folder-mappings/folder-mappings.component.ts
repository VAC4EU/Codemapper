import { Component, Input, TemplateRef, ViewChild } from '@angular/core';
import {
  MappingInfo,
  mappingInfoLink,
  PersistencyService,
  ProjectRole,
  userCanCreate,
  userCanDownload,
  userCanRename,
} from '../persistency.service';
import { DownloadDialogComponent } from '../download-dialog/download-dialog.component';
import {
  EMPTY_SERVER_INFO,
  Mapping,
  MappingFormat,
  MappingMeta,
  ServerInfo,
  Start,
  StartType,
} from '../data';
import { AuthService, User } from '../auth.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { ApiService, ImportedMapping } from '../api.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ImportCsvDialogComponent } from '../import-csv-dialog/import-csv-dialog.component';
import { AllTopics } from '../review';
import { SelectionModel } from '@angular/cdk/collections';

@Component({
  selector: 'folder-mappings',
  templateUrl: './folder-mappings.component.html',
  styleUrls: ['./folder-mappings.component.scss'],
})
export class FolderMappingsComponent {
  @Input({ required: true }) user!: User;
  @Input({ required: true }) role!: ProjectRole;

  serverInfo: ServerInfo = EMPTY_SERVER_INFO;
  folderName: string = '';
  newEventName: string = '';
  mappings: MappingInfo[] = [];
  selectedMappings: MappingInfo[] = [];
  filter: string = '';
  selection = new SelectionModel<MappingInfo>(true, []);
  dataSource: MatTableDataSource<MappingInfo> =
    new MatTableDataSource<MappingInfo>();
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private api: ApiService,
    private persistency: PersistencyService,
    private route: ActivatedRoute,
    private router: Router,
    private title: Title,
    private dialog: MatDialog,
    private snackbar: MatSnackBar
  ) {}

  async ngAfterViewInit() {
    this.serverInfo = await firstValueFrom(this.api.serverInfo());
    this.route.params.subscribe(async (params) => {
      this.folderName = params['folder'];
      await this.reload();
    });
  }

  async reload() {
    this.filter = '';
    this.applyFilter('');
    this.selection.clear();
    this.title.setTitle(`CodeMapper: Folder ${this.folderName}`);
    this.mappings = await firstValueFrom(
      this.persistency.projectMappingInfos(this.folderName)
    );
    this.dataSource.data = Object.values(this.mappings);
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (item: any, property: string) => {
      switch (property) {
        case 'name':
          return item.mappingName;
        default:
          return item[property];
      }
    };
  }

  isAllFilteredSelected() {
    return (
      this.dataSource.filteredData.length <= this.selection.selected.length &&
      this.dataSource.filteredData.every(
        (c) => this.selection.selected.indexOf(c) != -1
      )
    );
  }

  toggleSelectAll() {
    if (this.isAllFilteredSelected()) {
      this.selection.clear();
    } else {
      this.selectAll();
    }
  }

  selectAll() {
    this.dataSource.filteredData.forEach((row) => this.selection.select(row));
  }

  get selectedFilteredMappings(): MappingInfo[] {
    return Array.from(this.selection.selected).filter((m) =>
      this.dataSource.filteredData.some((m1) => m1.mappingName == m.mappingName)
    );
  }

  applyFilter(filterValue: string) {
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  async newMapping(
    projectName: string,
    mappingName: string,
    umlsVersion: string
  ) {
    if (!projectName || !mappingName) {
      return;
    }
    let vocs0 = await firstValueFrom(this.api.vocabularies());
    let vers = await firstValueFrom(this.api.serverInfo());
    let vocabularies = Object.fromEntries(
      vocs0
        .filter((v) => vers.defaultVocabularies.includes(v.id))
        .map((v) => [v.id, v])
    );
    let info = {
      formatVersion: MappingFormat.version,
      umlsVersion,
      allowedTags: this.serverInfo.defaultAllowedTags,
      ignoreTermTypes: this.serverInfo.defaultIgnoreTermTypes,
      ignoreSemanticTypes: this.serverInfo.defaultIgnoreSemanticTypes,
    };
    let mapping = new Mapping(info, null, vocabularies, {}, {});
    let initial = { mappingName, projectName, mapping };
    this.router.navigate(['/mapping'], { state: { initial } });
  }

  importNew(projectName: string) {
    if (!projectName) {
      return;
    }
    let ignoreTermTypes = this.serverInfo.defaultIgnoreTermTypes;
    this.dialog
      .open(ImportCsvDialogComponent, { data: { ignoreTermTypes } })
      .afterClosed()
      .subscribe((imported) => {
        console.log('IMPORTED', imported);
        if (typeof imported == 'object') {
          let start: Start = {
            type: StartType.CsvImport,
            csvContent: imported.csvContent,
          };
          let { mappingName, mapping } = imported as ImportedMapping;
          let { vocabularies, concepts, codes, umlsVersion } = mapping;
          let meta: MappingMeta = {
            formatVersion: MappingFormat.version,
            umlsVersion,
            ignoreTermTypes,
            ignoreSemanticTypes: this.serverInfo.defaultIgnoreSemanticTypes,
            allowedTags: this.serverInfo.defaultAllowedTags,
          };
          let mapping1 = new Mapping(
            meta,
            start,
            vocabularies,
            concepts,
            codes
          );
          let allTopics = AllTopics.fromRaw(
            imported.allTopics,
            null,
            Object.keys(concepts)
          );
          let initial = {
            mappingName,
            projectName,
            mapping: mapping1,
            allTopics,
          };
          this.router.navigate(['/mapping'], { state: { initial } });
        }
      });
  }

  async deleteSelectedMappings() {
    let names = this.selection.selected.map((c) => c.mappingName);
    if (
      !confirm(
        `Do you really want to delete ${names.length} mapping(s): ${names.join(
          ', '
        )}`
      )
    )
      return;
    let shortkeys = this.selection.selected.map((c) => c.mappingShortkey);
    try {
      await this.persistency.deleteMappings(shortkeys);
    } catch (e) {
      this.snackbar.open((e as Error).toString(), 'Ok');
    } finally {
      this.reload();
    }
  }

  openDialog(templateRef: TemplateRef<any>) {
    this.dialog.open(templateRef, { width: '700px' });
  }

  openDownloadDialog(mappings: MappingInfo[]) {
    let data = {
      projectName: this.folderName,
      mappingConfigs: mappings.map((i) => i.mappingShortkey),
    };
    this.dialog.open(DownloadDialogComponent, { data });
  }

  mappingLink(mapping: MappingInfo) {
    return mappingInfoLink(mapping);
  }

  async renameMapping(mapping: MappingInfo, newName: string) {
    await firstValueFrom(
      this.persistency.mappingSetName(mapping.mappingShortkey, newName)
    );
    mapping.mappingName = newName;
    console.log('renamed');
  }

  selectedMappingConfigs(): string[] {
    return this.selectedFilteredMappings.map((info) => info.mappingShortkey);
  }

  localeDate(s: string) {
    let date = new Date(s);
    return date.toLocaleString();
  }

  get userCanDownload() {
    return userCanDownload(this.role);
  }

  get userCanRename() {
    return userCanRename(this.role);
  }

  get userCanCreate() {
    return userCanCreate(this.role);
  }
  canDownload() {
    return (
      this.userCanDownload &&
      this.selectedFilteredMappings.length != 0 &&
      !this.selectedFilteredMappings.some((i) => i.version != null)
    );
  }
}
