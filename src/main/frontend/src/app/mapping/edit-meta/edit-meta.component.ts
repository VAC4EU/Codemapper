import { Component, Inject, Input } from '@angular/core';
import { MappingMeta, emptyMappingMeta } from '../mapping-data';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MappingInfo, PersistencyService } from '../persistency.service';
import { firstValueFrom } from 'rxjs';

interface Result {
  name: string,
  meta: MappingMeta,
}

@Component({
  selector: 'app-edit-meta',
  templateUrl: './edit-meta.component.html',
  styleUrls: ['./edit-meta.component.scss'],
})
export class EditMetaComponent {
  name: string = '';
  meta: MappingMeta = emptyMappingMeta();
  projectsString: string = '';
  constructor(
    public dialogRef: MatDialogRef<EditMetaComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      title?: string,
      name: string;
      meta: MappingMeta;
    }
  ) {}
  ngOnInit() {
    this.name = this.data.name;
    this.meta = JSON.parse(JSON.stringify(this.data.meta));
    this.projectsString = this.data.meta.projects.join(', ');
  }
  submit() {
    let result: Result = {
      name: this.name,
      meta: {
        ...this.meta,
        projects: this.projectsString.split(',').map((s) => s.trim()),
      },
    };
    this.dialogRef.close(result);
  }

  static async set(infoOut: MappingInfo, result: Result) {
      infoOut.mappingName = result.name;
      Object.assign(infoOut.meta, result.meta);
  }

  /// Save the name and mapping meta from `result` to persistency API and update `infoOut`
  static async save(
    infoOut: MappingInfo,
    persistency: PersistencyService,
    mappingShortkey: string,
    result: Result,
  ) {
    if (mappingShortkey == null) {
      throw new Error("Cannot save metadata for mapping without shortkey")
    }
    try {
      await firstValueFrom(
        persistency.mappingSetName(mappingShortkey, result.name)
      );
      await firstValueFrom(
        persistency.setMappingMeta(mappingShortkey, result.meta)
      );
      EditMetaComponent.set(infoOut, result);
    } catch (e) {
      let msg = `Could not save name or meta`;
      console.error(msg, e);
      alert(msg);
    }
  }
}
