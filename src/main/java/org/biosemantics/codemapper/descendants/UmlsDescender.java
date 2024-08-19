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

package org.biosemantics.codemapper.descendants;

import com.mchange.v2.c3p0.DataSources;
import java.sql.Array;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.descendants.DescendantsApi.GeneralDescender;

public class UmlsDescender implements GeneralDescender {

  private static Logger logger = LogManager.getLogger(UmlsDescender.class);

  private DataSource connectionPool;

  public UmlsDescender(DataSource connectionPool) {
    this.connectionPool = connectionPool;
  }

  public static Collection<String> concat(Collection<Collection<String>> sss) {
    Collection<String> res = new HashSet<>();
    for (Collection<String> ss : sss) {
      res.addAll(ss);
    }
    return res;
  }

  public Map<String, Collection<SourceConcept>> getDescendants(
      Collection<String> codes, String codingSystem) throws CodeMapperException {
    // {code -> {aui}}
    Map<String, Collection<String>> auis = getCodeAuis(codingSystem, codes);

    // {aui -> {aui}}
    Map<String, Collection<String>> descendantAuis =
        getDescendantAuis(codingSystem, concat(auis.values()), true);

    // {aui -> SourceConcept}
    Map<String, SourceConcept> concepts =
        getConcepts(connectionPool, concat(descendantAuis.values()));

    // {code -> {SourceConcept}}
    Map<String, Collection<SourceConcept>> res = new HashMap<>();
    for (String code : codes) {
      List<SourceConcept> sourceConcepts = new LinkedList<>();
      if (!auis.containsKey(code)) {
        continue;
      }
      for (String superAui : auis.get(code)) {
        if (!descendantAuis.containsKey(superAui)) {
          continue;
        }
        for (String subAui : descendantAuis.get(superAui)) {
          if (!concepts.containsKey(subAui)) {
            continue;
          }
          sourceConcepts.add(concepts.get(subAui));
        }
      }
      Collections.sort(sourceConcepts, Comparator.comparing(SourceConcept::getId));
      res.put(code, sourceConcepts);
    }
    return res;
  }

  /** Returns a mapping from codes to sets of auis. */
  public Map<String, Collection<String>> getCodeAuis(String codingSystem, Collection<String> codes)
      throws CodeMapperException {
    String query = "SELECT DISTINCT code, aui FROM mrconso WHERE sab = ? AND code = ANY(?)";

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, codingSystem);
      statement.setArray(2, connection.createArrayOf("VARCHAR", codes.toArray()));

      Map<String, Collection<String>> res = new HashMap<>();
      ResultSet set = statement.executeQuery();
      while (set.next()) {
        String code = set.getString(1);
        String aui = set.getString(2);
        res.computeIfAbsent(code, key -> new HashSet<>()).add(aui);
      }
      return res;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for decendant auis", e);
    }
  }

  Map<String, Collection<String>> getDescendantAuis(
      String sab, Collection<String> auis1, boolean includeIndirect) throws CodeMapperException {
    Set<String> auis = auis1.stream().collect(Collectors.toSet());
    if (auis.isEmpty()) {
      return new HashMap<>();
    }
    String query = "SELECT aui, ptra FROM mrhier WHERE sab = ? AND ptra && ?";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, sab);
      statement.setArray(2, connection.createArrayOf("VARCHAR", auis.toArray()));
      Map<String, Collection<String>> res = new HashMap<>();
      ResultSet set = statement.executeQuery();
      while (set.next()) {
        String aui = set.getString(1);
        String[] ptra = (String[]) set.getArray(2).getArray();
        for (int i = 0; i < ptra.length; i++) {
          String paui = ptra[i];
          if (!auis.contains(paui)) {
            continue;
          }
          res.computeIfAbsent(paui, key -> new HashSet<>()).add(aui);
        }
      }
      return res;
    } catch (SQLException e) {
      logger.debug("ERROR", e);
      throw CodeMapperException.server("Cannot execute query for decendant auis in mrhier", e);
    }
  }

  static Map<String, SourceConcept> getConcepts(DataSource connectionPool, Collection<String> auis)
      throws CodeMapperException {
    String query = "SELECT DISTINCT aui, code, str, ispref FROM mrconso WHERE aui = ANY(?)";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      Array array = connection.createArrayOf("VARCHAR", auis.toArray());
      statement.setArray(1, array);
      ResultSet set = statement.executeQuery();
      Map<String, SourceConcept> res = new HashMap<>();
      while (set.next()) {
        String aui = set.getString(1);
        String code = set.getString(2);
        String str = set.getString(3);
        boolean ispref = set.getString(4).equals("Y");
        if (!res.containsKey(aui) || ispref) {
          SourceConcept concept = new SourceConcept();
          concept.setId(code);
          concept.setPreferredTerm(str);
          res.put(aui, concept);
        }
      }
      return res;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for descendant concepts", e);
    }
  }

  public static void main(String[] args) throws SQLException, CodeMapperException {
    DataSource connectionPool =
        DataSources.unpooledDataSource(
            "jdbc:postgresql://127.0.0.1/umls2021aa", "codemapper", "codemapper");
    UmlsDescender descender = new UmlsDescender(connectionPool);
    Map<String, Collection<SourceConcept>> map =
        descender.getDescendants(Arrays.asList("U07"), "ICD10CM");
    for (Collection<SourceConcept> set : map.values()) {
      for (SourceConcept c : set) {
        System.out.println("- " + c);
      }
    }
  }
}
