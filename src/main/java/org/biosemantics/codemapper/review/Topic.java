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

import java.util.Collection;
import java.util.LinkedList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class Topic {

  public int id;
  public String heading;
  public Action created;
  public Action resolved = null;
  public Collection<Message> messages;

  public Topic() {
    this(0, null, null, null);
  }

  public Topic(int id, String heading, Action created, Action resolved) {
    this.id = id;
    this.heading = heading;
    this.created = created;
    this.resolved = resolved;
    this.messages = new LinkedList<>();
  }

  public int getId() {
    return id;
  }

  public void setId(int id) {
    this.id = id;
  }

  public String getHeading() {
    return heading;
  }

  public void setHeading(String heading) {
    this.heading = heading;
  }

  public Action getCreated() {
    return created;
  }

  public void setCreated(Action created) {
    this.created = created;
  }

  public Action getResolved() {
    return resolved;
  }

  public void setResolved(Action resolved) {
    this.resolved = resolved;
  }

  public Collection<Message> getMessages() {
    return messages;
  }

  public void setMessages(Collection<Message> messages) {
    this.messages = messages;
  }

  @XmlRootElement
  public static class Action {
    String timestamp;
    String user;

    public Action() {
      this(null, null);
    }

    public Action(String user, String timestamp) {
      this.timestamp = timestamp;
      this.user = user;
    }

    public String getTimestamp() {
      return timestamp;
    }

    public void setTimestamp(String timestamp) {
      this.timestamp = timestamp;
    }

    public String getUser() {
      return user;
    }

    public void setUser(String user) {
      this.user = user;
    }
  }

  public String[] onCode() {
    Pattern p = Pattern.compile("([A-Z0-9_-])/([A-Z0-9_-])($|:)");
    Matcher m = p.matcher(heading);
    if (m.matches()) {
      return new String[] {m.group(1), m.group(2)};
    } else {
      return null;
    }
  }
}
