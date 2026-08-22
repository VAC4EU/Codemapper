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

import { CodeIds, Codes, Tag } from './mapping-data';

export interface TextTagFilter {
  text: string;
  tags: (Tag | null)[];
}

export const EMPTY_FILTER: TextTagFilter = { text: '', tags: [] };

/// Untagged rows occur as null, undefined or "" - map them all to null so that
/// they are comparable with the "no tag" entry of the filter.
export function canonicalTag(tag: Tag | null | undefined): Tag | null {
  return tag ? tag : null;
}

export function canonicalTags(tags: (Tag | null | undefined)[]): Tag[] {
  return Array.from(
    new Set(tags.map(canonicalTag).filter((tag) => tag != null)),
  ).sort();
}

export function isFilterActive(filter: TextTagFilter): boolean {
  return filter.text.trim() != '' || filter.tags.length > 0;
}

/// MatTableDataSource skips filtering when the filter string is empty, so the
/// whole filter is encoded here to also trigger on a tags-only filter.
export function filterKey(filter: TextTagFilter): string {
  return isFilterActive(filter) ? JSON.stringify(filter) : '';
}

export function matchesFilter(
  filter: TextTagFilter,
  haystack: string,
  tag: Tag | null | undefined | (Tag | null | undefined)[],
): boolean {
  let text = filter.text.trim().toLowerCase();
  let tags = (Array.isArray(tag) ? tag : [tag]).map(canonicalTag);
  return (
    (text == '' || haystack.toLowerCase().includes(text)) &&
    (filter.tags.length == 0 || tags.some((t) => filter.tags.includes(t)))
  );
}

/// All tags used by a concept's own codes (across coding systems), so that
/// filtering a concept by tag considers every one of its codes rather than
/// only a single tag the codes happen to agree on. A concept with an
/// untagged code, or with no codes at all, is included in the "no tag" match.
export function conceptCodeTags(
  conceptCodes: CodeIds,
  codes: Codes,
): (Tag | null)[] {
  let tags = new Set<Tag | null>();
  for (let vocId of Object.keys(conceptCodes)) {
    for (let codeId of conceptCodes[vocId]) {
      tags.add(canonicalTag(codes[vocId]?.[codeId]?.tag));
    }
  }
  if (tags.size == 0) {
    tags.add(null);
  }
  return Array.from(tags);
}
