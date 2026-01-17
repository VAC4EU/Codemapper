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

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.Utils;
import org.biosemantics.codemapper.descendants.DescendantsApi.SpecificDescender;

public class SnomedTCDescender implements SpecificDescender {

  private static Logger logger = LogManager.getLogger(SnomedTCDescender.class);

  private final String codingSystem;
  private final Connection connection;

  public SnomedTCDescender(String codingSystem, Connection connection) {
    this.codingSystem = codingSystem;
    this.connection = connection;
  }

  @Override
  public String getCodingSystem() {
    return codingSystem;
  }

  @Override
  public Map<String, Collection<SourceConcept>> getDescendants(Collection<String> codes)
      throws CodeMapperException {
    String queryFmt =
        "SELECT DISTINCT c.supertypeid, c.subtypeid, n.preferredname "
            + "FROM transitiveclosure AS c "
            + "INNER JOIN conceptpreferredname AS n "
            + "ON c.subtypeid = n.conceptid "
            + "WHERE c.supertypeid IN (%s)";
    String query = String.format(queryFmt, Utils.sqlPlaceholders(codes.size()));

    try (PreparedStatement statement = connection.prepareStatement(query)) {
      int offset = 1;
      for (String code : codes) {
        statement.setObject(offset++, code, java.sql.Types.BIGINT);
      }
      Map<String, Collection<SourceConcept>> descendants = new HashMap<>();
      logger.debug(statement);
      try (ResultSet resultSet = statement.executeQuery()) {
        while (resultSet.next()) {
          String supertypeid = resultSet.getString(1);
          String subtypeid = resultSet.getString(2);
          String preferredName = resultSet.getString(3);

          SourceConcept concept = new SourceConcept();
          concept.setId(subtypeid);
          concept.setPreferredTerm(preferredName);
          concept.setCodingSystem(codingSystem);

          if (!descendants.containsKey(supertypeid)) {
            descendants.put(supertypeid, new HashSet<>());
          }
          descendants.get(supertypeid).add(concept);
        }
      }
      return descendants;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for SNOMED-CT descendents", e);
    }
  }
}
