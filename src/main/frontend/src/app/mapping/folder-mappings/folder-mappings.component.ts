import {
  Component,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
  ViewChild,
} from '@angular/core';
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
  MappingDataMeta,
  ServerInfo,
  Start,
  StartType,
  MappingMeta,
} from '../data';
import { User } from '../auth.service';
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
import { EditMetaComponent } from '../edit-meta/edit-meta.component';

class NameInfo {
  constructor(
    public system: string,
    public abbreviation: string,
    public typ: string,
    public definition: string
  ) {}
  static parse(name: string): NameInfo | null {
    let parts = name.split('_');
    if (parts.length == 3 || parts.length == 4) {
      return new NameInfo(parts[0], parts[1], parts[2], parts[3] ?? parts[1]);
    } else {
      return new NameInfo('', name, '', '');
    }
  }
}

@Component({
  selector: 'folder-mappings',
  templateUrl: './folder-mappings.component.html',
  styleUrls: ['./folder-mappings.component.scss'],
})
export class FolderMappingsComponent {
  @Input({ required: true }) user!: User;
  @Input({ required: true }) role!: ProjectRole;
  @Output() numMappings = new EventEmitter<number>();
  @ViewChild(MatSort) sort!: MatSort;

  serverInfo: ServerInfo = EMPTY_SERVER_INFO;
  folderName: string = '';
  newEventName: string = '';
  mappings: MappingInfo[] = [];
  nameInfos: { [key: string]: NameInfo | null } = {};
  selectedMappings: MappingInfo[] = [];
  filterOnName: string = '';
  selection = new SelectionModel<MappingInfo>(true, []);
  dataSource: MatTableDataSource<MappingInfo> =
    new MatTableDataSource<MappingInfo>();
  allProperties: { [key: string]: string[] } = {}; // map property type to property values
  filterOnProperties: { [key: string]: string | null } = {}; // map property type to property value

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
    this.filterOnName = '';
    this.filterOnProperties = {};
    this.selection.clear();
    this.title.setTitle(`CodeMapper: Folder ${this.folderName}`);
    this.mappings = await firstValueFrom(
      this.persistency.projectMappingInfos(this.folderName)
    );
    this.allProperties = this.getAllTags();
    this.numMappings.emit(this.mappings.length);
    this.nameInfos = Object.fromEntries(
      this.mappings.map((m) => [
        m.mappingShortkey,
        NameInfo.parse(m.mappingName),
      ])
    );
    this.dataSource.data = Object.values(this.mappings);
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = (info: MappingInfo, _filter: string) => {
      for (let [prop, value] of Object.entries(this.filterOnProperties)) {
        if (value == null || info.meta == null) continue;
        if (['system', 'type'].includes(prop)) {
            if (info.meta[prop as keyof MappingMeta] != value) {
              return false;
            }
        }
        if ('project' == prop) {
            if (!(info.meta?.projects ?? []).includes(value)) {
              return false;
            }
        }
      }
      let filter = this.filterOnName.toLowerCase().trim();
      return info.mappingName.toLowerCase().includes(filter);
    };
    this.dataSource.sortingDataAccessor = (mapping: any, property: string) => {
      property = { name: 'mappingName' }[property] ?? property;
      return mapping[property] ?? mapping.meta?.[property];
    };
  }

  getAllTags(): { [key: string]: string[] } {
    let systems: Set<string> = new Set();
    let types: Set<string> = new Set();
    let projects: Set<string> = new Set();
    for (let mapping of this.mappings) {
      let system = mapping.meta?.system;
      if (system != null) {
        systems.add(system);
      }
      let type = mapping.meta?.type;
      if (type != null) {
        types.add(type);
      }
      for (let project of mapping.meta?.projects ?? []) {
        projects.add(project)
      }
    }
    return {
      system: Array.from(systems),
      type: Array.from(types),
      project: Array.from(projects),
    };
  }

  hasFilters(): boolean {
    return (
      this.filterOnName != '' || this.hasFilterOnProperties()
    );
  }

  hasFilterOnProperties(): boolean {
    return Object.values(this.filterOnProperties).filter((v) => v != null).length > 0
  }

  clearFilters() {
    this.filterOnName = '';
    this.filterOnProperties = {};
    this.applyFilter();
  }

  nameInfo(mapping: MappingInfo) {
    return (
      this.nameInfos[mapping.mappingShortkey] ?? new NameInfo('', '', '', '')
    );
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

  applyFilter() {
    setTimeout(() => {
      this.dataSource.filter = '' + Math.random(); // just trigger filtering
    });
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
    let noWarning = this.user.username == 'Codelist import';
    this.dialog
      .open(ImportCsvDialogComponent, { data: { ignoreTermTypes, noWarning } })
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
          let meta: MappingDataMeta = {
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
            warning: imported.warning,
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

  openMetaDataDialog(info: MappingInfo) {
    this.dialog
      .open(EditMetaComponent, { data: { meta: info.meta } })
      .afterClosed()
      .subscribe(async (meta) => {
        if (meta) {
          try {
            await firstValueFrom(
              this.persistency.setMappingMeta(info.mappingShortkey, meta)
            );
            info.meta = meta;
          } catch (e) {
            let msg = `Could not save metadata`;
            console.error(msg, e);
            alert(msg);
          }
        }
      });
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
      this.selectedFilteredMappings.every((i) => i.version != null)
    );
  }
}
