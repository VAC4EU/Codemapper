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

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../src/environments/environment';
import { JSONObject, Mapping, Revision } from './data';
import { urlEncodedOptions } from '../app.module';
import { Observable, map } from 'rxjs';

export type ProjectPermission = 'Admin' | 'Editor' | 'Commentator';

export interface ProjectInfo {
  name : string;
  permission : ProjectPermission;
}

export interface MappingInfo {
  projectName : string;
  mappingName : string;
  mappingUUID : string;
}

@Injectable({
  providedIn: 'root'
})
export class PersistencyService {
  private url : string = environment.apiUrl + '/persistency'

  constructor(private http : HttpClient) { }

  projectInfos() {
    return this.http.get<ProjectInfo[]>(this.url + '/projects');
  }

  projectMappingInfos(project : string) {
    return this.http.get<MappingInfo[]>(this.url + `/projects/${project}/mappings`)
      .pipe(map(names => {
        names.sort((a, b) => a.mappingName.toLowerCase().localeCompare(b.mappingName.toLowerCase()));
        return names;
      }));
  }

  mappingInfo(mappingUUID : string) {
    return this.http.get<MappingInfo>(this.url + `/mapping/${mappingUUID}/info`);
  }

  mappingInfoByOldName(projectName : string, mappingName : string) {
    return this.http.get<MappingInfo>(this.url + `/projects/${projectName}/mapping/${mappingName}/info-old-name`);
  }

  createMapping(projectName : string, mappingName : string) : Observable<MappingInfo> {
    let body = new URLSearchParams();
    body.append("projectName", projectName);
    body.append("mappingName", mappingName);
    let url = this.url + `/mapping`;
    return this.http.post<MappingInfo>(url, body, urlEncodedOptions);
  }

  legacyMapping(mappingUUID : string) : Observable<[number, Mapping]> {
    return this.http.get<JSONObject>(this.url + `/mapping/${mappingUUID}/legacy`)
      .pipe(map((json) => [-1, Mapping.importV1(json)]));
  }

  latestRevisionMapping(mappingUUID : string) : Observable<[number, Mapping]> {
    return this.http.get<Revision>(this.url + `/mapping/${mappingUUID}/latest-revision`)
      .pipe(map(rev => {
        let mapping = Mapping.importJSON(JSON.parse(rev.mapping));
        return [rev.version, mapping];
      }))
  }

  getRevisions(mappingUUID : string) {
    return this.http.get<Revision[]>(this.url + `/mapping/${mappingUUID}/revisions`);
  }

  saveRevision(mappingUUID : string, mapping : Mapping, summary : string) {
    let body = new URLSearchParams();
    let mappingJson = JSON.stringify(mapping, Mapping.jsonifyReplacer);
    body.append("mapping", mappingJson);
    body.append("summary", summary);
    let url = this.url + `/mapping/${mappingUUID}/save-revision`;
    return this.http.post<number>(url, body, urlEncodedOptions);
  }

  mappingSetName(mappingUUID : string, newName : string) {
    let body = new URLSearchParams();
    body.append("name", newName);
    let url = this.url + `/mapping/${mappingUUID}/name`;
    return this.http.post<number>(url, body, urlEncodedOptions);
  }
}
