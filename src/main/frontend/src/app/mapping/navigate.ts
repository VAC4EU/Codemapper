/// In-page navigation to a mapping tab via the URL fragment.
///
/// Chips render a plain anchor with `data-nav-fragment` instead of a RouterLink:
/// a RouterLink subscribes to the global router event stream per instance and
/// recomputes its href on every navigation, which does not scale to the
/// thousands of chips a large mapping renders. Tables handle the click once,
/// delegated, via `navigateFragmentFromClick`.

import { ElementRef } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';

export const NAV_FRAGMENT_ATTR = 'data-nav-fragment';

export function joinFragment(...parts: string[]): string {
  return parts.map(encodeURIComponent).join('/');
}

export function splitFragment(fragment: string | null): string[] {
  return (fragment ?? '').split('/').map(decodePart);
}

function decodePart(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

export function navigateHref(fragment: string): string {
  let hash = encodeURI(fragment);
  return window.location.pathname + window.location.search + '#' + hash;
}

/// Routes a delegated click on a chip anchor. Returns false when the event is
/// not ours or the browser should handle it (modifier click opens a new tab).
export function navigateFragmentFromClick(
  router: Router,
  event: MouseEvent,
): boolean {
  if (event.button != 0 || event.ctrlKey || event.metaKey || event.shiftKey) {
    return false;
  }
  let target = event.target as HTMLElement | null;
  let anchor = target?.closest(`[${NAV_FRAGMENT_ATTR}]`);
  let fragment = anchor?.getAttribute(NAV_FRAGMENT_ATTR);
  if (!fragment) return false;
  event.preventDefault();
  router.navigate([], { fragment });
  return true;
}

/// Scrolls the row with `id` into view, switching to its page first when the
/// table is paginated. The row is identified by the attribute `idAttr`.
export function scrollToRow<T extends { id: string }>(
  el: ElementRef,
  dataSource: MatTableDataSource<T>,
  idAttr: string,
  id: string,
) {
  let paginator = dataSource.paginator;
  if (paginator) {
    let index = displayedRows(dataSource).findIndex((row) => row.id == id);
    let pageIndex = Math.floor(index / paginator.pageSize);
    if (index >= 0 && pageIndex != paginator.pageIndex) {
      paginator.pageIndex = pageIndex;
      paginator.page.emit({
        pageIndex,
        pageSize: paginator.pageSize,
        length: paginator.length,
      });
    }
  }
  setTimeout(() => {
    let row = el.nativeElement.querySelector(`tr[${idAttr}="${CSS.escape(id)}"]`);
    row?.scrollIntoView({ block: 'center' });
  });
}

/// The rows in the order in which the table displays them: `filteredData` keeps
/// the order of `data`, the sort is applied only when rendering.
function displayedRows<T>(dataSource: MatTableDataSource<T>): T[] {
  let sort = dataSource.sort;
  return sort
    ? dataSource.sortData(dataSource.filteredData.slice(), sort)
    : dataSource.filteredData;
}

/// The displayed selected row that follows `afterId`, wrapping around.
export function nextSelectedRow<T extends { id: string }>(
  dataSource: MatTableDataSource<T>,
  selected: T[],
  afterId: string | null,
): T | null {
  let ids = new Set(selected.map((row) => row.id));
  let rows = displayedRows(dataSource).filter((row) => ids.has(row.id));
  if (rows.length == 0) return null;
  let index = rows.findIndex((row) => row.id == afterId);
  return rows[(index + 1) % rows.length];
}
