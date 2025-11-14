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
import { HttpRequest, HttpHandler, HttpInterceptor } from '@angular/common/http';
import { environment } from '../environments/environment';
import { finalize } from 'rxjs/operators';
import { LoadingService } from './loading.service';

const IGNORED_URLS = [
  environment.apiUrl + "/code-mapper/autocomplete-code",
]

@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  private totalRequests = 0;

  constructor(private loadingService : LoadingService) { }

  intercept(request : HttpRequest<any>, next : HttpHandler) {
    if (IGNORED_URLS.some(url => request.url == url)) {
      return next.handle(request);
    } else {
      this.totalRequests++;
      setTimeout(() => this.loadingService.setLoading(true));
      return next.handle(request).pipe(
        finalize(() => {
          this.totalRequests--;
          if (this.totalRequests == 0) {
            setTimeout(() => this.loadingService.setLoading(false));
          }
        })
      );
    }
  }
}
