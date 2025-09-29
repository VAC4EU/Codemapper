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
import {
  JSONObject,
  Mapping,
  ServerInfo,
  MappingMeta,
  emptyMappingMeta,
} from './data';
import { urlEncodedOptions } from '../app.module';
import { Observable, firstValueFrom, map } from 'rxjs';
import { User } from './auth.service';

export enum ProjectRole {
  Owner = 'Owner',
  Editor = 'Editor',
  Reviewer = 'Reviewer',
}

export function roleAtLeast(
  have: ProjectRole | null,
  need: ProjectRole
): boolean {
  if (have == null) {
    return false;
  } else {
    switch (need) {
      case ProjectRole.Owner:
        return have == ProjectRole.Owner;
      case ProjectRole.Editor:
        return have == ProjectRole.Owner || have == ProjectRole.Editor;
      case ProjectRole.Reviewer:
        return (
          have == ProjectRole.Owner ||
          have == ProjectRole.Editor ||
          have == ProjectRole.Reviewer
        );
    }
  }
}

export function userCanEdit(role: ProjectRole | null): boolean {
  return roleAtLeast(role, ProjectRole.Editor);
}

export function userCanDownload(role: ProjectRole | null): boolean {
  return roleAtLeast(role, ProjectRole.Reviewer);
}

export function userCanCreate(role: ProjectRole | null): boolean {
  return roleAtLeast(role, ProjectRole.Owner);
}

export function userCanRename(role: ProjectRole | null): boolean {
  return roleAtLeast(role, ProjectRole.Owner);
}

export type ProjectsRoles = { [key: string]: ProjectRole[] };

export type UserRole = {
  user: User;
  role: ProjectRole;
};

export interface MappingInfo {
  mappingShortkey: string | null; // null if not saved
  projectName: string;
  mappingName: string;
  status: string | null;
  meta: MappingMeta;
}

export function emptyMappingInfo(): MappingInfo {
  return {
    mappingShortkey: null,
    projectName: '',
    mappingName: '',
    status: null,
    meta: emptyMappingMeta(),
  };
}

export interface RevisionInfo {
  version: number;
  author: string;
  timestamp: string;
  summary: string;
}

export type RevisionInfos = { [key: string]: RevisionInfo };

export interface ProjectInfo {
  name: string;
  role: ProjectRole;
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/^\s+|\s+$/g, '')
    .replace(/[_ ]/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

export function slugifyMappingInfo(info: MappingInfo): string {
  return `${slugify(info.projectName)}-${slugify(info.mappingName)}-${
    info.mappingShortkey
  }`;
}

export function mappingInfoLink(info: MappingInfo): string[] {
  return ['/mapping', slugifyMappingInfo(info)];
}

export interface RevisionRaw {
  version: number;
  author: string;
  timestamp: string;
  summary: string;
  mappingJson: string;
}

@Injectable({
  providedIn: 'root',
})
export class PersistencyService {
  private url: string = environment.apiUrl + '/persistency';

  constructor(private http: HttpClient) {}

  projectMappingInfos(project: string) {
    return this.http
      .get<MappingInfo[]>(this.url + `/projects/${project}/mappings`)
      .pipe(
        map((names) => {
          names.sort((a, b) =>
            a.mappingName
              .toLowerCase()
              .localeCompare(b.mappingName.toLowerCase())
          );
          return names;
        })
      );
  }

  projectLatestMappings(project: string): Observable<RevisionInfos> {
    return this.http.get<RevisionInfos>(
      this.url + `/projects/${project}/latest-mapping-revisions`
    );
  }

  mappingInfo(shortkey: string) {
    return this.http.get<MappingInfo>(this.url + `/mapping/${shortkey}/info`);
  }

  mappingMeta(shortkey: string) {
    return this.http.get<MappingMeta>(this.url + `/mapping/${shortkey}/meta`);
  }

  setMappingMeta(shortkey: string | null, meta: MappingMeta) {
    let url = `${this.url}/mapping/${shortkey}/meta`;
    return this.http.post<MappingMeta>(url, meta);
  }

  mappingInfoByOldName(projectName: string, mappingName: string) {
    return this.http.get<MappingInfo>(
      this.url + `/projects/${projectName}/mapping/${mappingName}/info-old-name`
    );
  }

  async createMapping(projectName: string, mappingName: string, meta: MappingMeta): Promise<string> {
    let body = new URLSearchParams();
    body.append('projectName', projectName);
    body.append('mappingName', mappingName);
    let url = this.url + `/mapping`;
    let shortkey = await firstValueFrom(this.http.post(url, body, {...urlEncodedOptions, responseType: 'text' as const}));
    await firstValueFrom(this.setMappingMeta(shortkey, meta));
    return shortkey;
  }

  async deleteMappings(shortkeys: string[]) {
    for (let shortkey of shortkeys) {
      let url = this.url + `/mapping/${shortkey}`;
      try {
        await firstValueFrom(this.http.delete<MappingInfo>(url));
      } catch (e) {
        let msg = `Could not delete mapping ${shortkey}`;
        console.error(msg, e);
        throw new Error(msg);
      }
    }
  }

  loadLegacyMapping(
    shortkey: string,
    serverInfo: ServerInfo
  ): Observable<Mapping> {
    return this.http
      .get<JSONObject>(this.url + `/mapping/${shortkey}/legacy`)
      .pipe(map((json) => Mapping.importLegacyJSON(json, serverInfo)));
  }

  loadLatestRevisionMapping(
    shortkey: string,
    serverInfo: ServerInfo
  ): Observable<{ info: RevisionInfo; mapping: Mapping }> {
    return this.http
      .get<RevisionRaw>(this.url + `/mapping/${shortkey}/latest-revision`)
      .pipe(
        map((rev) => {
          let mapping = Mapping.importJSON(
            JSON.parse(rev.mappingJson),
            serverInfo
          );
          return {
            info: {
              version: rev.version,
              author: rev.author,
              timestamp: rev.timestamp,
              summary: rev.summary,
            },
            mapping,
          };
        })
      );
  }

  getProjectsRoles() {
    return this.http.get<ProjectsRoles>(this.url + '/user/project-permissions');
  }

  getProjectRole(projectName: string) {
    return this.http.get<ProjectRole | null>(
      this.url + '/user/project-permission/' + projectName
    );
  }

  getProjectUsers(projectName: string) {
    return this.http.get<UserRole[]>(
      this.url + `/project/${projectName}/users`
    );
  }

  getRevisions(shortkey: string) {
    return this.http.get<RevisionInfo[]>(
      this.url + `/mapping/${shortkey}/revisions`
    );
  }

  saveRevision(shortkey: string, mapping: Mapping, summary: string) {
    let body = new URLSearchParams();
    let mappingJson = JSON.stringify(mapping.toObject(), Mapping.jsonifyReplacer);
    body.append('mapping', mappingJson);
    body.append('summary', summary);
    let url = this.url + `/mapping/${shortkey}/save-revision`;
    return this.http.post<RevisionInfo>(url, body, urlEncodedOptions);
  }

  mappingSetName(shortkey: string, newName: string) {
    let body = new URLSearchParams();
    body.append('name', newName);
    let url = this.url + `/mapping/${shortkey}/name`;
    return this.http.post<number>(url, body, urlEncodedOptions);
  }
  projectUsers(projectName: string) {
    let url = this.url + `/projects/${projectName}/user-roles`;
    return this.http.get<UserRole[]>(url);
  }

  createProject(name: string): Observable<void> {
    let url = this.url + `/project`;
    let body = new URLSearchParams();
    body.append('name', name);
    return this.http.post<void>(url, body, urlEncodedOptions);
  }

  getProjects() {
    return this.http.get<ProjectInfo[]>(this.url + '/projects');
  }

  allUsers() {
    return this.http.get<User[]>(this.url + '/users');
  }

  setUserRole(projectName: string, username: string, role: ProjectRole | null) {
    let url = this.url + '/project/' + projectName + '/user-role';
    let body = new URLSearchParams();
    body.append('username', username);
    if (role) {
      body.append('role', role);
    }
    return this.http.post<void>(url, body, urlEncodedOptions);
  }
  createUser(username: string, password: string, email: string) {
    let url = this.url + '/user';
    let body = new URLSearchParams();
    body.set('username', username);
    body.set('password', password);
    body.set('email', email);
    return this.http.post<void>(url, body, urlEncodedOptions);
  }
  changePassword(username: string, password: string) {
    let url = this.url + '/user/password';
    let body = new URLSearchParams();
    body.set('username', username);
    body.set('password', password);
    return this.http.post<void>(url, body, urlEncodedOptions);
  }
  setAdmin(username: string, isAdmin: boolean) {
    let url = this.url + '/user/admin';
    let body = new URLSearchParams();
    body.set('username', username);
    body.set('isAdmin', '' + isAdmin);
    return this.http.post<void>(url, body, urlEncodedOptions);
  }
}
