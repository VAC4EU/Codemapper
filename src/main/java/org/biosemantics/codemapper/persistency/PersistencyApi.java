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

package org.biosemantics.codemapper.persistency;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Calendar;
import java.util.Collection;
import java.util.GregorianCalendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import javax.xml.bind.DatatypeConverter;
import javax.xml.bind.annotation.XmlRootElement;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.Comment;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;

public class PersistencyApi {

  private DataSource connectionPool;

  public PersistencyApi(DataSource connectionPool) {
    this.connectionPool = connectionPool;
  }

  public List<String> getProjects() throws CodeMapperException {
    String query = "SELECT name FROM projects";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      ResultSet result = statement.executeQuery();
      List<String> results = new LinkedList<>();
      while (result.next()) results.add(result.getString(1));
      return results;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get projects", e);
    }
  }

  private List<String> parameterizedStringListQuery(String query, String... arguments)
      throws SQLException {
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      for (int i = 0; i < arguments.length; i++) statement.setString(i + 1, arguments[i]);
      ResultSet result = statement.executeQuery();
      List<String> results = new LinkedList<>();
      while (result.next()) results.add(result.getString(1));
      return results;
    }
  }

  private String parameterizedStringQuery(String query, String... arguments) throws SQLException {
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      for (int i = 0; i < arguments.length; i++) statement.setString(i + 1, arguments[i]);
      ResultSet result = statement.executeQuery();
      if (result.next()) return result.getString(1);
      else return null;
    }
  }

  public Map<String, ProjectPermission> getProjectPermissions(String username)
      throws CodeMapperException {
    String query =
        "SELECT projects.name as project, users_projects.role as role "
            + "FROM users "
            + "INNER JOIN users_projects ON users_projects.user_id = users.id "
            + "INNER JOIN projects ON projects.id = users_projects.project_id "
            + "WHERE users.username = ?";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, username);
      ResultSet result = statement.executeQuery();
      Map<String, ProjectPermission> permissions = new HashMap<>();
      while (result.next()) {
        String project = result.getString("project");
        String role0 = result.getString("role");
        ProjectPermission role = ProjectPermission.fromString(role0);
        permissions.put(project, role);
      }
      return permissions;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get projects", e);
    }
  }

  public Map<String, Set<ProjectPermission>> getUsersOfProject(String project)
      throws CodeMapperException {
    String query =
        "SELECT users.username as username, users_projects.role as role "
            + "FROM projects "
            + "INNER JOIN users_projects ON users_projects.project_id = projects.id "
            + "INNER JOIN users ON users.id = users_projects.user_id "
            + "WHERE projects.name = ?";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, project);
      ResultSet result = statement.executeQuery();
      Map<String, Set<ProjectPermission>> users = new HashMap<>();
      while (result.next()) {
        String username = result.getString("username");
        String role0 = result.getString("role");
        ProjectPermission role = ProjectPermission.fromString(role0);
        if (!users.containsKey(username)) users.put(username, new HashSet<ProjectPermission>());
        users.get(username).add(role);
      }
      return users;
    } catch (SQLException e) {
      e.printStackTrace();
      throw CodeMapperException.server("Cannot execute query to get users of project", e);
    }
  }

  public List<String> getCaseDefinitionsNames(String project) throws CodeMapperException {
    String query =
        "SELECT case_definitions.name FROM case_definitions "
            + "JOIN projects ON projects.id = case_definitions.project_id "
            + "WHERE projects.name = ?";
    try {
      return parameterizedStringListQuery(query, project);
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get case definition names", e);
    }
  }

  public String getCaseDefinition(String shortkey) throws CodeMapperException {
    String query = "SELECT cd.state FROM case_definitions cd WHERE cd.shortkey = ?";
    try {
      return parameterizedStringQuery(query, shortkey);
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get case definition", e);
    }
  }

  public MappingRevision getRevision(String shortkey, Integer version) throws CodeMapperException {
    String query =
        "SELECT r.mapping, r.timestamp, r.summary, u.username as user "
            + "FROM case_definitions cd "
            + "INNER JOIN case_definition_revisions r ON r.case_definition_id = cd.id "
            + "INNER JOIN users u ON u.id = r.user_id "
            + "WHERE cd.shortkey = ? "
            + "AND r.version = ? "
            + "ORDER BY r.timestamp DESC "
            + "LIMIT 1";

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, shortkey);
      statement.setInt(2, version);
      ResultSet result = statement.executeQuery();
      if (result.next()) {
        String mapping = result.getString("mapping");
        String timestamp = result.getString("timestamp");
        String summary = result.getString("summary");
        String user = result.getString("user");
        return new MappingRevision(version, user, timestamp, summary, mapping);
      } else {
        return null;
      }
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get revision", e);
    }
  }

  /** Return the latest revision of a mapping, if it has one, or null otherwise. */
  public MappingRevision getLatestRevision(String shortkey) throws CodeMapperException {
    String query =
        "SELECT r.version, r.mapping, r.timestamp, r.summary, u.username as user "
            + "FROM case_definitions cd "
            + "INNER JOIN case_definition_revisions r ON r.case_definition_id = cd.id "
            + "INNER JOIN users u ON u.id = r.user_id "
            + "WHERE cd.shortkey = ? "
            + "ORDER BY r.timestamp DESC "
            + "LIMIT 1";

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, shortkey);
      ResultSet result = statement.executeQuery();
      if (result.next()) {
        int version = result.getInt("version");
        String mapping = result.getString("mapping");
        String summary = result.getString("summary");
        String timestamp = result.getString("timestamp");
        String user = result.getString("user");
        return new MappingRevision(version, user, timestamp, summary, mapping);
      } else {
        return null;
      }
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get latest revision", e);
    }
  }

  public List<MappingRevision> getRevisions(String shortkey) throws CodeMapperException {
    String query =
        "SELECT r.version, u.username AS user, r.timestamp, r.summary "
            + "FROM case_definition_revisions r "
            + "INNER JOIN case_definitions cd "
            + "ON r.case_definition_id = cd.id "
            + "INNER JOIN users u "
            + "ON u.id = r.user_id "
            + "WHERE cd.shortkey = ? "
            + "ORDER BY r.timestamp DESC";

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, shortkey);
      ResultSet result = statement.executeQuery();
      List<MappingRevision> res = new LinkedList<>();
      while (result.next()) {
        int version = result.getInt("version");
        String user = result.getString("user");
        String timestamp = result.getString("timestamp");
        String summary = result.getString("summary");
        res.add(new MappingRevision(version, user, timestamp, summary, null));
      }
      return res;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get latest revision", e);
    }
  }

  public int saveRevision(String shortkey, String username, String summary, String mappingJson)
      throws CodeMapperException {
    String query =
        "INSERT INTO case_definition_revisions (case_definition_id, user_id, mapping, summary) "
            + "SELECT cd.id, u.id, ?::jsonb, ? "
            + "FROM case_definitions cd, users u "
            + "WHERE u.username = ? AND cd.shortkey = ? "
            + "RETURNING version";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      int ix = 1;
      statement.setString(ix++, mappingJson);
      statement.setString(ix++, summary);
      statement.setString(ix++, username);
      statement.setString(ix++, shortkey);
      ResultSet result = statement.executeQuery();
      if (result.next()) {
        return result.getInt("version");
      } else {
        throw CodeMapperException.server("Save revision did not return an id");
      }
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to save revision", e);
    }
  }

  public List<Comment> getComments(String shortkey) throws CodeMapperException {
    String query =
        "SELECT users.username AS author, DATE_TRUNC ('second', timestamp) as timestamp, cui, content, timestamp as full_timestamp "
            + "FROM comments "
            + "INNER JOIN users ON comments.author = users.id "
            + "INNER JOIN case_definitions on comments.case_definition_id = case_definitions.id "
            + "WHERE case_definitions.shortkey = ? "
            + "ORDER BY full_timestamp";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, shortkey);
      ResultSet result = statement.executeQuery();
      List<Comment> comments = new LinkedList<>();
      while (result.next()) {
        String author = result.getString("author");
        Timestamp timestamp0 = result.getTimestamp("timestamp");
        String timestamp = timestampToString(timestamp0);
        String cui = result.getString("cui");
        String content = result.getString("content");
        Comment comment = new Comment(cui, author, timestamp, content);
        comments.add(comment);
      }
      return comments;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get comments", e);
    }
  }

  public static String timestampToString(Timestamp timestamp) {
    Calendar calendar = new GregorianCalendar();
    calendar.setTime(timestamp);
    return DatatypeConverter.printDateTime(calendar);
  }

  public void createComment(String shortkey, User user, String cui, String content)
      throws CodeMapperException {
    String query =
        "INSERT INTO comments (case_definition_id, cui, author, content) "
            + "SELECT cd.id, ?, u.id, ? "
            + "FROM users u, case_definitions cd "
            + "WHERE cd.shortkey = ? AND users.username = ?";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, cui);
      statement.setString(2, content);
      statement.setString(3, shortkey);
      statement.setString(4, user.getUsername());
      statement.executeUpdate();
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to create comments", e);
    }
  }

  public int ensureUser(String username) throws CodeMapperException {
    String query =
        ""
            + "WITH sel AS ( "
            + "  SELECT u.id "
            + "  FROM users AS u "
            + "  WHERE u.username = ? "
            + "), ins AS ( "
            + "  INSERT INTO users (username, password, email, anonymous) "
            + "  VALUES (?, '', '', true) "
            + "  ON CONFLICT DO NOTHING "
            + "  RETURNING id "
            + ") "
            + "SELECT id FROM sel "
            + "UNION ALL "
            + "SELECT id FROM ins";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, username);
      statement.setString(2, username);
      ResultSet res = statement.executeQuery();
      if (!res.next()) {
        throw CodeMapperException.server("Missing ID to ensure user");
      }
      return res.getInt(1);
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to ensure user", e);
    }
  }

  public void ensureUsers(Set<String> users) throws CodeMapperException {
    for (String user : users) {
      ensureUser(user);
    }
  }

  @XmlRootElement
  public static class MappingInfo {
    public String mappingName;
    public String mappingShortkey;
    public String projectName;
  }

  public MappingInfo getMappingInfo(String shortkey) throws CodeMapperException {
    String query =
        "SELECT mapping_name, project_name "
            + "FROM projects_mappings_shortkey "
            + "WHERE mapping_shortkey = ?";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, shortkey);
      ResultSet res = statement.executeQuery();
      if (!res.next()) {
        throw CodeMapperException.user("Invalid mapping shortkey " + shortkey);
      }
      MappingInfo mapping = new MappingInfo();
      mapping.mappingShortkey = shortkey;
      mapping.mappingName = res.getString(1);
      mapping.projectName = res.getString(2);
      return mapping;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for mapping info", e);
    }
  }

  public MappingInfo getMappingInfoByOldName(String projectName, String mappingName)
      throws CodeMapperException {
    String query =
        "SELECT mapping_shortkey, mapping_name, project_name "
            + "FROM projects_mappings_shortkey "
            + "WHERE project_name = ? AND mapping_old_name = ?";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, projectName);
      statement.setString(2, mappingName);
      ResultSet res = statement.executeQuery();
      if (!res.next()) {
        throw CodeMapperException.user(
            "Invalid mapping shortkey " + projectName + "/" + mappingName);
      }
      MappingInfo mapping = new MappingInfo();
      mapping.mappingShortkey = res.getString(1);
      mapping.mappingName = res.getString(2);
      mapping.projectName = res.getString(3);
      return mapping;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for mapping info", e);
    }
  }

  @XmlRootElement
  public static class ProjectInfo {
    public String name;
    public ProjectPermission permission;
  }

  public Collection<ProjectInfo> getProjectInfos(String username) throws CodeMapperException {

    String query =
        "SELECT projects.name, up.role "
            + "FROM users "
            + "INNER JOIN users_projects up ON up.user_id = users.id "
            + "INNER JOIN projects ON projects.id = up.project_id "
            + "WHERE users.username = ?";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, username);
      ResultSet result = statement.executeQuery();
      Map<String, ProjectPermission> permissions = new HashMap<>();
      while (result.next()) {
        String projectName = result.getString(1);
        String role0 = result.getString(2);
        ProjectPermission role = ProjectPermission.fromString(role0);
        permissions.put(projectName, role);
      }
      return permissions.entrySet().stream()
          .map(
              e -> {
                ProjectInfo info = new ProjectInfo();
                info.name = e.getKey();
                info.permission = e.getValue();
                return info;
              })
          .collect(Collectors.toList());
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get projects", e);
    }
  }

  public List<MappingInfo> getMappingInfos(String project) throws CodeMapperException {
    String query =
        "SELECT cd.shortkey, cd.name "
            + "FROM projects p "
            + "INNER JOIN case_definitions cd "
            + "ON cd.project_id = p.id "
            + "WHERE p.name = ?";

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, project);
      System.out.println(statement);
      ResultSet set = statement.executeQuery();
      List<MappingInfo> mappings = new LinkedList<>();
      while (set.next()) {
        MappingInfo mapping = new MappingInfo();
        mapping.mappingShortkey = set.getString(1);
        mapping.mappingName = set.getString(2);
        mapping.projectName = project;
        mappings.add(mapping);
      }
      return mappings;
    } catch (SQLException e) {
      e.printStackTrace();
      throw CodeMapperException.server("Cannot execute query to get case definition names", e);
    }
  }

  public MappingInfo createMapping(String projectName, String mappingName)
      throws CodeMapperException {
    String query =
        "INSERT INTO case_definitions (project_id, name) "
            + "SELECT p.id, ? FROM projects p WHERE p.name = ? "
            + "RETURNING shortkey";

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, mappingName);
      statement.setString(2, projectName);
      ResultSet set = statement.executeQuery();
      if (!set.next()) {
        throw CodeMapperException.server("no shortkey when creating a mapping");
      }
      MappingInfo mapping = new MappingInfo();
      mapping.mappingName = mappingName;
      mapping.projectName = projectName;
      mapping.mappingShortkey = set.getString(1);
      return mapping;
    } catch (SQLException e) {
      e.printStackTrace();
      throw CodeMapperException.server("Cannot execute query to create mapping", e);
    }
  }

  public void setName(String mappingShortkey, String name) throws CodeMapperException {
    String query = "UPDATE case_definitions SET name = ? WHERE shortkey = ?";

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, name);
      statement.setString(2, mappingShortkey);
      statement.execute();
    } catch (SQLException e) {
      e.printStackTrace();
      throw CodeMapperException.server("Cannot execute query to rename mapping", e);
    }
  }
}
