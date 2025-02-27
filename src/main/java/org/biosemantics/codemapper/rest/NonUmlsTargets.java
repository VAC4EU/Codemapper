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

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import javax.sql.DataSource;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.CodingSystem;
import org.biosemantics.codemapper.MappingData.Code;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.UmlsConcept;

public class NonUmlsTargets {

  private static final List<String> LEXICOGRAPHICAL_CODING_SYSTEMS = Arrays.asList("ICD10DA");
  private DataSource connectionPool;

  public NonUmlsTargets(DataSource connectionPool) throws CodeMapperException {
    this.connectionPool = connectionPool;
  }

  public Collection<CodingSystem> getVocabularies() throws CodeMapperException {
    String query = "SELECT DISTINCT abbr, full_name, ver FROM non_umls_latest_vocs";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      Collection<CodingSystem> vocs = new LinkedList<>();
      ResultSet result = statement.executeQuery();
      while (result.next()) {
        CodingSystem voc = new CodingSystem();
        int ix = 1;
        voc.setAbbreviation(result.getString(ix++));
        voc.setName(result.getString(ix++));
        voc.setVersion(result.getString(ix++));
        vocs.add(voc);
      }
      return vocs;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for non umls coding systems", e);
    }
  }

  public boolean is(String codingSystem) throws CodeMapperException {
    return this.getVocabularies().stream().anyMatch(v -> v.getAbbreviation().equals(codingSystem));
  }

  public Map<String, Collection<String>> getCuisForCodes(String abbr, Collection<String> codes)
      throws CodeMapperException {
    String query =
        ""
            + "SELECT DISTINCT code, cui "
            + "FROM non_umls_latest_codes "
            + "WHERE voc_abbr = ? "
            + "AND code = ANY(?)";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, abbr);
      statement.setArray(2, connection.createArrayOf("VARCHAR", codes.toArray()));
      Map<String, Collection<String>> res = new HashMap<>();
      ResultSet result = statement.executeQuery();
      while (result.next()) {
        String code = result.getString(1);
        String cui = result.getString(2);
        res.computeIfAbsent(code, (key) -> new HashSet<>()).add(cui);
      }
      return res;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query to get cuis for non-umls codes", e);
    }
  }

  public Map<String, List<SourceConcept>> getSourceConcepts(
      Collection<String> cuis, Collection<String> vocs) throws CodeMapperException {
    String query =
        ""
            + "SELECT DISTINCT cui, voc_abbr, code, term "
            + "FROM non_umls_latest_codes "
            + "WHERE cui = ANY(?) "
            + "AND voc_abbr = ANY(?)";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setArray(1, connection.createArrayOf("VARCHAR", cuis.toArray()));
      statement.setArray(2, connection.createArrayOf("VARCHAR", vocs.toArray()));
      Map<String, List<SourceConcept>> sourceConcepts = new TreeMap<>();
      ResultSet result = statement.executeQuery();
      while (result.next()) {
        int ix = 1;
        String cui = result.getString(ix++);
        String voc = result.getString(ix++);
        String code = result.getString(ix++);
        String term = result.getString(ix++);
        SourceConcept sourceConcept = new SourceConcept();
        sourceConcept.setCui(cui);
        sourceConcept.setCodingSystem(voc);
        sourceConcept.setId(code);
        sourceConcept.setPreferredTerm(term);
        sourceConcepts.computeIfAbsent(cui, (key) -> new LinkedList<>()).add(sourceConcept);
      }
      return sourceConcepts;
    } catch (SQLException e) {
      throw CodeMapperException.server(
          "Cannot execute query to get source concepts for non-umls codes", e);
    }
  }

  public Collection<String> getTermCompletionsCuis(String q, Collection<String> vocs)
      throws CodeMapperException {
    String query =
        ""
            + "SELECT DISTINCT cui "
            + "FROM non_umls_latest_codes "
            + "WHERE voc_abbr = ANY(?) "
            + "AND term LIKE ?";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setArray(1, connection.createArrayOf("VARCHAR", vocs.toArray()));
      statement.setString(2, q + "%");
      ResultSet result = statement.executeQuery();
      HashSet<String> cuis = new HashSet<>();
      while (result.next()) {
        String cui = result.getString(1);
        cuis.add(cui);
      }
      return cuis;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for completions", e);
    }
  }

  public List<UmlsConcept> getCodeCompletions(String q, String codingSystem)
      throws CodeMapperException {
    String query =
        ""
            + "SELECT DISTINCT cui, voc_abbr, code, term "
            + "FROM non_umls_latest_codes WHERE "
            + "((code = ? AND voc_abbr LIKE ?) OR cui = ?) "
            + "LIMIT 20";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, q);
      statement.setString(2, codingSystem == null ? "%" : (codingSystem + "%"));
      statement.setString(3, q);
      ResultSet result = statement.executeQuery();
      Map<String, UmlsConcept> concepts = new TreeMap<>();
      while (result.next()) {
        String cui = result.getString(1);
        String voc = result.getString(2);
        String code = result.getString(3);
        String term = result.getString(4);
        String name;
        if (q.equals(cui)) name = String.format("CUI %s: %s", cui, term);
        else name = String.format("%s in %s: %s", code, voc, term);
        concepts
            .computeIfAbsent(cui, key -> new UmlsConcept(cui, name))
            .getSourceConcepts()
            .add(new SourceConcept(cui, voc, code));
      }
      return new LinkedList<UmlsConcept>(concepts.values());
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for completions", e);
    }
  }

  public Map<String, Collection<Code>> getDescendants(String voc, Collection<String> codes)
      throws CodeMapperException {
    if (LEXICOGRAPHICAL_CODING_SYSTEMS.contains(voc)) {
      return getDescendantsLexicographical(voc, codes);
    } else {
      return new HashMap<>();
    }
  }

  public Map<String, Collection<Code>> getDescendantsLexicographical(
      String voc, Collection<String> codes) throws CodeMapperException {
    Collection<String> codes1 = new TreeSet<>(codes); // sorted, unique
    Set<String> prefixes = new HashSet<>();
    String prefix = null;
    for (String code : codes1) {
      if (prefix == null || !code.startsWith(prefix)) {
        prefix = code;
        prefixes.add(prefix);
      }
    }
    String query =
        ""
            + "SELECT DISTINCT code, term "
            + "FROM non_umls_latest_codes "
            + "WHERE voc_abbr = ? "
            + "AND code LIKE ANY(?)";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      Object[] prefixesArray = prefixes.stream().map(s -> s + "%").toArray();
      statement.setString(1, voc);
      statement.setArray(2, connection.createArrayOf("varchar", prefixesArray));
      Map<String, Collection<Code>> result = new HashMap<>();
      ResultSet set = statement.executeQuery();
      while (set.next()) {
        String id = set.getString(1);
        String term = set.getString(2);
        Code code = new Code(id, term, false, true, null);
        for (String code1 : codes1) {
          if (code.getId().startsWith(code1)) {
            result.computeIfAbsent(code1, key -> new LinkedList<Code>()).add(code);
          }
        }
      }
      return result;
    } catch (SQLException e) {
      throw CodeMapperException.server(
          "Cannot execute query for get non-umls lexicographical descendants", e);
    }
  }
}
