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

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.annotation.JsonTypeInfo.As;
import java.io.IOException;
import javax.xml.bind.annotation.XmlRootElement;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.rest.CodeMapperApplication;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = As.PROPERTY, property = "type")
@JsonSubTypes({
  @JsonSubTypes.Type(value = ClientMessage.SendMessage.class, name = "SendMessage"),
  @JsonSubTypes.Type(value = ClientMessage.NewTopic.class, name = "NewTopic")
})
public abstract class ClientMessage {

  public abstract void process(ReviewEndpoint endpoint, String user) throws IOException;

  @XmlRootElement
  static class SendMessage extends ClientMessage {
    int topicId;
    Message message;
    String token;

    public void process(ReviewEndpoint endpoint, String user) throws IOException {
      try {
        CodeMapperApplication.getReviewApi()
            .newMessage(endpoint.mappingShortkey, topicId, message.content, user, null);
      } catch (CodeMapperException e) {
        throw new IOException(e);
      }
    }
  }

  @XmlRootElement
  static class NewTopic extends ClientMessage {
    String cui;
    String sab;
    String code;
    Message message;
    String token;

    @Override
    public void process(ReviewEndpoint endpoint, String user) throws IOException {
      try {
        CodeMapperApplication.getReviewApi()
            .newTopic(endpoint.mappingShortkey, cui, sab, code, message.content, user, null);
      } catch (CodeMapperException e) {
        throw new IOException(e);
      }
    }
  }
}
