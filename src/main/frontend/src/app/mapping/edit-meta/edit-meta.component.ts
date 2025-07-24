import { Component, Inject, Input } from '@angular/core';
import { MappingMeta, emptyMappingMeta } from '../data';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-edit-meta',
  templateUrl: './edit-meta.component.html',
  styleUrls: ['./edit-meta.component.scss']
})
export class EditMetaComponent {
  meta: MappingMeta = emptyMappingMeta();
  projectsString: string = "";
  constructor(
        public dialogRef : MatDialogRef<EditMetaComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data : {
      meta: MappingMeta
    }
  ) {}
  ngOnInit() {
    console.log("META", this.data.meta);
    this.meta = JSON.parse(JSON.stringify(this.data.meta));
    this.projectsString = this.data.meta.projects.join(", ");
  }
  save() {
    this.meta.projects = this.projectsString.split(',').map(s => s.trim());
    this.dialogRef.close(this.meta);
  }
}
