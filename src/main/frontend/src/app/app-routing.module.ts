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

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WelcomeViewComponent } from './mapping/welcome-view/welcome-view.component';
import { MappingViewComponent } from './mapping/mapping-view/mapping-view.component';
import { ProjectsViewComponent } from './mapping/projects-view/projects-view.component';
import { ProjectViewComponent } from './mapping/project-view/project-view.component';
import { NewsViewComponent } from './mapping/news-view/news-view.component';
import { adminGuard, authGuard } from './mapping/auth.guard';
import { PendingChangesGuard } from './mapping/pending-changes.guard';
import { LegacyMappingRedirectComponent } from './mapping/legacy-mapping-redirect/legacy-mapping-redirect.component';
import { UserViewComponent } from './mapping/user-view/user-view.component';
import { UsersViewComponent } from './mapping/users-view/users-view.component';

const routes : Routes = [
  {
    path: "",
    title: "CodeMapper",
    component: WelcomeViewComponent,
  },
  {
    path: "news",
    title: "CodeMapper: News",
    component: NewsViewComponent,
  },
  {
    path: "projects",
    title: "CodeMapper: Projects",
    canActivate: [authGuard],
    component: ProjectsViewComponent,
  },
  {
    path: "project/:project",
    canActivate: [authGuard],
    component: ProjectViewComponent,
  },
  {
    path: "mapping",
    canActivate: [authGuard],
    canDeactivate: [PendingChangesGuard],
    component: MappingViewComponent,
  },
  {
    path: "mapping/:name",
    canActivate: [authGuard],
    canDeactivate: [PendingChangesGuard],
    component: MappingViewComponent,
  },
  {
    path: "account",
    canActivate: [authGuard],
    title: "CodeMapper: Your account",
    component: UserViewComponent,
  },
  {
    path: "users",
    canActivate: [adminGuard],
    title: "CodeMapper: Users",
    component: UsersViewComponent,
  },
  {
    path: "project/:projectName/event/:mappingName",
    canActivate: [authGuard],
    component: LegacyMappingRedirectComponent,
  },
  { path: '**', redirectTo: '/', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
