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

import { Component, Input, OnChanges } from '@angular/core';
import { Concept, Tag } from '../mapping-data';
import { joinFragment, navigateHref } from '../navigate';

@Component({
    selector: 'mapping-concept',
    templateUrl: './concept.component.html',
    styleUrls: ['./concept.component.scss'],
    standalone: false
})
export class ConceptComponent implements OnChanges {
  @Input({required: true}) concept!: Concept;
  @Input({required: true}) tag!: Tag | null;
  @Input() showName: boolean = true;
  @Input() showNavigate: boolean = false;

  navFragment: string | null = null;
  navHref: string | null = null;

  ngOnChanges() {
    if (this.showNavigate) {
      this.navFragment = joinFragment('concepts', this.concept.id);
      this.navHref = navigateHref(this.navFragment);
    } else {
      this.navFragment = null;
      this.navHref = null;
    }
  }
}
