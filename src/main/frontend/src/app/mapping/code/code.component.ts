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
import { Code } from '../mapping-data';
import { joinFragment, navigateHref } from '../navigate';
import { canonicalTag } from '../text-tag-filter';

@Component({
    selector: 'mapping-code',
    templateUrl: './code.component.html',
    styleUrls: ['./code.component.scss'],
    standalone: false
})
export class CodeComponent implements OnChanges {
  @Input({required: true}) code!: Code;
  @Input() showTagIndication: boolean = false;
  @Input() showTerm: boolean = true;
  @Input() showNavigate: boolean = false;
  @Input() vocId: string | null = null;

  navFragment: string | null = null;
  navHref: string | null = null;
  title: string | null = null;

  ngOnChanges() {
    this.title = codeTitle(this.code, this.showTerm);
    if (this.showNavigate && this.vocId) {
      this.navFragment = joinFragment('codes', this.vocId, this.code.id);
      this.navHref = navigateHref(this.navFragment);
    } else {
      this.navFragment = null;
      this.navHref = null;
    }
  }
}

function codeTitle(code: Code, showTerm: boolean): string | null {
  let term = showTerm ? null : code.term;
  let tag = canonicalTag(code.tag);
  if (term && tag) return `${term} (tag: ${tag})`;
  return term ?? (tag == null ? null : `tag: ${tag}`);
}
