// This file is part of CodeMapper.
//
// Copyright 2022-2024 VAC4EU - Vaccine monitoring Collaboration for Europe.
// Copyright 2017-2021 Erasmus Medical Center, Department of Medical Informatics.
//
// CodeMapper is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option) any
// later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

import { Input } from '@angular/core';
import { Component } from '@angular/core';
import { Mapping, Revision } from '../data';
import { ApiService } from '../api.service';
import { ProjectRole } from '../persistency.service';

@Component({
  selector: 'history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent {
  @Input({ required: true }) mappingShortkey! : string;
  @Input({ required: true }) mapping! : Mapping;
  @Input({ required: true }) revisions! : Revision[];
  @Input({ required: true }) version! : number;
  @Input({ required: true }) projectRole : ProjectRole | null = null;

  constructor(
    public apiService : ApiService,
  ) { }

  firstLine(summary : string) : string {
    return summary.split('\n')[0] ?? ""
  }

  downloadUrl(version : number) {
    let url = new URL(this.apiService.downloadMappingUrl);
    url.searchParams.set('mappingShortkey', this.mappingShortkey);
    url.searchParams.set('version', "" + version);
    url.searchParams.set('includeDescendants', "true");
    url.searchParams.set('url', window.location.href);
    return url;
  }
}
