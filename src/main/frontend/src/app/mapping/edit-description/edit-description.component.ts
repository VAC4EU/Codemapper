import {
  Component,
  Inject,
  model,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import { MappingInfo, PersistencyService } from '../persistency.service';
import { firstValueFrom } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Crepe } from '@milkdown/crepe';
import { EDF_TEMPLATES } from '../mapping-tab/edf-templates';
import { CrepeComponent } from '../crepe/crepe.component';

@Component({
  selector: 'app-edit-description',
  templateUrl: './edit-description.component.html',
  styleUrl: './edit-description.component.scss',
  standalone: false,

  encapsulation: ViewEncapsulation.None,
})
export class EditDescriptionComponent {
  description = model("");
  mappingName = "";
  title = "";
  templates = EDF_TEMPLATES.filter((template) => template.name !== 'None');
  editor = viewChild.required<CrepeComponent>('editor');

  constructor(
    public dialogRef: MatDialogRef<EditDescriptionComponent, string | undefined>,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      description: string;
      mappingName: string;
      title?: string;
      submit?: string;
    }
  ) {
    this.description.set(data.description);
    this.mappingName = data.mappingName;
    this.title =
      data.title ??
      `${data.description ? 'Edit' : 'Create'} event definition form: ${data.mappingName}`;
  }

  onCancel() {
    this.dialogRef.close(undefined);
  }

  async useTemplate(content: string) {
    await this.editor().setMarkdown(content);
  }

  async onSavePlainText() {
    this.dialogRef.close(this.description());
  }

  /// Save the name and mapping meta from `result` to persistency API and update `infoOut`
  static async save(
    persistency: PersistencyService,
    mappingShortkey: string,
    description: string
  ) {
    if (mappingShortkey == null) {
      throw new Error('Cannot save metadata for mapping without shortkey');
    }
    try {
      await firstValueFrom(
        persistency.setMappingDescription(mappingShortkey, description)
      );
    } catch (e) {
      let msg = `Could not save description`;
      console.error(msg, e);
      alert(msg);
    }
  }
}
