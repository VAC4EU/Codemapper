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

package org.biosemantics.codemapper;

import com.opencsv.CSVReader;
import com.opencsv.CSVReaderBuilder;
import com.opencsv.exceptions.CsvValidationException;
import com.opencsv.processor.RowProcessor;
import java.io.IOException;
import java.io.Reader;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import javax.xml.bind.annotation.XmlRootElement;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.MappingData.Code;
import org.biosemantics.codemapper.MappingData.Concept;
import org.biosemantics.codemapper.MappingData.MappingMeta;
import org.biosemantics.codemapper.MappingData.Vocabulary;
import org.biosemantics.codemapper.rest.NonUmlsTargets;
import org.biosemantics.codemapper.rest.ServerInfo;
import org.biosemantics.codemapper.review.Message;
import org.biosemantics.codemapper.review.ReviewApi.AllTopics;
import org.biosemantics.codemapper.review.ReviewApi.Topics;
import org.biosemantics.codemapper.review.Topic;
import org.biosemantics.codemapper.review.Topic.Action;

/**
 * Database based implementation of the UMLS API used for the code mapper.
 *
 * <p>Two SQL indices in MRREL for CUI1 and CUI2 speed up the lookup of hypernyms/hyponyms: CREATE
 * INDEX MRREL_CUI1 ON MRREL (CUI1); CREATE INDEX MRREL_CUI2 ON MRREL (CUI2)
 *
 * @author benus
 */
public class UmlsApi {

  private static final String CUSTOM_NAME = "Unassociated custom codes";
  private static final String CUSTOM_DESCRIPTION =
      "Custom codes that were imported but have not been associated to a concept";
  private static final String CUSTOM_VERSION = "0";
  private static final String CUSTOM_CUI = "C0000000";

  private static Logger logger = LogManager.getLogger(UmlsApi.class);

  private DataSource connectionPool;
  private List<String> codingSystemsWithDefinition;
  private List<String> availableCodingSystems;
  private Set<String> ignoreTermTypes;
  private ServerInfo serverInfo;
  private NonUmlsTargets nonUmls;

  public UmlsApi(
      DataSource connectionPool,
      List<String> availableCodingSystems,
      List<String> codingSystemsWithDefinition,
      Set<String> ignoreTermTypes,
      ServerInfo serverInfo,
      NonUmlsTargets nonUmls) {
    this.connectionPool = connectionPool;
    this.availableCodingSystems = availableCodingSystems;
    this.codingSystemsWithDefinition = codingSystemsWithDefinition;
    this.ignoreTermTypes = ignoreTermTypes;
    this.serverInfo = serverInfo;
    this.nonUmls = nonUmls;
  }

  public Collection<CodingSystem> getCodingSystems() throws CodeMapperException {
    Collection<CodingSystem> res = nonUmls.getVocabularies();
    res.addAll(getUmlsCodingSystems());
    return res;
  }

  List<CodingSystem> getUmlsCodingSystems() throws CodeMapperException {
    List<CodingSystem> res = new LinkedList<>();
    String query = "SELECT DISTINCT rsab, son, sf, sver FROM MRSAB WHERE CURVER = 'Y'";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      ResultSet result = statement.executeQuery();
      while (result.next()) {
        int ix = 1;
        String rsab = result.getString(ix++);
        String name = result.getString(ix++);
        String family = result.getString(ix++);
        String version = result.getString(ix++);
        if (availableCodingSystems == null || availableCodingSystems.contains(rsab)) {
          CodingSystem codingSystem = new CodingSystem(rsab, name, family, version);
          res.add(codingSystem);
        }
      }
      return res;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for coding systems", e);
    }
  }

  public Map<String, String> getPreferredNames(Collection<String> cuis) throws CodeMapperException {

    if (cuis.isEmpty()) return new TreeMap<>();
    String queryFmt =
        "SELECT DISTINCT cui, str FROM MRCONSO "
            + "WHERE cui in (%s) "
            + "AND lat = 'ENG' "
            + "AND ispref = 'Y' "
            + "AND ts = 'P' "
            + "AND stt = 'PF'";
    String query = String.format(queryFmt, Utils.sqlPlaceholders(cuis.size()));

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {

      int offset = 1;
      for (Iterator<String> iter = cuis.iterator(); iter.hasNext(); offset++)
        statement.setString(offset, iter.next());

      ResultSet result = statement.executeQuery();

      Map<String, String> names = new TreeMap<>();
      while (result.next()) {
        String cui = result.getString(1);
        String name = result.getString(2);
        names.put(cui, name);
      }

      Set<String> missings = new TreeSet<>(cuis);
      missings.removeAll(names.keySet());
      for (String missing : missings) logger.warn("No preferred name found for CUI " + missing);
      return names;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for preferred names", e);
    }
  }

  public List<UmlsConcept> getCompletions(String q, List<String> codingSystems)
      throws CodeMapperException {
    if (q.length() < 3) throw CodeMapperException.user("Completions query too short");
    Collection<String> nonUmlsCuis = nonUmls.getTermCompletionsCuis(q, codingSystems);

    String query =
        ""
            + "SELECT DISTINCT cui, str "
            + "FROM mrconso "
            + "WHERE cui IN ? "
            + "AND ts = 'P' " // from preferred terms in MRCONSO ...
            + "AND stt = 'PF' "
            + "AND ispref = 'Y' "
            + "AND lat = 'ENG' "
            + "UNION"
            + "SELECT DISTINCT m1.cui, m1.str " // Get the distinct MRCONSO.str
            + "FROM mrconso AS m1 "
            + "INNER JOIN mrconso AS m2 "
            + "ON m1.cui = m2.cui "
            + "WHERE m1.ts = 'P' " // from preferred terms in MRCONSO ...
            + "AND m1.stt = 'PF' "
            + "AND m1.ispref = 'Y' "
            + "AND m1.lat = 'ENG' "
            + "AND m2.str LIKE ? " // that match the query string
            + (codingSystems != null && !codingSystems.isEmpty()
                ? String.format(
                    "AND m2.sab IN (%s) ", // that are in selected coding systems
                    Utils.sqlPlaceholders(codingSystems.size()))
                : "")
            + "LIMIT 100"
            + "";

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      int offset = 1;
      statement.setArray(offset++, connection.createArrayOf("char(8)", nonUmlsCuis.toArray()));
      statement.setString(offset++, q);
      statement.setString(offset++, q + "%");
      if (codingSystems != null && !codingSystems.isEmpty())
        for (Iterator<String> iter = codingSystems.iterator(); iter.hasNext(); offset++)
          statement.setString(offset, iter.next());
      ResultSet result = statement.executeQuery();
      List<UmlsConcept> completions = new LinkedList<>();
      while (result.next()) {
        String cui = result.getString(1);
        String str = result.getString(2);
        UmlsConcept concept = new UmlsConcept(cui, str);
        completions.add(concept);
      }
      return completions;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for completions", e);
    }
  }

  public Collection<UmlsConcept> getCodeCompletions(String str, String codingSystem)
      throws CodeMapperException {
    if (str == null || str.isEmpty()) return new LinkedList<>();
    Collection<UmlsConcept> res = new LinkedList<>();
    if (codingSystem == null || nonUmls.is(codingSystem)) {
      res.addAll(nonUmls.getCodeCompletions(str, codingSystem));
    }
    if (codingSystem == null || !nonUmls.is(codingSystem)) {
      res.addAll(getUmlsCodeCompletions(str, codingSystem));
    }
    return res;
  }

  List<UmlsConcept> getUmlsCodeCompletions(String str, String codingSystem)
      throws CodeMapperException {
    String query =
        "SELECT DISTINCT cui, sab, code, str "
            + "FROM mrconso WHERE "
            + "(cui = ? or (code LIKE ? AND sab like ?)) "
            + "AND lat = 'ENG' "
            + "ORDER BY code "
            + "LIMIT 20";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setString(1, str);
      statement.setString(2, str + "%");
      statement.setString(3, codingSystem == null ? "%" : codingSystem);
      ResultSet result = statement.executeQuery();
      Map<String, UmlsConcept> concepts = new TreeMap<>();
      while (result.next()) {
        String cui = result.getString(1);
        String sab = result.getString(2);
        String code = result.getString(3);
        String str1 = result.getString(4);
        String name;
        if (str.equals(cui)) name = String.format("CUI %s: %s", cui, str1);
        else name = String.format("%s in %s: %s", code, sab, str1);
        concepts
            .computeIfAbsent(cui, k -> new UmlsConcept(cui, name))
            .getSourceConcepts()
            .add(new SourceConcept(cui, sab, code));
      }
      List<UmlsConcept> res = new LinkedList<>(concepts.values());
      res.sort(Comparator.comparing(c -> c.toString()));
      return res;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for completions", e);
    }
  }

  private Map<String, List<String>> getSemanticTypes(Collection<String> cuis)
      throws CodeMapperException {
    if (cuis.isEmpty()) return new TreeMap<>();
    else {
      String queryFmt =
          "SELECT DISTINCT cui, tui " + "FROM MRSTY " + "WHERE cui IN (%s) " + "ORDER BY cui, tui";
      String query = String.format(queryFmt, Utils.sqlPlaceholders(cuis.size()));

      try (Connection connection = connectionPool.getConnection();
          PreparedStatement statement = connection.prepareStatement(query)) {

        int offset = 1;

        for (Iterator<String> iter = cuis.iterator(); iter.hasNext(); offset++)
          statement.setString(offset, iter.next());

        ResultSet result = statement.executeQuery();

        Map<String, List<String>> semanticTypes = new TreeMap<>();
        while (result.next()) {
          String cui = result.getString(1);
          String tui = result.getString(2);
          if (!semanticTypes.containsKey(cui)) semanticTypes.put(cui, new LinkedList<String>());
          semanticTypes.get(cui).add(tui);
        }
        return semanticTypes;
      } catch (SQLException e) {
        throw CodeMapperException.server("Cannot execute query for semantic types", e);
      }
    }
  }

  public Collection<String> getCuisByCodes(Collection<String> codes, String codingSystem)
      throws CodeMapperException {
    if (codes == null || codes.isEmpty()) return new LinkedList<>();
    if (nonUmls.is(codingSystem)) {
      Collection<String> cuis = new HashSet<>();
      nonUmls.getCuisForCodes(codingSystem, codes).values().forEach(cuis::addAll);
      return cuis;
    } else {
      String queryFmt = "SELECT DISTINCT cui FROM mrconso WHERE code IN (%s) and SAB = ?";
      String query = String.format(queryFmt, Utils.sqlPlaceholders(codes.size()));
      try (Connection connection = connectionPool.getConnection();
          PreparedStatement statement = connection.prepareStatement(query)) {
        int offset = 1;
        for (Iterator<String> iter = codes.iterator(); iter.hasNext(); offset++)
          statement.setString(offset, iter.next());
        statement.setString(offset++, codingSystem);
        ResultSet result = statement.executeQuery();
        Collection<String> cuis = new HashSet<>();
        while (result.next()) {
          String cui = result.getString(1);
          cuis.add(cui);
        }
        return cuis;
      } catch (SQLException e) {
        throw CodeMapperException.server("Cannot execute query for CUIs by codes", e);
      }
    }
  }

  public Map<String, List<SourceConcept>> getSourceConcepts(
      Collection<String> cuis, Collection<String> codingSystems, Collection<String> ignoreTermTypes)
      throws CodeMapperException {

    if (cuis.isEmpty() || codingSystems.isEmpty()) return new TreeMap<>();

    if (ignoreTermTypes == null || ignoreTermTypes.isEmpty()) {
      ignoreTermTypes = this.ignoreTermTypes;
    }

    Map<String, List<SourceConcept>> sourceConcepts =
        nonUmls.getSourceConcepts(cuis, codingSystems);

    String query =
        "SELECT DISTINCT cui, sab, code, str, tty "
            + "FROM MRCONSO "
            + "WHERE cui = ANY(?) "
            + "AND sab = ANY(?) "
            + "AND suppress != 'Y'"
            + "AND tty != ANY(?)"
            + "ORDER BY cui, sab, code, str";

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setArray(1, connection.createArrayOf("VARCHAR", cuis.toArray()));
      statement.setArray(2, connection.createArrayOf("VARCHAR", codingSystems.toArray()));
      statement.setArray(3, connection.createArrayOf("VARCHAR", ignoreTermTypes.toArray()));
      ResultSet result = statement.executeQuery();
      String lastCui = null, lastSab = null, lastCode = null;
      SourceConcept currentSourceConcept = null;
      while (result.next()) {
        String cui = result.getString(1);
        String sab = result.getString(2);
        String code = result.getString(3);
        String str = result.getString(4);
        String tty = result.getString(5);
        if (!cui.equals(lastCui) || !sab.equals(lastSab) || !code.equals(lastCode)) {
          currentSourceConcept = new SourceConcept();
          currentSourceConcept.setCui(cui);
          currentSourceConcept.setCodingSystem(sab);
          currentSourceConcept.setId(code);
          currentSourceConcept.setTty(tty);
          currentSourceConcept.setPreferredTerm(str);
          sourceConcepts
              .computeIfAbsent(cui, key -> new LinkedList<SourceConcept>())
              .add(currentSourceConcept);
        }
        if ("PT".equals(tty)) currentSourceConcept.setPreferredTerm(str);
        lastCui = cui;
        lastSab = sab;
        lastCode = code;
      }

      Set<String> missings = new TreeSet<>(cuis);
      missings.removeAll(sourceConcepts.keySet());
      for (String missing : missings) logger.warn("No UMLS concept found for CUI " + missing);
      return sourceConcepts;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for source concepts", e);
    }
  }

  /// returns {cui -> [aui]}
  private Map<String, Collection<String>> getCuiAuis(
      Collection<String> sabs, Collection<String> cuis) throws CodeMapperException {
    String query = "SELECT DISTINCT cui, aui FROM mrconso WHERE sab = ANY(?) AND cui = ANY(?)";

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setArray(1, connection.createArrayOf("VARCHAR", sabs.toArray()));
      statement.setArray(2, connection.createArrayOf("VARCHAR", cuis.toArray()));
      ResultSet set = statement.executeQuery();
      Map<String, Collection<String>> res = new HashMap<>();
      while (set.next()) {
        String cui = set.getString(1);
        String aui = set.getString(2);
        res.computeIfAbsent(cui, key -> new HashSet<>()).add(aui);
      }
      return res;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for cui auis", e);
    }
  }

  /// returns {cui -> [aui]}
  private Map<String, Collection<String>> getAuiCuis(Collection<String> auis)
      throws CodeMapperException {
    String query = "SELECT DISTINCT aui, cui FROM mrconso WHERE aui = ANY(?)";

    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setArray(1, connection.createArrayOf("VARCHAR", auis.toArray()));
      ResultSet set = statement.executeQuery();
      Map<String, Collection<String>> res = new HashMap<>();
      while (set.next()) {
        String aui = set.getString(1);
        String cui = set.getString(2);
        res.computeIfAbsent(aui, key -> new HashSet<>()).add(cui);
      }
      return res;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for cui auis", e);
    }
  }

  private Map<String, String> getParentAuis(Collection<String> auis) throws CodeMapperException {
    String query = "SELECT aui, paui FROM mrhier WHERE aui = ANY(?)";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setArray(1, connection.createArrayOf("VARCHAR", auis.toArray()));
      ResultSet set = statement.executeQuery();
      Map<String, String> res = new HashMap<>();
      while (set.next()) {
        String aui = set.getString(1);
        String paui = set.getString(2);
        res.put(aui, paui);
      }
      return res;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for parent auis", e);
    }
  }

  private Map<String, Collection<String>> getChildAuis(Collection<String> auis)
      throws CodeMapperException {
    String query = "SELECT aui, paui FROM mrhier WHERE paui = ANY(?)";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setArray(1, connection.createArrayOf("VARCHAR", auis.toArray()));
      ResultSet set = statement.executeQuery();
      Map<String, Collection<String>> res = new HashMap<>();
      while (set.next()) {
        String aui = set.getString(1);
        String paui = set.getString(2);
        res.computeIfAbsent(paui, key -> new HashSet<>()).add(aui);
      }
      return res;
    } catch (SQLException e) {
      throw CodeMapperException.server("Cannot execute query for child auis", e);
    }
  }

  public Collection<UmlsConcept> getBroader(List<String> cuis, List<String> sabs)
      throws CodeMapperException {
    Collection<String> auis =
        getCuiAuis(sabs, cuis).values().stream()
            .flatMap(Collection::stream)
            .collect(Collectors.toSet());
    Map<String, String> parentAuis = getParentAuis(auis);
    Collection<String> parentCuis =
        getAuiCuis(parentAuis.values()).values().stream()
            .flatMap(Collection::stream)
            .collect(Collectors.toSet());
    Map<String, UmlsConcept> concepts = getConcepts(parentCuis, sabs, null);
    return concepts.values();
  }

  public Collection<UmlsConcept> getNarrower(List<String> cuis, List<String> sabs)
      throws CodeMapperException {
    Collection<String> auis =
        getCuiAuis(sabs, cuis).values().stream()
            .flatMap(Collection::stream)
            .collect(Collectors.toSet());
    Collection<String> allChildAuis =
        getChildAuis(auis).values().stream()
            .flatMap(Collection::stream)
            .collect(Collectors.toSet());
    Collection<String> allChildCuis =
        getAuiCuis(allChildAuis).values().stream()
            .flatMap(Collection::stream)
            .collect(Collectors.toSet());
    Map<String, UmlsConcept> concepts = getConcepts(allChildCuis, sabs, null);
    return concepts.values();
  }

  /**
   * UMLS2014AB_CoMap> select rel, count(rel) as count from MRREL group by rel order by count desc;
   * +-----+---------+ | rel | count | +-----+---------+ | SIB | 5103112 | // SIBLING_CODING_SYSTEM
   * | RO | 4009440 | // | CHD | 1371883 | // MORE_SPECIFIC_CODING_SYSTEM | PAR | 1371883 | //
   * MORE_GENERAL_CODING_SYSTEM | SY | 1130820 | // SYNONYM_CODING_SYSTEM | RB | 859489 | //
   * MORE_GENERAL_UMLS | RN | 859489 | // MORE_SPECIFIC_UMLS | AQ | 609748 | // | QB | 609748 | // |
   * RQ | 254628 | // RELATED_POSSIBLY_SYNONYM_UMLS +-----+---------+
   *
   * @param cuis
   * @param codingSystems
   * @param relations
   * @return { cui: { rel: { cui1 for (cui, rel, cui1) in MRREL } for rel in relations } for cui in
   *     cuis }
   * @throws CodeMapperException
   */
  public Map<String, Map<String, List<UmlsConcept>>> getRelated_MRREL(
      List<String> cuis,
      List<String> codingSystems,
      List<String> relations,
      List<String> invRelations)
      throws CodeMapperException {
    if (cuis.isEmpty() || relations.isEmpty()) return new TreeMap<>();
    else {
      String queryFmt =
          ""
              + "WITH r1 AS ( "
              + "SELECT cui1, rel, cui2 "
              + "FROM mrrel "
              + "WHERE cui1 in (%s) "
              + "AND rel in (%s) "
              + "AND cui1 != cui2 "
              + "), r2 AS ( "
              + "SELECT cui2, rel, cui1 "
              + "FROM mrrel "
              + "WHERE cui2 in (%s) "
              + "AND rel in (%s) "
              + "AND cui1 != cui2 "
              + ") "
              + "SELECT DISTINCT * FROM r1 "
              + "UNION ALL "
              + "SELECT DISTINCT * FROM r2 ";
      String query =
          String.format(
              queryFmt,
              Utils.sqlPlaceholders(cuis.size()),
              Utils.sqlPlaceholders(relations.size()),
              Utils.sqlPlaceholders(cuis.size()),
              Utils.sqlPlaceholders(invRelations.size()));

      try (Connection connection = connectionPool.getConnection();
          PreparedStatement statement = connection.prepareStatement(query)) {
        int offset = 1;
        for (int ix = 0; ix < cuis.size(); ix++, offset++)
          statement.setString(offset, cuis.get(ix));
        for (int ix = 0; ix < relations.size(); ix++, offset++)
          statement.setString(offset, relations.get(ix));
        for (int ix = 0; ix < cuis.size(); ix++, offset++)
          statement.setString(offset, cuis.get(ix));
        for (int ix = 0; ix < invRelations.size(); ix++, offset++)
          statement.setString(offset, invRelations.get(ix));

        ResultSet sqlResults = statement.executeQuery();

        Map<String, Map<String, Set<String>>> related = new TreeMap<>();
        while (sqlResults.next()) {
          String cui1 = sqlResults.getString(1);
          String rel = sqlResults.getString(2);
          String cui2 = sqlResults.getString(3);
          if (!related.containsKey(cui1)) related.put(cui1, new HashMap<String, Set<String>>());
          if (!related.get(cui1).containsKey(rel))
            related.get(cui1).put(rel, new HashSet<String>());
          related.get(cui1).get(rel).add(cui2);
        }

        Set<String> relatedCuis = new TreeSet<>();
        for (Map<String, Set<String>> rels : related.values())
          for (Set<String> cs : rels.values()) relatedCuis.addAll(cs);

        Map<String, UmlsConcept> relatedConcepts = getConcepts(relatedCuis, codingSystems, null);

        Map<String, Map<String, List<UmlsConcept>>> result = new HashMap<>();
        for (String cui1 : related.keySet()) {
          result.put(cui1, new HashMap<String, List<UmlsConcept>>());
          for (String rel : related.get(cui1).keySet()) {
            result.get(cui1).put(rel, new LinkedList<UmlsConcept>());
            for (String cui2 : related.get(cui1).get(rel))
              result.get(cui1).get(rel).add(relatedConcepts.get(cui2));
          }
        }

        return result;
      } catch (SQLException e) {
        throw CodeMapperException.server("Cannot execute query for related concepts 2", e);
      }
    }
  }

  public Map<String, List<UmlsConcept>> getHyponymsOrHypernyms(
      List<String> cuis, List<String> codingSystems, boolean hyponymsNotHypernyms)
      throws CodeMapperException {

    if (cuis.isEmpty()) return new TreeMap<>();
    else {

      String queryFmt =
          "SELECT DISTINCT %s "
              + "FROM MRREL "
              + "WHERE rel in ('RN', 'CHD') "
              + "AND %s IN (%s) "
              + "AND cui1 != cui2 "
              + "AND (rela IS NULL OR rela = 'isa')";
      String selection = hyponymsNotHypernyms ? "cui1, cui2" : "cui2, cui1";
      String selector = hyponymsNotHypernyms ? "cui1" : "cui2";
      String query =
          String.format(queryFmt, selection, selector, Utils.sqlPlaceholders(cuis.size()));

      try (Connection connection = connectionPool.getConnection();
          PreparedStatement statement = connection.prepareStatement(query)) {

        int offset = 1;
        for (int ix = 0; ix < cuis.size(); ix++, offset++)
          statement.setString(offset, cuis.get(ix));

        ResultSet result = statement.executeQuery();

        Map<String, Set<String>> related = new TreeMap<>();
        while (result.next()) {
          String cui = result.getString(1);
          String relatedCui = result.getString(2);
          if (!related.containsKey(cui)) related.put(cui, new TreeSet<String>());
          related.get(cui).add(relatedCui);
        }

        Set<String> relatedCuis = new TreeSet<>();
        for (Collection<String> cs : related.values()) relatedCuis.addAll(cs);

        Map<String, UmlsConcept> relatedConcepts = getConcepts(relatedCuis, codingSystems, null);

        Map<String, List<UmlsConcept>> relatedByReference = new TreeMap<>();
        for (String cui : cuis) {
          List<UmlsConcept> concepts = new LinkedList<>();
          if (related.containsKey(cui))
            for (String relatedCui : related.get(cui))
              if (relatedConcepts.containsKey(relatedCui))
                concepts.add(relatedConcepts.get(relatedCui));
          relatedByReference.put(cui, concepts);
        }
        return relatedByReference;
      } catch (SQLException e) {
        throw CodeMapperException.server("Cannot execute query for related concepts", e);
      }
    }
  }

  private Map<String, String> getDefinitions(Collection<String> cuis) throws CodeMapperException {

    if (cuis.isEmpty()) return new TreeMap<>();
    else {

      String queryFmt = "SELECT DISTINCT cui, sab, def FROM MRDEF WHERE cui IN (%s)";
      String query = String.format(queryFmt, Utils.sqlPlaceholders(cuis.size()));

      try (Connection connection = connectionPool.getConnection();
          PreparedStatement statement = connection.prepareStatement(query)) {

        int offset = 1;
        for (Iterator<String> iter = cuis.iterator(); iter.hasNext(); offset++)
          statement.setString(offset, iter.next());

        ResultSet result = statement.executeQuery();

        Map<String, Map<String, String>> definitionsByVocabularies = new TreeMap<>();
        while (result.next()) {
          String cui = result.getString(1);
          String sab = result.getString(2);
          String def = result.getString(3);
          if (!definitionsByVocabularies.containsKey(cui))
            definitionsByVocabularies.put(cui, new TreeMap<String, String>());
          definitionsByVocabularies.get(cui).put(sab, def);
        }

        Map<String, String> definitions = new TreeMap<>();
        for (String cui : cuis)
          if (!definitionsByVocabularies.containsKey(cui)) definitions.put(cui, "");
          else
            for (String voc : codingSystemsWithDefinition)
              if (definitionsByVocabularies.get(cui).containsKey(voc)) {
                definitions.put(cui, definitionsByVocabularies.get(cui).get(voc));
                break;
              }

        return definitions;
      } catch (SQLException e) {
        e.printStackTrace();
        throw CodeMapperException.server("Cannot execute query for definitions", e);
      }
    }
  }
  //
  //  /** Get a mapping from the retired CUIs to their replacement CUIs */
  //  private Map<String, Collection<String>> getRetiredConcepts(Collection<String> cuis)
  //      throws CodeMapperException {
  //    String query = "SELECT cui1, cui2 FROM mrcui WHERE cui1 = ANY(?)";
  //    try (Connection connection = connectionPool.getConnection();
  //        PreparedStatement statement = connection.prepareStatement(query)) {
  //      statement.setArray(1, connection.createArrayOf("VARCHAR", cuis.toArray()));
  //      ResultSet set = statement.executeQuery();
  //      Map<String, Collection<String>> res = new HashMap<>();
  //      while (set.next()) {
  //        String cui1 = set.getString(1);
  //        String cui2 = set.getString(2);
  //        res.computeIfAbsent(cui1, key -> new HashSet<>()).add(cui2);
  //      }
  //      return res;
  //    } catch (SQLException e) {
  //      e.printStackTrace();
  //      throw CodeMapperException.server("Cannot execute query for retired concepts", e);
  //    }
  //  }
  //
  //  /**
  //   * Replace retired CUIs by all their replacement CUIs
  //   *
  //   * @param replacedCuis
  //   */
  //  private Collection<String> replaceRetired(
  //      Map<String, Collection<String>> retired,
  //      Collection<String> conceptIds,
  //      Map<String, List<String>> messagesByConcept) {
  //    Collection<String> res = new HashSet<>();
  //    for (String cui1 : conceptIds) {
  //      if (retired.containsKey(cui1)) {
  //        Collection<String> cuis2 = retired.get(cui1);
  //        res.addAll(cuis2);
  //        for (String cui2 : cuis2) {
  //          Collection<String> msgs =
  //              messagesByConcept.computeIfAbsent(cui2, key -> new LinkedList<>());
  //          msgs.add(String.format("replaced retired CUI %s", cui1));
  //        }
  //      } else {
  //        res.add(cui1);
  //      }
  //    }
  //    return res;
  //  }

  public Map<String, UmlsConcept> getConcepts(
      Collection<String> cuis, Collection<String> codingSystems, Collection<String> ignoreTermTypes)
      throws CodeMapperException {
    if (cuis.isEmpty()) return new TreeMap<>();
    else {

      cuis = new LinkedList<>(new TreeSet<>(cuis)); // unique CUIs

      Map<String, List<SourceConcept>> sourceConcepts =
          getSourceConcepts(cuis, codingSystems, ignoreTermTypes);
      Map<String, String> preferredNames = getPreferredNames(cuis);
      Map<String, String> definitions = getDefinitions(cuis);
      Map<String, List<String>> semanticTypes = getSemanticTypes(cuis);

      Map<String, UmlsConcept> concepts = new TreeMap<>();
      for (String cui : cuis) {
        List<SourceConcept> sourceConcepts2 = sourceConcepts.get(cui);
        List<String> semanticTypes2 = semanticTypes.get(cui);
        String definition = definitions.get(cui);
        String name = preferredNames.get(cui);
        if (sourceConcepts2 == null
            && semanticTypes2 == null
            && (definition == null || definition.isEmpty())
            && name == null) continue;
        UmlsConcept concept = new UmlsConcept();
        concept.setCui(cui);
        concept.setDefinition(definition);
        concept.setPreferredName(name);
        if (sourceConcepts2 != null) concept.setSourceConcepts(sourceConcepts2);
        if (semanticTypes2 != null) concept.setSemanticTypes(semanticTypes2);
        concepts.put(cui, concept);
      }
      return concepts;
    }
  }

  public ServerInfo getServerInfo() {
    return this.serverInfo;
  }

  @XmlRootElement
  public class ImportedMapping {
    Collection<String> warnings;
    MappingData mapping;
    AllTopics allTopics;

    ImportedMapping(MappingData mapping, AllTopics allTopics, Collection<String> warnings) {
      this.mapping = mapping;
      this.allTopics = allTopics;
      this.warnings = warnings;
    }
  }

  class CommentColumns {
    int author, date, content;
  }

  public ImportedMapping importCompatCSV(
      Reader csvContent,
      Collection<String> commentColumns,
      Collection<String> ignoreTermTypes,
      String filterSystem,
      String filterEventAbbreviation,
      String filterType)
      throws CodeMapperException {
    String importAuthor = "Codelist import";
    String deduplicationAuthor =
        "SharePoint import"; // to detect comments generated by SharePoint deduplication
    String importDate =
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").format(LocalDateTime.now());
    CSVReader reader =
        new CSVReaderBuilder(csvContent)
            .withRowProcessor(
                new RowProcessor() {
                  @Override
                  public String processColumnItem(String column) {
                    return column.trim();
                  }

                  @Override
                  public void processRow(String[] row) {
                    for (int i = 0; i < row.length; i++) {
                      row[i] = row[i].trim();
                    }
                  }
                })
            .build();
    try {
      // read CSV header
      List<String> header = Arrays.asList(reader.readNext());
      int conceptIx = header.indexOf("concept");
      int vocIdIx = header.indexOf("coding_system");
      int codeIx = header.indexOf("code");
      int codeNameIx = header.indexOf("code_name");
      int tagIx = header.indexOf("tags");
      int systemIx = header.indexOf("system");
      int eventAbbreviationIx = header.indexOf("event_abbreviation");
      int typeIx = header.indexOf("type");

      if (conceptIx == -1) {
        throw CodeMapperException.user("Missing column \"concept\"");
      }
      if (vocIdIx == -1) {
        throw CodeMapperException.user("Missing column \"coding_system\"");
      }
      if (codeIx == -1) {
        throw CodeMapperException.user("Missing column \"code\"");
      }
      if (codeNameIx == -1) {
        throw CodeMapperException.user("Missing column \"code_name\"");
      }
      if (tagIx == -1) {
        throw CodeMapperException.user("Missing column \"tags\"");
      }

      List<CommentColumns> commentColumnsList = new LinkedList<>();

      // search for review{i}_{author,timestamp,content} as default if no comment columns are
      // provided
      if (commentColumns.stream().allMatch(s -> s.isBlank())) {
        for (int ix = 1; ; ix++) {
          String authorCol = "review" + ix + "_author";
          String dateCol = "review" + ix + "_timestamp";
          String contentCol = "review" + ix + "_content";
          CommentColumns cc = new CommentColumns();
          cc.author = header.indexOf(authorCol);
          cc.date = header.indexOf(dateCol);
          cc.content = header.indexOf(contentCol);
          if (cc.author == -1 || cc.date == -1 || cc.content == -1) break;
          logger.debug(
              "No comments specified, found author:"
                  + cc.author
                  + ", date: "
                  + cc.date
                  + ", content: "
                  + cc.content);
          commentColumnsList.add(cc);
        }
      } else {
        for (String cols0 : commentColumns) {
          if (cols0.isBlank()) continue;
          String[] cols = cols0.split(",|\\t");
          if (cols.length != 3) {
            throw CodeMapperException.user(
                "Comment columns must be three column names separated by commas or tabs");
          }
          CommentColumns cc = new CommentColumns();
          cc.author = header.indexOf(cols[0]);
          cc.date = header.indexOf(cols[1]);
          cc.content = header.indexOf(cols[2]);
          if (cc.author == -1 || cc.content == -1 || cc.date == -1) {
            throw CodeMapperException.user(String.format("Invalid comment columns %s", cols0));
          }
          commentColumnsList.add(cc);
        }
      }

      int messageIx = 0, maxIx = 0;
      for (int ix :
          Arrays.asList(
              conceptIx, vocIdIx, codeIx, codeNameIx, eventAbbreviationIx, systemIx, typeIx)) {
        maxIx = Math.max(maxIx, ix);
      }
      for (CommentColumns cc : commentColumnsList) {
        maxIx = Math.max(maxIx, Math.max(cc.author, Math.max(cc.content, cc.date)));
      }

      Map<String, Map<String, List<String>>> messagesByCode =
          new HashMap<>(); // vocId -> codeId -> messages
      Map<String, List<String>> messagesByConcept = new HashMap<>(); // cui -> messages
      Collection<String> warnings = new LinkedList<>();

      // read CSV data
      Set<String> conceptIds = new HashSet<>();
      Set<String> vocIds = new HashSet<>();
      Map<String, Set<String>> codeIds = new HashMap<>(); // vocId -> set(codeId)
      Map<String, Map<String, Set<String>>> codeConcepts =
          new HashMap<>(); // vocId -> codeId -> conceptId
      Map<String, Map<String, String>> codeNames = new HashMap<>(); // vocId -> codeId -> names
      Map<String, Map<String, Set<String>>> codeTags = new HashMap<>(); // vocId -> codeId -> tags
      Map<String, Map<String, Set<String>>> deduplicationMessagesByCode = new HashMap<>();
      Map<String, Map<String, List<Message>>> importedMessagesByCode = new HashMap<>();

      boolean hasFiltersAndFilterRows =
          eventAbbreviationIx != 1
              && systemIx != 1
              && typeIx != -1
              && filterEventAbbreviation != null
              && !filterEventAbbreviation.isEmpty()
              && filterType != null
              && !filterType.isEmpty()
              && filterSystem != null
              && !filterSystem.isEmpty();

      int rowIx = 1;
      for (String[] row = reader.readNext(); row != null; rowIx++, row = reader.readNext()) {
        if (row.length < maxIx) {
          String msg =
              String.format("row %d: expected at least %d cells, got %d", rowIx, maxIx, row.length);
          throw CodeMapperException.user(msg);
        }
        String conceptId = row[conceptIx];
        String vocId = row[vocIdIx];
        String codeId = row[codeIx];
        String codeName = row[codeNameIx];
        String tag = row[tagIx];
        if (hasFiltersAndFilterRows) {
          String eventAbbr = row[eventAbbreviationIx];
          String system = row[systemIx];
          String type = row[typeIx];
          if (!((eventAbbr.isEmpty()
              || eventAbbr.equals(filterEventAbbreviation)
                  && (system.isEmpty()
                      || system.equals(filterSystem)
                          && (type.isEmpty() || type.equals(filterType)))))) {
            logger.debug("Ignore code that does not match the mapping: " + String.join(",", row));
            continue;
          }
        }
        if (vocId.isEmpty()) {
          String msg = String.format("row %d: missing coding system", rowIx);
          throw CodeMapperException.user(msg);
        }
        vocIds.add(vocId);
        if (codeId.isEmpty()) {
          String msg = String.format("row %d: missing code", rowIx);
          throw CodeMapperException.user(msg);
        }
        codeIds.computeIfAbsent(vocId, k -> new HashSet<>()).add(codeId);
        if (!codeName.isEmpty()) {
          codeNames.computeIfAbsent(vocId, k -> new HashMap<>()).put(codeId, codeName);
        }
        if (!tag.isEmpty()) {
          codeTags
              .computeIfAbsent(vocId, k -> new HashMap<>())
              .computeIfAbsent(codeId, k -> new HashSet<>())
              .add(tag);
        }
        if (!conceptId.isEmpty()) {
          conceptIds.add(conceptId);
          codeConcepts
              .computeIfAbsent(vocId, k -> new HashMap<>())
              .computeIfAbsent(codeId, k -> new HashSet<>())
              .add(conceptId);
        }
        for (CommentColumns cc : commentColumnsList) {
          String content = row[cc.content];
          String author = row[cc.author];
          String date = row[cc.date];
          if (author.isEmpty() && date.isEmpty() && content.isEmpty()) {
            continue;
          }
          if (author.equals(deduplicationAuthor)) {
            deduplicationMessagesByCode
                .computeIfAbsent(vocId, key -> new HashMap<>())
                .computeIfAbsent(codeId, key -> new HashSet<>())
                .add(content);
          } else {
            if (!date.isEmpty()) date = String.format(" on %s", date);
            String messageContent = String.format("%s%s: %s", author, date, content);
            importedMessagesByCode
                .computeIfAbsent(vocId, key -> new HashMap<>())
                .computeIfAbsent(codeId, key -> new LinkedList<>())
                .add(new Message(messageIx++, importAuthor, importDate, messageContent, true));
          }
        }
      }

      // All coding systems
      Map<String, CodingSystem> codingSystems = new HashMap<>();
      for (CodingSystem codingSystem : getCodingSystems()) {
        codingSystems.put(codingSystem.getAbbreviation(), codingSystem);
      }

      // Vocabularies found in CSV file
      Map<String, Vocabulary> vocabularies = new HashMap<>();
      for (String vocId : vocIds) {
        CodingSystem codingSystem = codingSystems.get(vocId);
        Vocabulary voc;
        if (codingSystem != null) {
          voc =
              new Vocabulary(
                  codingSystem.getAbbreviation(),
                  codingSystem.getName(),
                  codingSystem.getVersion(),
                  false);
        } else {
          voc = new Vocabulary(vocId, vocId, CUSTOM_VERSION, true);
        }
        vocabularies.put(vocId, voc);
      }

      MappingMeta meta =
          new MappingMeta(
              1,
              serverInfo.getUmlsVersion(),
              serverInfo.getDefaultAllowedTags().toArray(new String[] {}),
              new String[] {},
              serverInfo.getDefaultIgnoreSemanticTypes().toArray(new String[] {}),
              false);

      Collection<String> allCodeConceptIds = new HashSet<>();
      for (String vocId : codeIds.keySet()) {
        Collection<String> codeConceptIds = getCuisByCodes(codeIds.get(vocId), vocId);
        allCodeConceptIds.addAll(codeConceptIds);
      }
      Map<String, UmlsConcept> umlsCodeConcepts =
          getConcepts(allCodeConceptIds, vocIds, ignoreTermTypes);

      // mapping from concepts derived from codes
      MappingData mapping = MappingData.fromUmlsConcepts(umlsCodeConcepts, vocabularies, meta);

      // concept ids for codes
      Map<String, Map<String, Set<String>>> codeCodeConceptsIds = mapping.getCodeConceptIds();

      Map<String, UmlsConcept> umlsConcepts = getConcepts(conceptIds, vocIds, ignoreTermTypes);

      // mapping from concepts in concepts column
      MappingData conceptsMapping = MappingData.fromUmlsConcepts(umlsConcepts, vocabularies, null);

      Concept customConcept =
          new Concept(CUSTOM_CUI, CUSTOM_NAME, CUSTOM_DESCRIPTION, new HashMap<>());

      // assign codes to concepts
      Set<String> additionalConceptIds = new HashSet<>();
      Map<String, Map<String, Concept>> selectedCodeConcepts = // voc -> code -> cui
          new HashMap<>();
      for (String vocId : codeIds.keySet()) {
        Map<String, Concept> selectedConcepts = new HashMap<>();
        for (String codeId : codeIds.get(vocId)) {
          Collection<String> messages =
              messagesByCode
                  .computeIfAbsent(vocId, key -> new HashMap<>())
                  .computeIfAbsent(codeId, key -> new LinkedList<>());
          Iterator<String> codeConceptIds =
              codeCodeConceptsIds
                  .getOrDefault(vocId, new HashMap<>())
                  .getOrDefault(codeId, new HashSet<>())
                  .iterator();
          Set<String> conceptIds1 =
              codeConcepts
                  .getOrDefault(vocId, new HashMap<>())
                  .getOrDefault(codeId, new HashSet<>());
          Concept concept;
          if (codeConceptIds.hasNext()) {
            // codes associated to a concept by mapping
            String cui = codeConceptIds.next();
            concept = mapping.concepts.get(cui);
          } else {
            // assign the concept from the concepts column
            String conceptId1 = conceptIds1.stream().findFirst().orElse(null);
            Concept concept1 = conceptsMapping.concepts.get(conceptId1);
            if (conceptId1 != null && concept1 != null) {
              concept = concept1;
              // ensure that all codes from the concept are in the mapping
              for (String vocId1 : concept.codes.keySet()) {
                for (String codeId1 : concept.codes.get(vocId1)) {
                  mapping
                      .codes
                      .get(vocId1)
                      .computeIfAbsent(
                          codeId1, key -> conceptsMapping.codes.get(vocId1).get(codeId1));
                }
              }
            } else {
              concept = customConcept;
            }
            mapping.concepts.computeIfAbsent(concept.getId(), key -> concept);
          }
          selectedConcepts.put(codeId, concept);

          // check if selected concept matches concept from input
          if (!conceptIds1.isEmpty() && !conceptIds1.contains(concept.getId())) {
            String message =
                String.format(
                    "changed concept from %s to %s",
                    String.join(", ", conceptIds1), concept.getId());
            messages.add(message);
          }
        }
        selectedCodeConcepts.put(vocId, selectedConcepts);
      }

      // add custom codes to mapping
      for (String vocId : codeIds.keySet()) {
        for (String codeId : codeIds.get(vocId)) {
          Concept concept = selectedCodeConcepts.get(vocId).get(codeId);
          Map<String, Code> mappingCodes =
              mapping.codes.computeIfAbsent(vocId, k -> new HashMap<>());
          boolean customCode = !mappingCodes.containsKey(codeId);
          if (customCode) {
            // create custom code
            String codeName =
                codeNames
                    .getOrDefault(vocId, new HashMap<>())
                    .getOrDefault(codeId, "(missing name)");
            mappingCodes.put(codeId, new Code(codeId, codeName, true, true, null));
            // add custom code to concepts
            mapping
                .concepts
                .get(concept.getId())
                .codes
                .computeIfAbsent(vocId, k -> new HashSet<>())
                .add(codeId);
          }
        }
      }

      // disable codes
      for (String vocId : mapping.codes.keySet()) {
        for (String codeId : mapping.codes.get(vocId).keySet()) {
          Set<String> codeIds1 = codeIds.get(vocId);
          boolean enabled = codeIds1.contains(codeId);
          mapping.setCodeEnabled(vocId, codeId, enabled);
        }
      }

      // add tags
      for (String vocId : codeTags.keySet()) {
        for (String codeId : codeTags.get(vocId).keySet()) {
          Set<String> tags = codeTags.get(vocId).get(codeId);
          String tag;
          switch (tags.size()) {
            case 0:
              continue;
            case 1:
              tag = tags.iterator().next();
              break;
            default:
              tag = "multiple:" + String.join("+", tags);
              break;
          }
          mapping.codes.get(vocId).get(codeId).tag = tag;
        }
      }

      if (mapping.concepts.containsKey(CUSTOM_CUI)) {
        int numCodes =
            mapping.concepts.get(CUSTOM_CUI).codes.values().stream()
                .mapToInt((v) -> v.size())
                .sum();
        warnings.add(
            String.format(
                "%d codes with invalid concept were associated to a custom concept called %s",
                numCodes, CUSTOM_NAME));
      }

      // Compile topics
      AllTopics allTopics = new AllTopics();
      int topicIx = 0;

      // Create a topic per concept
      for (String cui : messagesByConcept.keySet()) {
        List<String> messages = messagesByConcept.get(cui);
        if (messages.isEmpty()) continue;
        Action created = new Action(importAuthor, importDate);
        Topic topic = new Topic(topicIx++, "Codelist import", created, null);
        for (String content : messages) {
          Message msg = new Message(messageIx++, importAuthor, importDate, content, true);
          topic.messages.add(msg);
        }
        allTopics.byConcept.computeIfAbsent(cui, k -> new Topics()).put(topic.id, topic);
      }

      // Create a topic with imported messages
      for (String vocId : importedMessagesByCode.keySet()) {
        Map<String, List<Message>> forVocId = importedMessagesByCode.get(vocId);
        for (String codeId : forVocId.keySet()) {
          List<Message> messages = forVocId.get(codeId);
          if (messages.isEmpty()) continue;
          Action created = new Action(importAuthor, importDate);
          Topic topic = new Topic(topicIx++, "Imported review", created, null);
          topic.messages.addAll(messages);
          allTopics
              .byCode
              .computeIfAbsent(vocId, key -> new HashMap<>())
              .computeIfAbsent(codeId, key -> new Topics())
              .put(topic.id, topic);
        }
      }

      // Create a topic with deduplication messages
      for (String vocId : deduplicationMessagesByCode.keySet()) {
        Map<String, Set<String>> forVocId = deduplicationMessagesByCode.get(vocId);
        for (String codeId : forVocId.keySet()) {
          Set<String> messages = forVocId.get(codeId);
          if (messages.isEmpty()) continue;
          Action action = new Action(importAuthor, importDate);
          Topic topic = new Topic(topicIx++, "SharePoint import", action, action);
          for (String message : messages) {
            topic.messages.add(new Message(messageIx++, importAuthor, importDate, message, true));
          }
          allTopics
              .byCode
              .computeIfAbsent(vocId, key -> new HashMap<>())
              .computeIfAbsent(codeId, key -> new Topics())
              .put(topic.id, topic);
        }
      }

      // Add the messages from the codelist import
      for (String vocId : messagesByCode.keySet()) {
        Map<String, List<String>> forVocId = messagesByCode.get(vocId);
        for (String codeId : forVocId.keySet()) {
          List<String> messages = forVocId.get(codeId);
          if (messages.isEmpty()) continue;
          Topics topics =
              allTopics
                  .byCode
                  .computeIfAbsent(vocId, key -> new HashMap<>())
                  .computeIfAbsent(codeId, key -> new Topics());
          Topic topic = topics.values().stream().findFirst().orElse(null);
          if (topic == null) {
            Action action = new Action(importAuthor, importDate);
            topic = new Topic(topicIx++, "Codelist import", action, action);
            topics.put(topic.id, topic);
          }
          for (String message : messages) {
            topic.messages.add(new Message(messageIx++, importAuthor, importDate, message, false));
          }
        }
      }

      return new ImportedMapping(mapping, allTopics, warnings);
    } catch (CsvValidationException | IOException e) {
      throw CodeMapperException.user("cannot parse CSV file", e);
    }
  }
}
