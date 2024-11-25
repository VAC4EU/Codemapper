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

package org.biosemantics.codemapper.rest;

import javax.inject.Inject;
import javax.servlet.http.HttpServletRequest;
import org.biosemantics.codemapper.authentification.User;
import org.glassfish.hk2.api.Factory;

public class UserFactory implements Factory<User> {

  private final HttpServletRequest request;

  @Inject
  public UserFactory(HttpServletRequest request) {
    this.request = request;
  }

  @Override
  public User provide() {
    return CodeMapperApplication.getAuthentificationApi().getUser(request);
  }

  @Override
  public void dispose(User t) {}
}
