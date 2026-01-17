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

import java.sql.Array;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Map;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.descendants.DescendantsApi.SpecificDescender;

public class UmlsTCDescender implements SpecificDescender {

  private final String codingSystem;
  private final Connection connection;
  private final UmlsDescender umlsDescender;

  public UmlsTCDescender(String codingSystem, Connection connection, UmlsDescender umlsDescender) {
    this.codingSystem = codingSystem;
    this.connection = connection;
    this.umlsDescender = umlsDescender;
  }

  @Override
  public String getCodingSystem() {
    return codingSystem;
  }

  @Override
  public Map<String, Collection<SourceConcept>> getDescendants(Collection<String> codes)
      throws CodeMapperException {
    try {
      // {code -> {aui}}
      Map<String, Collection<String>> auis = getAuis(codes);
      // {aui -> {aui}}
      Map<String, Collection<String>> subAuis =
          getDescendantAuis(UmlsDescender.concat(auis.values()));
      // {aui -> SourceConcept}
      Map<String, SourceConcept> sourceConcepts =
          umlsDescender.getConcepts(UmlsDescender.concat(subAuis.values()));
      // {code -> {SourceConcept}}
      Map<String, Collection<SourceConcept>> res = new HashMap<>();
      for (String code : codes) {
        Collection<SourceConcept> subConcepts = new LinkedList<>();
        for (String auiSup : auis.getOrDefault(code, Collections.emptySet())) {
          for (String auiSub : subAuis.getOrDefault(auiSup, Collections.emptySet())) {
            subConcepts.add(sourceConcepts.get(auiSub));
          }
        }
        res.put(code, subConcepts);
      }
      return res;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot collect UMLS TC descendents", e);
    }
  }

  private Map<String, Collection<String>> getAuis(Collection<String> codes) throws SQLException {
    String query = "SELECT code, aui FROM mrconso WHERE sab = ? AND code = ANY(?)";

    try (PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, codingSystem);
      Array codesArray = connection.createArrayOf("VARCHAR", codes.toArray());
      statement.setArray(2, codesArray);
      Map<String, Collection<String>> res = new HashMap<>();
      try (ResultSet resultSet = statement.executeQuery()) {
        while (resultSet.next()) {
          String code = resultSet.getString(1);
          String aui = resultSet.getString(2);
          if (!res.containsKey(code)) {
            res.put(code, new HashSet<>());
          }
          res.get(code).add(aui);
        }
      }
      return res;
    }
  }

  private Map<String, Collection<String>> getDescendantAuis(Collection<String> auis)
      throws SQLException {
    String query = "SELECT sup, sub FROM transitiveclosure WHERE sup = ANY(?)";
    try (PreparedStatement statement = connection.prepareStatement(query)) {
      Array codesArray = connection.createArrayOf("VARCHAR", auis.toArray());
      statement.setArray(1, codesArray);

      Map<String, Collection<String>> res = new HashMap<>();
      try (ResultSet resultSet = statement.executeQuery()) {
        while (resultSet.next()) {
          String sup = resultSet.getString(1);
          String sub = resultSet.getString(2);
          if (!res.containsKey(sup)) {
            res.put(sup, new HashSet<>());
          }
          res.get(sup).add(sub);
        }
      }
      return res;
    }
  }
}
