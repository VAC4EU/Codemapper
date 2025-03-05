import { Component, Input, SimpleChange } from '@angular/core';
import {
  PersistencyService,
  ProjectRole,
  UserRole,
} from '../persistency.service';
import { User } from '../auth.service';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

function usernameCompare(a: User | string, b: User | string) {
  let a1 = typeof a == 'string' ? a : a.username;
  let b1 = typeof b == 'string' ? b : b.username;
  return a1.toLowerCase().localeCompare(b1.toLowerCase());
}

@Component({
  selector: 'folder-users',
  templateUrl: './folder-users.component.html',
  styleUrls: ['./folder-users.component.scss'],
})
export class FolderUsersComponent {
  @Input({ required: true }) folderName!: string;
  @Input({ required: true }) user!: User;
  @Input({ required: true }) role!: ProjectRole;

  userRoles: UserRole[] = [];
  allUsers: User[] = []; // only available for admin, owner

  constructor(
    private persistency: PersistencyService,
    private snackbar: MatSnackBar
  ) {}

  async ngOnInit() {
    this.reloadUsersRoles();
    this.persistency.allUsers().subscribe((allUsers) => {
      this.allUsers = allUsers;
      this.allUsers.sort(usernameCompare);
    });
  }

 ngOnChange(change: SimpleChange) {
    if (change.currentValue['folderName']) {
      this.reloadUsersRoles();
    }
  }

  async reloadUsersRoles() {
    this.userRoles = await firstValueFrom(
      this.persistency.projectUsers(this.folderName)
    );
    this.userRoles.sort((a, b) => usernameCompare(a.user, b.user));
  }

  addUserRole(username: string, role: ProjectRole) {
    this.persistency.setUserRole(this.folderName, username, role).subscribe({
      next: (_) => this.reloadUsersRoles(),
      error: (err) => this.snackbar.open(err.message, 'Ok'),
    });
  }

  rolesDomain(): string[] {
    return Object.keys(ProjectRole);
  }
}
