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
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collection;
import java.util.GregorianCalendar;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import javax.xml.bind.DatatypeConverter;
import javax.xml.bind.annotation.XmlRootElement;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.Comment;
import org.biosemantics.codemapper.authentification.AuthentificationApi;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.rest.CodeMapperResource;

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
        ProjectPermission role = ProjectPermission.fromChar(role0);
        permissions.put(project, role);
      }
      return permissions;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get projects", e);
    }
  }

  public static class UserRole {
    User user;
    ProjectPermission role;

    public UserRole() {
      super();
    }

    public UserRole(User user, ProjectPermission role) {
      this.user = user;
      this.role = role;
    }

    public User getUser() {
      return user;
    }

    public void setUser(User user) {
      this.user = user;
    }

    public ProjectPermission getRole() {
      return role;
    }

    public void setRole(ProjectPermission role) {
      this.role = role;
    }
  }

  public Collection<UserRole> getUserRoles(String projectName) throws CodeMapperException {
    String query =
        "SELECT u.username, u.email, u.is_admin, up.role "
            + "FROM projects p "
            + "INNER JOIN users_projects up ON up.project_id = p.id "
            + "INNER JOIN users u ON u.id = up.user_id "
            + "WHERE p.name = ?";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, projectName);
      ResultSet result = statement.executeQuery();
      Collection<UserRole> users = new LinkedList<>();
      while (result.next()) {
        String username = result.getString(1);
        String email = result.getString(2);
        boolean isAdmin = result.getBoolean(3);
        String role0 = result.getString(4);
        ProjectPermission role = ProjectPermission.fromChar(role0);
        User user = new User(username, email, isAdmin);
        users.add(new UserRole(user, role));
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

  @XmlRootElement
  public static class MappingInfo {
    public String mappingName;
    public String mappingShortkey;
    public String projectName;
    public String version;

    public String slugify() {
      return String.format("%s-%s", slugifyName(), mappingShortkey);
    }

    public String slugifyName() {
      return String.format(
          "%s-%s",
          CodeMapperResource.slugify(projectName), CodeMapperResource.slugify(mappingName));
    }

    public ParsedMappingName parseName() {
      ParsedMappingName parsed = new ParsedMappingName();
      String[] parts = this.mappingName.split("_");
      if (parts.length == 3) {
        parsed.system = parts[0];
        parsed.abbreviation = parts[1];
        parsed.type = parts[2];
        parsed.definition = null;
        return parsed;
      }
      if (parts.length == 4) {
        parsed.system = parts[0];
        parsed.abbreviation = parts[1];
        parsed.type = parts[2];
        parsed.definition = parts[3];
        return parsed;
      }
      return null;
    }

    public String withoutDefinition() {
      ParsedMappingName parsed = parseName();
      if (parsed != null) {
        return parsed.withoutDefinition();
      } else {
        return mappingName;
      }
    }
  }

  public static class ParsedMappingName {
    public String abbreviation;
    public String system;
    public String type;
    public String definition;

    public String withoutDefinition() {
      return String.format("%s_%s_%s", system, abbreviation, type);
    }
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
    public ProjectPermission role;
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
        ProjectPermission role = ProjectPermission.fromChar(role0);
        permissions.put(projectName, role);
      }
      return permissions.entrySet().stream()
          .map(
              e -> {
                ProjectInfo info = new ProjectInfo();
                info.name = e.getKey();
                info.role = e.getValue();
                return info;
              })
          .collect(Collectors.toList());
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get projects", e);
    }
  }

  public Collection<ProjectInfo> getAllProjectInfos(String username) throws CodeMapperException {
    String query =
        "SELECT DISTINCT p.name, up.role "
            + "FROM projects p "
            + "LEFT JOIN ("
            + "  SELECT * FROM users_projects up "
            + "  JOIN users u ON u.id = up.user_id "
            + "  WHERE u.username = ?"
            + ") up "
            + "ON up.project_id = p.id";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, username);
      ResultSet result = statement.executeQuery();
      Map<String, ProjectPermission> permissions = new HashMap<>();
      while (result.next()) {
        String projectName = result.getString(1);
        String role0 = result.getString(2);
        ProjectPermission role = role0 == null ? null : ProjectPermission.fromChar(role0);
        permissions.put(projectName, role);
      }
      return permissions.entrySet().stream()
          .map(
              e -> {
                ProjectInfo info = new ProjectInfo();
                info.name = e.getKey();
                info.role = e.getValue();
                return info;
              })
          .collect(Collectors.toList());
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get projects", e);
    }
  }

  public List<MappingInfo> getMappingInfos(String project) throws CodeMapperException {
    String query =
        "SELECT cd.shortkey, cd.name, r.version "
            + "FROM projects p "
            + "INNER JOIN case_definitions cd "
            + "ON cd.project_id = p.id "
            + "LEFT JOIN case_definition_latest_revision r "
            + "ON r.case_definition_id = cd.id "
            + "WHERE p.name = ? "
            + "AND (cd.status is null OR cd.status != 'DELETED')";

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, project);
      ResultSet set = statement.executeQuery();
      List<MappingInfo> mappings = new LinkedList<>();
      while (set.next()) {
        MappingInfo mapping = new MappingInfo();
        mapping.mappingShortkey = set.getString(1);
        mapping.mappingName = set.getString(2);
        mapping.version = set.getString(3);
        mapping.projectName = project;
        mappings.add(mapping);
      }
      return mappings;
    } catch (SQLException e) {
      e.printStackTrace();
      throw CodeMapperException.server("Cannot execute query to get case definition names", e);
    }
  }

  public int deleteMappings(List<String> shortkeys) throws CodeMapperException {
    String query = "UPDATE case_definitions SET status = 'DELETED' where shortkey = ANY(?)";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setArray(1, connection.createArrayOf("varchar", shortkeys.toArray()));
      return statement.executeUpdate();
    } catch (SQLException e) {
      e.printStackTrace();
      throw CodeMapperException.server("Cannot execute query to delete mappings", e);
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

  public Collection<User> getUsers() throws CodeMapperException {
    String query = "SELECT username, email, is_admin FROM users";
    try {
      Connection connection = connectionPool.getConnection();
      PreparedStatement statement = connection.prepareStatement(query);
      Collection<User> res = new ArrayList<>();
      ResultSet results = statement.executeQuery();
      while (results.next()) {
        String username = results.getString(1);
        String email = results.getString(2);
        boolean isAdmin = results.getBoolean(3);
        User user = new User(username, email, isAdmin);
        res.add(user);
      }
      return res;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get all users", e);
    }
  }

  public void createUser(String username, String password, String email)
      throws CodeMapperException {
    String query = "INSERT INTO users (username, password, email) VALUES (?, ?, ?)";
    try {
      Connection connection = connectionPool.getConnection();
      PreparedStatement statement = connection.prepareStatement(query);
      statement.setString(1, username);
      statement.setString(2, AuthentificationApi.hash(password));
      statement.setString(3, email);
      statement.execute();
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to create users", e);
    }
  }

  public void setUserPassword(String username, String password) throws CodeMapperException {
    String query = "UPDATE users SET password = ? WHERE username = ?";
    try {
      Connection connection = connectionPool.getConnection();
      PreparedStatement statement = connection.prepareStatement(query);
      statement.setString(1, AuthentificationApi.hash(password));
      statement.setString(2, username);
      statement.execute();
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to set user password", e);
    }
  }

  public void setUserAdmin(String username, boolean isAdmin) throws CodeMapperException {
    String query = "UPDATE users SET is_admin = ? WHERE username = ?";
    try {
      Connection connection = connectionPool.getConnection();
      PreparedStatement statement = connection.prepareStatement(query);
      statement.setBoolean(1, isAdmin);
      statement.setString(2, username);
      statement.execute();
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to set admin", e);
    }
  }

  public void createProject(String name) throws CodeMapperException {
    String query = "INSERT INTO projects (name) VALUES (?)";
    try {
      Connection connection = connectionPool.getConnection();
      PreparedStatement statement = connection.prepareStatement(query);
      statement.setString(1, name);
      statement.execute();
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to create project", e);
    }
  }

  public void addProjectUser(String projectName, String username, ProjectPermission perm)
      throws CodeMapperException {
    if (perm == null) {
      String query =
          "DELETE FROM users_projects "
              + "WHERE project_id IN (SELECT id FROM projects WHERE name = ?) "
              + "AND user_id IN (SELECT id FROM users WHERE username = ?)";

      try {
        Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query);
        statement.setString(1, projectName);
        statement.setString(2, username);
        statement.execute();
      } catch (SQLException e) {
        throw CodeMapperException.server("Cannot execute query to remove project user", e);
      }
    } else {
      String query =
          "INSERT INTO users_projects (user_id, project_id, role) "
              + "SELECT u.id, p.id, ? "
              + "FROM users u, projects p "
              + "WHERE u.username = ? "
              + "AND p.name = ? "
              + "ON CONFLICT (user_id, project_id) DO UPDATE "
              + "SET role = ?";
      try {
        Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query);
        statement.setString(1, perm.toChar());
        statement.setString(2, username);
        statement.setString(3, projectName);
        statement.setString(4, perm.toChar());
        statement.execute();
      } catch (SQLException e) {
        throw CodeMapperException.server("Cannot execute query to remove project user", e);
      }
    }
  }

  public boolean userExists(String username) throws CodeMapperException {
    String query = "SELECT id FROM users WHERE username = ?";
    try {
      Connection connection = connectionPool.getConnection();
      PreparedStatement statement = connection.prepareStatement(query);
      statement.setString(1, username);
      ResultSet results = statement.executeQuery();
      return results.next();
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to check user exists", e);
    }
  }

  public boolean isOwner(String username) throws CodeMapperException {
    String query =
        "SELECT up.id FROM users_projects up "
            + "JOIN users u ON u.id = up.user_id "
            + "WHERE u.username = ? "
            + "AND up.role = 'O'";
    try {
      Connection connection = connectionPool.getConnection();
      PreparedStatement statement = connection.prepareStatement(query);
      statement.setString(1, username);
      ResultSet results = statement.executeQuery();
      return results.next();
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to check user exists", e);
    }
  }

  public boolean projectExists(String name) throws CodeMapperException {
    String query = "SELECT id FROM projects WHERE name = ?";
    try {
      Connection connection = connectionPool.getConnection();
      PreparedStatement statement = connection.prepareStatement(query);
      statement.setString(1, name);
      ResultSet results = statement.executeQuery();
      return results.next();
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to check project exists", e);
    }
  }
}
