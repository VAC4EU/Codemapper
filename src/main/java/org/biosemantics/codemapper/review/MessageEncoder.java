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
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.websocket.EncodeException;
import javax.websocket.Encoder;
import javax.websocket.EndpointConfig;

public class MessageEncoder implements Encoder.Text<ServerMessage> {

  ObjectMapper mapper = new ObjectMapper();

  @Override
  public String encode(ServerMessage message) throws EncodeException {
    try {
      return mapper.writeValueAsString(message);
    } catch (JsonProcessingException e) {
      throw new EncodeException(message, "cannot encode", e);
    }
  }

  @Override
  public void init(EndpointConfig endpointConfig) {
    mapper.setVisibility(PropertyAccessor.FIELD, Visibility.ANY);
    //		mapper.activateDefaultTyping(ReviewEndpoint.ptv, DefaultTyping.EVERYTHING,
    //				JsonTypeInfo.As.PROPERTY);
  }

  @Override
  public void destroy() {}
}
