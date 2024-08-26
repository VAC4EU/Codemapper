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
import { JSONObject, Mapping, Revision, ServerInfo } from './data';
import { urlEncodedOptions } from '../app.module';
import { Observable, map } from 'rxjs';
import { User } from './auth.service';

export enum ProjectRole {
  Owner = "Owner",
  Editor = "Editor",
  Commentator = "Commentator"
}

export type ProjectsRoles = { [key : string] : ProjectRole | null };

export interface ProjectInfo {
  name : string;
  permission : ProjectRole;
}

export interface MappingInfo {
  projectName : string;
  mappingName : string;
  mappingShortkey : string;
}

export function slugify(str : string) {
  return str
    .toLowerCase()
    .replace(/^\s+|\s+$/g, '')
    .replace(/[_ ]/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

export function mappingInfoLink(mapping : MappingInfo) : string[] {
  return ["/mapping", mapping.mappingShortkey, slugify(mapping.projectName), slugify(mapping.mappingName)]
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

  mappingInfo(shortkey : string) {
    return this.http.get<MappingInfo>(this.url + `/mapping/${shortkey}/info`);
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

  legacyMapping(shortkey : string, serverInfo : ServerInfo) : Observable<[number, Mapping]> {
    return this.http.get<JSONObject>(this.url + `/mapping/${shortkey}/legacy`)
      .pipe(map((json) => [-1, Mapping.importV1(json, serverInfo)]));
  }

  latestRevisionMapping(shortkey : string, serverInfo : ServerInfo) : Observable<[number, Mapping]> {
    return this.http.get<Revision>(this.url + `/mapping/${shortkey}/latest-revision`)
      .pipe(map(rev => {
        let mapping = Mapping.importJSON(JSON.parse(rev.mapping), serverInfo);
        return [rev.version, mapping];
      }))
  }

  getProjectsRoless() {
    return this.http.get<ProjectsRoles>(this.url + "/user/project-permissions")
  }

  getProjectRole(projectName : string) {
    return this.http.get<ProjectRole>(this.url + "/user/project-permission/" + projectName)
  }

  getRevisions(shortkey : string) {
    return this.http.get<Revision[]>(this.url + `/mapping/${shortkey}/revisions`);
  }

  saveRevision(shortkey : string, mapping : Mapping, summary : string) {
    let body = new URLSearchParams();
    let mappingJson = JSON.stringify(mapping, Mapping.jsonifyReplacer);
    body.append("mapping", mappingJson);
    body.append("summary", summary);
    let url = this.url + `/mapping/${shortkey}/save-revision`;
    return this.http.post<number>(url, body, urlEncodedOptions);
  }

  mappingSetName(shortkey : string, newName : string) {
    let body = new URLSearchParams();
    body.append("name", newName);
    let url = this.url + `/mapping/${shortkey}/name`;
    return this.http.post<number>(url, body, urlEncodedOptions);
  }
  projectUsers(projectName : string) {
    let url = this.url + `/projects/${projectName}/users`;
    return this.http.get<ProjectUsers>(url)
  }

  createProject(name : string) : Observable<void> {
    let url = this.url + `/project`;
    let body = new URLSearchParams();
    body.append("name", name);
    return this.http.post<void>(url, body, urlEncodedOptions);
  }

  allUsers() {
    return this.http.get<User[]>(this.url + '/users');
  }

  setUserRole(projectName : string, username : string, role : ProjectRole | null) {
    let url = this.url + '/project/' + projectName + '/user-role';
    let body = new URLSearchParams();
    body.append("username", username);
    if (role) {
      body.append("role", role);
    }
    return this.http.post<void>(url, body, urlEncodedOptions);
  }
  createUser(username : string, password : string, email : string) {
    let url = this.url + '/user';
    let body = new URLSearchParams();
    body.set("username", username);
    body.set("password", password);
    body.set("email", email);
    return this.http.post<void>(url, body, urlEncodedOptions)
  }
  changePassword(username : string, password : string) {
    let url = this.url + '/user/password';
    let body = new URLSearchParams();
    body.set("username", username);
    body.set("password", password);
    return this.http.post<void>(url, body, urlEncodedOptions)
  }
  setAdmin(username : string, isAdmin : boolean) {
    let url = this.url + '/user/admin';
    let body = new URLSearchParams();
    body.set("username", username);
    body.set("isAdmin", "" + isAdmin);
    return this.http.post<void>(url, body, urlEncodedOptions)
  }
}

export type ProjectUsers = { [key : string] : string[] }
