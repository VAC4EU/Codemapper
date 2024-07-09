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
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import javax.sql.DataSource;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.descendants.DescendersApi.GeneralDescender;

public class UmlsFunctionDescender implements GeneralDescender {

  private DataSource connectionPool;

  public UmlsFunctionDescender(DataSource connectionPool) {
    this.connectionPool = connectionPool;
  }

  public Map<String, Collection<SourceConcept>> getDescendants(
      Collection<String> codes, String codingSystem) throws CodeMapperException {

    Map<String, Collection<SourceConcept>> result = new HashMap<>();

    // SQL function defined in src/main/resources/umls-functions.sql
    String query = "SELECT code0, code, str FROM descendant_codes(?, ?)";

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      Array array = connection.createArrayOf("VARCHAR", codes.toArray());

      int offset = 1;
      statement.setString(offset++, codingSystem);
      statement.setArray(offset++, array);

      ResultSet set = statement.executeQuery();
      while (set.next()) {
        String code0 = set.getString(1);
        String code = set.getString(2);
        String str = set.getString(3);

        SourceConcept concept = new SourceConcept();
        concept.setId(code);
        concept.setPreferredTerm(str);
        concept.setCodingSystem(codingSystem);

        if (!result.containsKey(code0)) {
          result.put(code0, new HashSet<SourceConcept>());
        }
        result.get(code0).add(concept);
      }
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for descendents", e);
    }
    return result;
  }

  public static void main(String[] args) throws SQLException, CodeMapperException {
    DataSource connectionPool =
        DataSources.unpooledDataSource(
            "jdbc:postgresql://127.0.0.1/umls2021aa", "codemapper", "codemapper");
    UmlsFunctionDescender descender = new UmlsFunctionDescender(connectionPool);
    Map<String, Collection<SourceConcept>> map =
        descender.getDescendants(Arrays.asList("U07"), "ICD10CM");
    for (Collection<SourceConcept> set : map.values()) {
      for (SourceConcept c : set) {
        System.out.println("- " + c);
      }
    }
  }
}
