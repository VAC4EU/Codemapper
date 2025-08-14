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
  RevisionInfos,
  userCanCreate,
  userCanDownload,
  userCanRename,
} from '../persistency.service';
import {
  DownloadDialogComponent,
  IncludeDescendants,
} from '../download-dialog/download-dialog.component';
import {
  EMPTY_SERVER_INFO,
  Mapping,
  MappingFormat,
  DataMeta,
  ServerInfo,
  Start,
  StartType,
  MappingMeta,
  DEFAULT_INCLUDE_DESCENDANTS,
  emptyMappingMeta,
  Concepts,
  Codes,
} from '../data';
import * as ops from '../mapping-ops';
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
import { StartMappingComponent } from '../start-mapping/start-mapping.component';

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
  latests: RevisionInfos = {};
  selectedMappings: MappingInfo[] = [];
  filterOnName: string = '';
  selection = new SelectionModel<MappingInfo>(true, []);
  dataSource: MatTableDataSource<MappingInfo> =
    new MatTableDataSource<MappingInfo>();
  allProperties: { [key: string]: string[] } = {}; // map property type to property values
  filterOnProperties: { [key: string]: string | null } = {}; // map property type to property value

  DEFAULT_OPERATIONS = [
    new ops.SetIncludeDescendants(true),
    new ops.SetIncludeDescendants(false),
  ];
  operations: ops.Operation[] = [];

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
    this.latests = await firstValueFrom(
      this.persistency.projectLatestMappings(this.folderName)
    );
    this.allProperties = this.getAllTags();
    this.numMappings.emit(this.mappings.length);
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
      return (
        info.mappingName.toLowerCase().includes(filter) ||
        (info.meta?.definition ?? '').toLowerCase().includes(filter)
      );
    };
    this.dataSource.sortingDataAccessor = (mapping0: any, property: string) => {
      let mapping = mapping0 as MappingInfo;
      switch (property) {
        // case 'descendants':
        //  return this.latests[mapping.mappingShortkey].meta.includeDescendants;
        case 'name':
          return mapping.mappingName;
        default:
          return mapping0[property] ?? mapping0.meta?.[property];
      }
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
        projects.add(project);
      }
    }
    let allTags = {
      system: Array.from(systems),
      type: Array.from(types),
      project: Array.from(projects),
    };
    for (let tags of Object.values(allTags)) {
      tags.sort();
    }
    return allTags;
  }

  hasFilters(): boolean {
    return this.filterOnName != '' || this.hasFilterOnProperties();
  }

  hasFilterOnProperties(): boolean {
    return (
      Object.values(this.filterOnProperties).filter((v) => v != null).length > 0
    );
  }

  clearFilters() {
    this.filterOnName = '';
    this.filterOnProperties = {};
    this.applyFilter();
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

  allDefaultStatus(mappings: MappingInfo[]): boolean {
    return mappings.every((info) => {
      let latest = this.latests[info.mappingShortkey!];
      return latest.version != null && info.status == null;
    });
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
          let meta: DataMeta = {
            formatVersion: MappingFormat.version,
            umlsVersion,
            ignoreTermTypes,
            ignoreSemanticTypes: this.serverInfo.defaultIgnoreSemanticTypes,
            allowedTags: this.serverInfo.defaultAllowedTags,
            includeDescendants: DEFAULT_INCLUDE_DESCENDANTS,
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
    let shortkeys = this.selection.selected.map((c) => c.mappingShortkey!);
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
      mappings: Object.fromEntries(
        mappings.map((i) => [
          i.mappingShortkey,
          { name: i.mappingName, meta: i.meta },
        ])
      ),
      includeDescendants: IncludeDescendants.PerMapping,
    };
    this.dialog.open(DownloadDialogComponent, { data });
  }

  openMetaDataDialog(info: MappingInfo) {
    this.dialog
      .open(EditMetaComponent, {
        data: { name: info.mappingName, meta: info.meta },
      })
      .afterClosed()
      .subscribe(async (result) => {
        if (result) {
          try {
            await EditMetaComponent.save(
              info,
              this.persistency,
              info.mappingShortkey!,
              result
            );
            this.allProperties = this.getAllTags();
          } catch (e) {
            let msg = `Could not save name or meta`;
            console.error(msg, e);
            alert(msg);
          }
        }
      });
  }

  async openCreateMappingDialog() {
    let result = await firstValueFrom(
      this.dialog
        .open(EditMetaComponent, {
          data: {
            title: 'Create new mapping',
            name: '',
            meta: emptyMappingMeta(),
          },
        })
        .afterClosed()
    );
    if (!result) return;
    let initial = {
      mappingName: result.name,
      folderName: this.folderName,
      meta: result.meta,
    };
    this.router.navigate(['/mapping'], { state: { initial } });
  }

  async newMapping(
    projectName: string,
    mappingName: string,
    meta: MappingMeta,
    umlsVersion: string
  ) {
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
      includeDescendants: DEFAULT_INCLUDE_DESCENDANTS,
    };
    let mapping = new Mapping(info, null, vocabularies, {}, {});
    let initial = { mappingName, projectName, mapping, meta };
    this.router.navigate(['/mapping'], { state: { initial } });
  }

  mappingLink(mapping: MappingInfo) {
    return mappingInfoLink(mapping);
  }

  selectedMappingConfigs(): string[] {
    return this.selectedFilteredMappings.map((info) => info.mappingShortkey!);
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
      this.selectedFilteredMappings.every(
        (i) => this.latests[i.mappingShortkey!]
      )
    );
  }
  async batchProcess(
    mappingInfos: MappingInfo[],
    operations: ops.Operation[],
    summary: string
  ) {
    for (let index in mappingInfos) {
      let shortkey = mappingInfos[index].mappingShortkey!;
      try {
        let { info, mapping } = await firstValueFrom(
          this.persistency.loadLatestRevisionMapping(shortkey, this.serverInfo)
        );
        console.log(
          'BATCH PROCESS',
          mappingInfos[index],
          info.version,
          mapping
        );
        mapping.cleanupRecacheCheck();
        for (let op of operations) {
          console.log('BATCH OPERATION', shortkey, op);
          mapping.run(op);
          op.afterRunCallback();
        }
        let newVersion = await firstValueFrom(
          this.persistency.saveRevision(shortkey, mapping, summary)
        );
        let newMappingInfo = await firstValueFrom(
          this.persistency.mappingInfo(shortkey)
        );
        Object.assign(mappingInfos[index], newMappingInfo);
        console.log('BATCH PROCESSED', mapping, newVersion);
      } catch (err) {
        console.error('could not load mapping', mappingInfos[index], err);
      }
    }
  }
}
