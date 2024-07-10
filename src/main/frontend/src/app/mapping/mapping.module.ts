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
import { HttpClientModule } from '@angular/common/http';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { AppRoutingModule } from '../app-routing.module';
import { MappingViewComponent } from './mapping-view/mapping-view.component';
import { ConceptsComponent } from './concepts/concepts.component';
import { ConceptComponent } from './concept/concept.component';
import { CodesComponent } from './codes/codes.component';
import { CodeComponent } from './code/code.component';
import { TagsComponent } from './tags/tags.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HistoryComponent } from './history/history.component';
import { ConceptsTableComponent } from './concepts-table/concepts-table.component';
import { ConceptsDialogComponent } from './concepts-dialog/concepts-dialog.component';
import { VocabulariesComponent } from './vocabularies/vocabularies.component';
import { VocabulariesTableComponent } from './vocabularies-table/vocabularies-table.component';
import { VocabulariesDialogComponent } from './vocabularies-dialog/vocabularies-dialog.component';
import { CustomVocabularyDialogComponent } from './custom-vocabulary-dialog/custom-vocabulary-dialog.component';
import { CodeDialogComponent } from './code-dialog/code-dialog.component';
import { ReviewsDialogComponent } from './reviews-dialog/reviews-dialog.component';
import { ReviewsComponent } from './reviews/reviews.component';
import { NavigationComponent } from './navigation/navigation.component';
import { ProjectsViewComponent } from './projects-view/projects-view.component';
import { LoginFormComponent } from './login-form/login-form.component';
import { LoggedinComponent } from './loggedin/loggedin.component';
import { NewsViewComponent } from './news-view/news-view.component';
import { WelcomeViewComponent } from './welcome-view/welcome-view.component';
import { IndexerComponent } from './indexer/indexer.component';
import { ImportCsvDialogComponent } from './import-csv-dialog/import-csv-dialog.component';
import { EventsViewComponent } from './events-view/events-view.component';
import { SortPipe } from './sort.pipe';
import { CodesDialogComponent } from './codes-dialog/codes-dialog.component';
import { CodesTableComponent } from './codes-table/codes-table.component';
import { LegacyMappingRedirectComponent } from './legacy-mapping-redirect/legacy-mapping-redirect.component';

@NgModule({
  declarations: [
    CodeComponent,
    CodesComponent,
    ConceptComponent,
    ConceptsComponent,
    ConceptsDialogComponent,
    ConceptsTableComponent,
    HistoryComponent,
    MappingViewComponent,
    TagsComponent,
    VocabulariesComponent,
    VocabulariesDialogComponent,
    VocabulariesTableComponent,
    CodeDialogComponent,
    CustomVocabularyDialogComponent,
    ReviewsDialogComponent,
    ReviewsComponent,
    NavigationComponent,
    ProjectsViewComponent,
    LoginFormComponent,
    LoggedinComponent,
    NewsViewComponent,
    WelcomeViewComponent,
    IndexerComponent,
    ImportCsvDialogComponent,
    EventsViewComponent,
    SortPipe,
    CodesDialogComponent,
    CodesTableComponent,
    LegacyMappingRedirectComponent,
  ],
  imports: [
    HttpClientModule,
    AppRoutingModule,
    BrowserModule,
    CommonModule,
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDialogModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatMenuModule,
    MatRadioModule,
    MatSelectModule,
    MatTableModule,
    MatTabsModule,
    MatToolbarModule,
    MatTooltipModule,
    MatSnackBarModule,
    NgFor,
    NgIf,
    NoopAnimationsModule,
    ReactiveFormsModule,
    RouterModule,
  ],
})
export class MappingModule { }