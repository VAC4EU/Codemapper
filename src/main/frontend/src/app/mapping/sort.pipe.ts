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

import { Pipe, PipeTransform } from '@angular/core';

export function compareCodes(s1 : string, s2 : string) : number {
  let n1 = parseInt(s1);
  let n2 = parseInt(s2);
  if (!isNaN(n1) && !isNaN(n2)) {
    return n1 - n2;
  } else {
    return s1.localeCompare(s2);
  }
}

@Pipe({
  name: 'sort'
})
export class SortPipe implements PipeTransform {

  transform(value : ArrayLike<string>) : string[] {
    let array = Array.from(value);
    array.sort(compareCodes);
    return array;
  }
}