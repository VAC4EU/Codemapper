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

import static org.biosemantics.codemapper.persistency.PersistencyApi.timestampToString;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import javax.sql.DataSource;
import javax.xml.bind.annotation.XmlRootElement;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.review.Topic.Action;

public class ReviewApi {

  private static Logger logger = LogManager.getLogger(ReviewApi.class);

  private static final String EPOCH = "1970-01-01T00:00:00Z";

  private DataSource connectionPool;

  public ReviewApi(DataSource connectionPool) {
    this.connectionPool = connectionPool;
  }

  static String now() {
    return ZonedDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ISO_INSTANT);
  }

  static String epoch() {
    return EPOCH;
  }

  public void newMessage(
      String mappingShortkey, int topicId, String content, String user, String timestamp)
      throws CodeMapperException {
    if (timestamp == null) {
      timestamp = now();
    }
    logger.info(
        String.format("new message %s %d %s %s", mappingShortkey, topicId, content, timestamp));
    String query = "SELECT * FROM review_new_message(?, ?, ?, ?::TIMESTAMP)";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      int ix = 1;
      statement.setInt(ix++, topicId);
      statement.setString(ix++, content);
      statement.setString(ix++, user);
      statement.setString(ix++, timestamp);
      ResultSet set = statement.executeQuery();
      if (!set.next()) {
        throw CodeMapperException.server("could not save message");
      }
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to create message", e);
    }
  }

  public void editMessage(int messageId, String username, String content)
      throws CodeMapperException {
    String query = "SELECT review_edit_user_message(?, ?, ?)";
    try {
      Connection connection = connectionPool.getConnection();
      PreparedStatement statement = connection.prepareStatement(query);
      int ix = 1;
      statement.setInt(ix++, messageId);
      statement.setString(ix++, username);
      statement.setString(ix++, content);
      if (!statement.executeQuery().next()) {
        throw CodeMapperException.user("No such message");
      }
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to edit message", e);
    }
  }

  public int newTopic(
      String mappingShortkey,
      String cui,
      String sab,
      String code,
      String heading,
      String user,
      String timestamp)
      throws CodeMapperException {
    if (timestamp == null) {
      timestamp = now();
    }
    logger.info(
        String.format("new topic %s %s %s %s %s", mappingShortkey, cui, heading, user, timestamp));
    String query = "SELECT * FROM review_new_topic_shortkey(?, ?, ?, ?, ?, ?, ?::TIMESTAMP)";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      int ix = 1;
      statement.setString(ix++, mappingShortkey);
      statement.setString(ix++, cui);
      statement.setString(ix++, sab);
      statement.setString(ix++, code);
      statement.setString(ix++, heading);
      statement.setString(ix++, user);
      statement.setString(ix++, timestamp);
      ResultSet set = statement.executeQuery();
      if (!set.next()) {
        throw CodeMapperException.server("Could not save message");
      }
      return set.getInt(1);
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to create topic", e);
    }
  }

  @XmlRootElement
  public static class Topics extends HashMap<Integer, Topic> {

    private static final long serialVersionUID = 1L;
  }

  @XmlRootElement
  public static class AllTopics {
    public Map<String, Topics> byConcept = new HashMap<>();;
    public Map<String, Map<String, Topics>> byCode = new HashMap<>();;
    public Topics general = new Topics();

    public Set<String> allUsers() {
      Set<String> res = new HashSet<>();
      Stream.of(
              byConcept.values().stream(),
              byCode.values().stream().flatMap(m -> m.values().stream()),
              Stream.of(general))
          .flatMap(s -> s.flatMap(s1 -> s1.values().stream()))
          .forEach(
              top -> {
                res.add(top.created.getUser());
                for (Message msg : top.messages) {
                  res.add(msg.getUsername());
                }
              });
      return res;
    }

    public Stream<Topic> topics() {
      return Stream.of(
              Stream.of(general),
              byConcept.values().stream(),
              byCode.values().stream().flatMap(m -> m.values().stream()))
          .flatMap(s -> s.flatMap(s1 -> s1.values().stream()));
    }

    public long numTopics() {
      return topics().count();
    }

    public int numMessages() {
      return topics().mapToInt(t -> t.messages.size()).sum();
    }
  }

  public AllTopics getAll(String mappingShortkey, String user) throws CodeMapperException {
    String query = "SELECT * FROM review_all_messages_shortkey(?, ?::TEXT)";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, mappingShortkey);
      statement.setString(2, user);
      AllTopics allTopics = new AllTopics();
      ResultSet result = statement.executeQuery();
      while (result.next()) {
        int ix = 1;
        String cui = result.getString(ix++);
        String sab = result.getString(ix++);
        String code = result.getString(ix++);
        int topicID = result.getInt(ix++);
        String topicHeading = result.getString(ix++);
        String createdBy = result.getString(ix++);
        Timestamp createdAt = result.getTimestamp(ix++);
        boolean isResolved = result.getBoolean(ix++);
        String resolvedUser = result.getString(ix++);
        Timestamp resolvedTime = result.getTimestamp(ix++);
        int messageId = result.getInt(ix++);
        String messageAuthor = result.getString(ix++);
        Timestamp messageTime = result.getTimestamp(ix++);
        String messageContent = result.getString(ix++);
        boolean messageIsRead = result.getBoolean(ix++);

        Action created = new Action(createdBy, timestampToString(createdAt));
        Action resolved;
        if (isResolved) {
          assert (resolvedUser != null && resolvedTime != null);
          resolved = new Action(resolvedUser, timestampToString(resolvedTime));
        } else {
          resolved = null;
        }
        Topics topics;
        if (cui != null) {
          topics = allTopics.byConcept.computeIfAbsent(cui, key -> new Topics());
        } else if (sab != null && code != null) {
          topics =
              allTopics
                  .byCode
                  .computeIfAbsent(sab, key -> new HashMap<>())
                  .computeIfAbsent(code, key -> new Topics());
        } else {
          topics = allTopics.general;
        }
        Topic topic =
            topics.computeIfAbsent(
                topicID, key -> new Topic(topicID, topicHeading, created, resolved));
        if (messageId != 0) {
          Message message =
              new Message(
                  messageId,
                  messageAuthor,
                  timestampToString(messageTime),
                  messageContent,
                  messageIsRead);
          topic.messages.add(message);
        }
      }
      return allTopics;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get all review messages", e);
    }
  }

  public void resolveTopic(int topicId, String username, String timestamp)
      throws CodeMapperException {
    if (topicId == 0 || username == "") {
      throw CodeMapperException.user("invalid parameters to resolve topic");
    }
    logger.info(String.format("resolve topic %d %s %s", topicId, username, timestamp));
    if (timestamp == null) {
      timestamp = now();
    }
    String query = "SELECT * FROM review_resolve_topic(?, ?::TEXT, ?::TIMESTAMP)";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setInt(1, topicId);
      statement.setString(2, username);
      statement.setString(3, timestamp);
      statement.execute();
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to resolve topic", e);
    }
  }

  public void resetReadMarkers(int topicId) throws CodeMapperException {
    if (topicId == 0) {
      throw CodeMapperException.user("invalid parameters to reset read markers");
    }
    String query = "SELECT * FROM review_reset_mark_read(?)";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setInt(1, topicId);
      statement.execute();
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to reset read markers", e);
    }
  }

  public void markRead(int topicId, String username) throws CodeMapperException {
    String query = "SELECT * FROM review_mark_topic_read(?, ?::TEXT)";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setInt(1, topicId);
      statement.setString(2, username);
      statement.execute();
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to resolve topic", e);
    }
  }

  public static class TopicInfo {
    public String mappingShortkey;
    public boolean isResolved;
  }

  public TopicInfo getTopicInfo(int topicId) throws CodeMapperException {
    String query =
        "SELECT cd.shortkey, t.resolved FROM review_topic t "
            + "INNER JOIN case_definitions cd ON cd.id = t.case_definition_id "
            + "WHERE t.id = ?";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setInt(1, topicId);
      ResultSet set = statement.executeQuery();
      if (!set.next()) {
        throw CodeMapperException.user("No such topic: " + topicId);
      }
      TopicInfo info = new TopicInfo();
      info.mappingShortkey = set.getString(1);
      info.isResolved = set.getBoolean(2);
      return info;
    } catch (SQLException e) {
      e.printStackTrace();
      throw CodeMapperException.server("Cannot execute query to get topic info", e);
    }
  }

  public String getTopicCreatedBy(int topicId) throws CodeMapperException {
    String query = "SELECT * FROM review_topic_created_by(?)";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setInt(1, topicId);
      ResultSet set = statement.executeQuery();
      if (!set.next()) {
        return null;
      }
      return set.getString(1);
    } catch (SQLException e) {
      e.printStackTrace();
      throw CodeMapperException.server("Cannot execute query to get topic creator", e);
    }
  }

  public void saveReviews(String mappingShortkey, AllTopics allTopics) throws CodeMapperException {
    for (String cui : allTopics.byConcept.keySet()) {
      for (Topic top : allTopics.byConcept.get(cui).values()) {
        saveTopic(mappingShortkey, cui, null, null, top);
      }
    }
    for (String sab : allTopics.byCode.keySet()) {
      for (String code : allTopics.byCode.get(sab).keySet()) {
        for (Topic top : allTopics.byCode.get(sab).get(code).values()) {
          saveTopic(mappingShortkey, null, sab, code, top);
        }
      }
    }
    for (Topic top : allTopics.general.values()) {
      saveTopic(mappingShortkey, null, null, null, top);
    }
  }

  private void saveTopic(String mappingShortkey, String cui, String sab, String code, Topic top)
      throws CodeMapperException {

    String timestamp = top.created.timestamp;
    if (timestamp == null || timestamp.length() < 10) timestamp = EPOCH;
    int id = newTopic(mappingShortkey, cui, sab, code, top.heading, top.created.user, timestamp);
    for (Message msg : top.messages) {
      timestamp = msg.timestamp;
      if (timestamp == null || timestamp.length() < 10) timestamp = EPOCH;
      newMessage(mappingShortkey, id, msg.content, msg.username, timestamp);
    }
    if (top.resolved != null) {
      resolveTopic(id, top.resolved.user, top.resolved.timestamp);
    }
  }
}
