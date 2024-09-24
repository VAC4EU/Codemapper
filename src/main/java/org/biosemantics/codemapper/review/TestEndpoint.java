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

package org.biosemantics.codemapper.review;

import javax.websocket.EndpointConfig;
import javax.websocket.OnOpen;
import javax.websocket.Session;
import javax.websocket.server.PathParam;
import javax.websocket.server.ServerEndpoint;
import org.biosemantics.codemapper.authentification.User;

@ServerEndpoint(
    value = "/test/{project}/{caseDefinition}",
    configurator = GetHttpSessionConfigurator.class)
public class TestEndpoint {
  @OnOpen
  public void onOpen(
      Session session,
      EndpointConfig config,
      @PathParam("project") String project,
      @PathParam("caseDefinition") String caseDefinition) {

    User user = (User) config.getUserProperties().get("user");
    System.out.println("Test: " + user + " " + project + " " + caseDefinition + " " + user);
  }
}
