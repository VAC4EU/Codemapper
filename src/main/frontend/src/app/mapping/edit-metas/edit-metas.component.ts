import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

export interface EditMetasResult {
  addProjects: string[];
  removeProjects: string[];
}

@Component({
  selector: 'app-edit-metas',
  templateUrl: './edit-metas.component.html',
  styleUrl: './edit-metas.component.scss',
  standalone: false,
})
export class EditMetasComponent {
  addProjects: string = '';
  removeProjects: string = '';
  constructor(
    public dialogRef: MatDialogRef<EditMetasComponent, EditMetasResult>
  ) {}
  submit() {
    let result: EditMetasResult = {
      addProjects: this.addProjects.split(',').filter((s) => s).map(s => s.trim()),
      removeProjects: this.removeProjects.split(',').filter((s) => s).map(s => s.trim()),
    };
    this.dialogRef.close(result);
  }
}
