package org.biosemantics.codemapper.descendants;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Map;
import javax.sql.DataSource;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.CodingSystem;
import org.biosemantics.codemapper.MappingData.Code;
import org.biosemantics.codemapper.UmlsApi;
import org.biosemantics.codemapper.descendants.DescendantsApi.Descendants;

public class DescendantsCache {

  static class CachedCode {
    String id;
    String term;

    public CachedCode(Code c) {
      id = c.getId();
      term = c.getTerm();
    }

    public CachedCode() {}

    Code toCode() {
      Code code = new Code();
      code.setId(id);
      code.setTerm(term);
      return code;
    }

    public String getId() {
      return id;
    }

    public void setId(String id) {
      this.id = id;
    }

    public String getTerm() {
      return term;
    }

    public void setTerm(String term) {
      this.term = term;
    }
  }

  DataSource connectionPool;

  public DescendantsCache(DataSource connectionPool) {
    this.connectionPool = connectionPool;
  }

  public Descendants getDescendants(String voc, String vocVersion, Collection<String> codes)
      throws CodeMapperException {
    try {
      String query = "SELECT code, descendants FROM get_cached_descendants(?, ?, ?)";
      Connection connection = connectionPool.getConnection();
      PreparedStatement statement = connection.prepareStatement(query);
      statement.setString(1, voc);
      statement.setString(2, vocVersion);
      statement.setArray(3, connection.createArrayOf("varchar", codes.toArray()));
      Descendants result = new Descendants();
      ResultSet results = statement.executeQuery();
      while (results.next()) {
        String code = results.getString(1);
        String descendantsJson = results.getString(2);
        ObjectMapper mapper = new ObjectMapper();
        Collection<Code> cachedCodes =
            mapper.readValue(descendantsJson, new TypeReference<Collection<CachedCode>>() {})
                .stream()
                .map(CachedCode::toCode)
                .toList();
        result.put(code, cachedCodes);
      }
      return result;
    } catch (SQLException | JsonProcessingException e) {
      throw CodeMapperException.server("cannot get cached descendants", e);
    }
  }

  public void setDescendants(
      String voc, String vocVersion, String code, Collection<Code> descendants)
      throws CodeMapperException {
    Collection<CachedCode> cachedCodes = descendants.stream().map(c -> new CachedCode(c)).toList();
    String query = "SELECT set_cached_descendants(?, ?, ?, ?::TEXT)";
    try {
      ObjectMapper mapper = new ObjectMapper();
      String descendendsJson = mapper.writeValueAsString(cachedCodes);
      Connection connection = connectionPool.getConnection();
      PreparedStatement statement = connection.prepareStatement(query);
      statement.setString(1, voc);
      statement.setString(2, vocVersion);
      statement.setString(3, code);
      statement.setString(4, descendendsJson);
      System.out.println(statement);
      statement.execute();
    } catch (SQLException | JsonProcessingException e) {
      throw CodeMapperException.server("could not cache descendants", e);
    }
  }

  public void evict(int n) throws CodeMapperException {
    String query = "SELECT evict_cached_descendants(?)";
    try {
      Connection connection = connectionPool.getConnection();
      PreparedStatement statement = connection.prepareStatement(query);
      statement.setInt(1, n);
      statement.execute();
    } catch (SQLException e) {
      throw CodeMapperException.server("could not evict cached descendants", e);
    }
  }

  public Map<String, Descendants> getDescendantsAndCache(
      Map<String, Collection<String>> codesByVoc,
      Map<String, CodingSystem> codingSystems,
      DescendantsApi descendantsApi,
      UmlsApi umlsApi)
      throws CodeMapperException {
    Map<String, Descendants> res = new HashMap<>();
    for (String voc : codesByVoc.keySet()) {
      Collection<String> codes = codesByVoc.get(voc);
      String vocVersion = codingSystems.get(voc).getVersion();
      Descendants descendants = getDescendants(voc, vocVersion, codes);
      Collection<String> missing = new HashSet<>(codes);
      missing.removeAll(descendants.keySet());
      System.out.println(
          "Cached descendants in " + voc + " for: " + String.join(", ", descendants.keySet()));
      if (!missing.isEmpty()) {
        Descendants missingDescendants = descendantsApi.getCodeDescendants(voc, missing);
        descendants.putAll(missingDescendants);
        for (String code : missing) {
          Collection<Code> cacheDescendants =
              missingDescendants.getOrDefault(code, new LinkedList<>());
          setDescendants(voc, vocVersion, code, cacheDescendants);
        }
      }
      res.put(voc, descendants);
    }
    return res;
  }
}
