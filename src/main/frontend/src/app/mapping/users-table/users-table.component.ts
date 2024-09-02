import { Component, Input } from '@angular/core';
import { User } from '../auth.service';

@Component({
  selector: 'users-table',
  templateUrl: './users-table.component.html',
  styleUrls: ['./users-table.component.scss'],
})
export class UsersTableComponent {
  @Input() users : User[] = [];
}
