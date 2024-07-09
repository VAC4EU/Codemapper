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

import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import javax.websocket.EncodeException;
import javax.websocket.EndpointConfig;
import javax.websocket.OnClose;
import javax.websocket.OnError;
import javax.websocket.OnMessage;
import javax.websocket.OnOpen;
import javax.websocket.Session;
import javax.websocket.server.PathParam;
import javax.websocket.server.ServerEndpoint;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.rest.CodeMapperApplication;
import org.biosemantics.codemapper.review.ReviewApi.AllTopics;

/*
 * CLIENT                                    SERVER
 *    <--  CurrentThreads(threads)           <-- (on init)
 *    -->  SendMessage(content, cui, thread) -->
 *    <--  NewMessage(content, cui, thread)  <-- (after SendMessage)
 */

@ServerEndpoint(
    value = "/review/{project}/{caseDefinition}",
    encoders = MessageEncoder.class,
    decoders = MessageDecoder.class,
    configurator = GetHttpSessionConfigurator.class)
public class ReviewEndpoint {

  //	static PolymorphicTypeValidator ptv = BasicPolymorphicTypeValidator.builder()
  //			.allowIfSubType(ClientMessage.class)
  //			.allowIfSubType(ServerMessage.class)
  //			.build();

  // private (non-static) Set<ReviewEndpoint> endpoints??
  private static Map<String, Set<ReviewEndpoint>> endpoints = new HashMap<>();

  private Session session;
  User user;
  String mappingUUID;

  @OnOpen
  public void onOpen(
      Session session, EndpointConfig config, @PathParam("mappingUUID") String mappingUUID)
      throws IOException {

    this.user = (User) config.getUserProperties().get("user");
    if (this.user == null) {
      throw new IOException("user not logged in");
    }
    System.out.println("ReviewEndpoint user: " + user + " " + mappingUUID);

    this.session = session;
    this.mappingUUID = mappingUUID;
    endpoints.getOrDefault(mappingUUID, new HashSet<>()).add(this);

    try {
      AllTopics allTopics =
          CodeMapperApplication.getReviewApi().getAll(mappingUUID, this.user.getUsername());
      ObjectMapper mapper = new ObjectMapper();
      mapper.setVisibility(PropertyAccessor.FIELD, Visibility.ANY);
      this.session.getBasicRemote().sendObject(new ServerMessage.CurrentThreads(allTopics));
    } catch (IOException | EncodeException | CodeMapperException e) {
      e.printStackTrace();
    }
  }

  static void broadcast(ServerMessage message) throws IOException {
    endpoints.forEach(
        (mappingUUID, forMapping) -> {
          forMapping.forEach(
              endpoint -> {
                try {
                  endpoint.session.getBasicRemote().sendObject(message);
                } catch (IOException | EncodeException e) {
                  e.printStackTrace();
                }
              });
        });
  }

  @OnMessage
  public void onMessage(Session session, ClientMessage message) throws IOException {
    message.process(this, user.getUsername());
  }

  @OnClose
  public void onClose(Session session) throws IOException {}

  @OnError
  public void onError(Session session, Throwable throwable) {}
}
