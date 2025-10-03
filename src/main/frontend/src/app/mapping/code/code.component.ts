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
import { Code } from '../mapping-data';

@Component({
    selector: 'mapping-code',
    templateUrl: './code.component.html',
    styleUrls: ['./code.component.scss'],
    standalone: false
})
export class CodeComponent {
  @Input({required: true}) code! : Code;
  @Input() showTagIndication : boolean = false;
  @Input() showTerm : boolean = true;
  tooltipContent() : string {
    let l = [this.code.term]
    if (this.code.tag != null) {
      l.push(`tag: ${this.code.tag}`);
    }
    if (this.code.custom) {
      l.push("custom code");
    }
    return l.join(", ");
  }
}
