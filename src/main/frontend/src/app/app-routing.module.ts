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
import { EventsViewComponent } from './mapping/events-view/events-view.component';
import { NewsViewComponent } from './mapping/news-view/news-view.component';
import { AuthGuard } from './mapping/auth.guard';
import { PendingChangesGuard } from './mapping/pending-changes.guard';
import { LegacyMappingRedirectComponent } from './mapping/legacy-mapping-redirect/legacy-mapping-redirect.component';

const routes : Routes = [
  {
    path: "",
    title: () => Promise.resolve("CodeMapper: Welcome"),
    component: WelcomeViewComponent,
  },
  {
    path: "news",
    title: () => Promise.resolve("CodeMapper: News"),
    component: NewsViewComponent,
  },
  {
    path: "projects",
    title: () => Promise.resolve("CodeMapper: Your projects"),
    canActivate: [AuthGuard],
    component: ProjectsViewComponent,
  },
  {
    path: "project/:project",
    canActivate: [AuthGuard],
    component: EventsViewComponent,
  },
  {
    path: "mapping",
    canActivate: [AuthGuard],
    canDeactivate: [PendingChangesGuard],
    component: MappingViewComponent,
  },
  {
    path: "mapping/:mappingUUID",
    canActivate: [AuthGuard],
    canDeactivate: [PendingChangesGuard],
    component: MappingViewComponent,
  },
  {
    path: "project/:projectName/event/:mappingName",
    canActivate: [AuthGuard],
    component: LegacyMappingRedirectComponent,
  },
  { path: '**', redirectTo: '/', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
