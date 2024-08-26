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
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import javax.xml.bind.annotation.XmlRootElement;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.MappingData.Code;
import org.biosemantics.codemapper.MappingData.Concept;
import org.biosemantics.codemapper.MappingData.Vocabulary;
import org.biosemantics.codemapper.rest.NonUmlsTargets;
import org.biosemantics.codemapper.rest.VersionInfo;
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
  private VersionInfo versionInfo;
  private NonUmlsTargets nonUmls;

  public UmlsApi(
      DataSource connectionPool,
      List<String> availableCodingSystems,
      List<String> codingSystemsWithDefinition,
      Set<String> ignoreTermTypes,
      VersionInfo versionInfo,
      NonUmlsTargets nonUmls) {
    this.connectionPool = connectionPool;
    this.availableCodingSystems = availableCodingSystems;
    this.codingSystemsWithDefinition = codingSystemsWithDefinition;
    this.ignoreTermTypes = ignoreTermTypes;
    this.versionInfo = versionInfo;
    this.nonUmls = nonUmls;
  }

  public List<CodingSystem> getCodingSystems() throws CodeMapperException {
    List<CodingSystem> res = nonUmls.getVocabularies();
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
        System.out.println("SOURCE CONCEPT: " + name);
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

  public Collection<String> getCuisByCodes(List<String> codes, String codingSystem)
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

  private Map<String, Collection<String>> getRetiredConcepts(Collection<String> cuis)
      throws CodeMapperException {
    String query = "SELECT cui1, cui2 FROM mrcui WHERE cui1 = ANY(?)";
    try (Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query)) {
      statement.setArray(1, connection.createArrayOf("VARCHAR", cuis.toArray()));
      System.out.println(statement);
      ResultSet set = statement.executeQuery();
      Map<String, Collection<String>> res = new HashMap<>();
      while (set.next()) {
        String cui1 = set.getString(1);
        String cui2 = set.getString(2);
        res.computeIfAbsent(cui1, key -> new HashSet<>()).add(cui2);
      }
      return res;
    } catch (SQLException e) {
      e.printStackTrace();
      throw CodeMapperException.server("Cannot execute query for retired concepts", e);
    }
  }

  private Collection<String> replaceRetired(
      Map<String, Collection<String>> retired, Collection<String> conceptIds) {
    Collection<String> res = new HashSet<>();
    for (String cui : conceptIds) {
      if (retired.containsKey(cui)) {
        res.addAll(retired.get(cui));
      } else {
        res.add(cui);
      }
    }
    return res;
  }

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
        UmlsConcept concept = new UmlsConcept();
        concept.setCui(cui);
        concept.setDefinition(definitions.get(cui));
        concept.setPreferredName(preferredNames.get(cui));
        if (sourceConcepts.containsKey(cui)) concept.setSourceConcepts(sourceConcepts.get(cui));
        if (semanticTypes.containsKey(cui)) concept.setSemanticTypes(semanticTypes.get(cui));
        concepts.put(cui, concept);
      }
      return concepts;
    }
  }

  public VersionInfo getVersionInfo() {
    return this.versionInfo;
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

  public ImportedMapping importCSV(Reader csvContent, Collection<String> commentColumns)
      throws CodeMapperException {
    Map<String, Collection<String>> warnNoConcept = new HashMap<>();
    Map<String, Collection<String>> warnWrongConcept = new HashMap<>();
    final AtomicInteger topicIx = new AtomicInteger(0);
    int messageIx = 0;
    CSVReader reader = new CSVReaderBuilder(csvContent).build();
    try {
      // read CSV header
      List<String> header = Arrays.asList(reader.readNext());
      int conceptIx = header.indexOf("concept");
      int vocIdIx = header.indexOf("coding_system");
      int codeIx = header.indexOf("code");
      int codeNameIx = header.indexOf("term");
      int tagIx = header.indexOf("tag");

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
        throw CodeMapperException.user("Missing column \"term\"");
      }
      if (tagIx == -1) {
        throw CodeMapperException.user("Missing column \"tag\"");
      }

      List<CommentColumns> commentColumnIxs = new LinkedList<>();
      for (String cols0 : commentColumns) {
        if (cols0.isBlank()) {
          continue;
        }
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
        commentColumnIxs.add(cc);
      }
      int maxIx = 0;
      for (int ix : Arrays.asList(conceptIx, vocIdIx, codeIx, codeNameIx)) {
        maxIx = Math.max(maxIx, ix);
      }
      for (CommentColumns cc : commentColumnIxs) {
        maxIx = Math.max(maxIx, Math.max(cc.author, Math.max(cc.content, cc.date)));
      }
      if (commentColumns.stream().allMatch(s -> s.isBlank())) {
        for (int ix = 0; ; ix++) {
          // review_author_0,review_date_0,review_content_0
          String authorCol = "review_author_" + ix;
          String dateCol = "review_date_" + ix;
          String contentCol = "review_content_" + ix;
          CommentColumns cc = new CommentColumns();
          cc.author = header.indexOf(authorCol);
          cc.date = header.indexOf(dateCol);
          cc.content = header.indexOf(contentCol);
          if (cc.author != -1 && cc.date != -1 && cc.content != -1) {
            logger.debug(
                "No comments specified, found author:"
                    + cc.author
                    + ", date: "
                    + cc.date
                    + ", content: "
                    + cc.content);
            commentColumnIxs.add(cc);
          } else {
            break;
          }
        }
      }

      // read CSV data
      Set<String> conceptIds = new HashSet<>();
      Set<String> vocIds = new HashSet<>();
      Map<String, Set<String>> codeIds = new HashMap<>(); // vocId -> set(codeId)
      Map<String, Map<String, Set<String>>> codeConcepts =
          new HashMap<>(); // vocId -> codeId -> conceptId
      Map<String, Map<String, String>> codeNames = new HashMap<>(); // vocId -> codeId -> names
      Map<String, Map<String, String>> codeTags = new HashMap<>(); // vocId -> codeId -> tags
      Map<String, Map<String, Topic>> topicByCode = new HashMap<>(); // vocId -> codeId -> topic
      Map<String, List<String>> messagesByConcept = new HashMap<>();
      String importAuthor = "SharePoint import";

      int rowIx = 1;
      for (String[] row = reader.readNext(); row != null; rowIx++, row = reader.readNext()) {
        if (row.length < maxIx) {
          throw CodeMapperException.user("row " + rowIx + " too short");
        }
        String conceptId = row[conceptIx];
        String vocId = row[vocIdIx];
        String codeId = row[codeIx];
        String codeName = row[codeNameIx];
        String tag = row[tagIx];
        if (vocId.isEmpty()) {
          throw CodeMapperException.user("no coding system in row " + rowIx);
        } else {
          vocIds.add(vocId);
        }
        if (codeId.isEmpty()) {
          throw CodeMapperException.user("no code in row " + rowIx);
        } else {
          codeIds.computeIfAbsent(vocId, k -> new HashSet<>()).add(codeId);
        }
        if (!codeName.isEmpty()) {
          codeNames.computeIfAbsent(vocId, k -> new HashMap<>()).put(codeId, codeName);
        }
        if (!tag.isEmpty()) {
          codeTags.computeIfAbsent(vocId, k -> new HashMap<>()).put(codeId, tag);
        }
        if (!conceptId.isEmpty()) {
          conceptIds.add(conceptId);
          codeConcepts
              .computeIfAbsent(vocId, k -> new HashMap<>())
              .computeIfAbsent(codeId, k -> new HashSet<>())
              .add(conceptId);
        }
        for (CommentColumns cc : commentColumnIxs) {
          String content = row[cc.content];
          String author = row[cc.author];
          String date = row[cc.date];
          if (author.trim().isEmpty() && date.trim().isEmpty() && content.trim().isEmpty()) {
            continue;
          }
          Message msg = new Message(messageIx++, author, date, content, true);
          Topic topic =
              topicByCode
                  .computeIfAbsent(vocId, key -> new HashMap<>())
                  .computeIfAbsent(
                      codeId,
                      key -> {
                        Action created = new Action(importAuthor, date);
                        return new Topic(
                            topicIx.getAndIncrement(), "Imported comments", created, null);
                      });
          topic.messages.add(msg);
        }
      }

      Map<String, Collection<String>> retired = getRetiredConcepts(conceptIds);
      Collection<String> conceptIds1 = replaceRetired(retired, conceptIds);

      // retrieve UMLS data
      Map<String, UmlsConcept> umlsConcepts = getConcepts(conceptIds1, vocIds, null);
      Map<String, CodingSystem> codingSystems = new HashMap<>();
      for (CodingSystem codingSystem : getCodingSystems()) {
        codingSystems.put(codingSystem.getAbbreviation(), codingSystem);
      }

      // convert to MappingData
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
      MappingData mapping =
          MappingData.fromUmlsConcepts(umlsConcepts, vocabularies, versionInfo.getUmlsVersion());

      // disable codes
      for (String vocId : mapping.codes.keySet()) {
        for (String codeId : mapping.codes.get(vocId).keySet()) {
          assert codeIds.get(vocId) != null;
          boolean enabled = codeIds.get(vocId).contains(codeId);
          mapping.setCodeEnabled(vocId, codeId, enabled);
        }
      }

      Concept customConcept =
          new Concept(CUSTOM_CUI, CUSTOM_NAME, CUSTOM_DESCRIPTION, new HashMap<>(), null);

      // add custom vocabularies and custom codes
      for (String vocId : codeIds.keySet()) {
        for (String codeId : codeIds.get(vocId)) {
          boolean customCode =
              !mapping.codes.getOrDefault(vocId, new HashMap<>()).containsKey(codeId);
          Collection<String> conceptIds2 =
              codeConcepts.getOrDefault(vocId, new HashMap<>()).get(codeId);
          Collection<String> conceptIds3 =
              conceptIds2 == null ? null : replaceRetired(retired, conceptIds2);
          if (customCode) {
            // create custom code
            String codeName =
                codeNames
                    .getOrDefault(vocId, new HashMap<>())
                    .getOrDefault(codeId, "(missing name)");
            Code code = new Code(codeId, codeName, true, true, null);
            mapping.codes.computeIfAbsent(vocId, k -> new HashMap<>()).put(codeId, code);
            // add custom code to concepts
            if (conceptIds3 == null) {
              mapping
                  .concepts
                  .computeIfAbsent(CUSTOM_CUI, k -> customConcept)
                  .codes
                  .computeIfAbsent(vocId, k -> new HashSet<>())
                  .add(codeId);
            } else {
              for (String conceptId : conceptIds3) {
                Concept concept = mapping.concepts.get(conceptId);
                if (concept == null) {
                  throw CodeMapperException.user(
                      "Unknown concept "
                          + conceptId
                          + " for code "
                          + codeId
                          + " in coding system "
                          + vocId);
                }
                concept.codes.computeIfAbsent(vocId, k -> new HashSet<>()).add(codeId);
              }
            }
          } else {
            // check code validity
            if (conceptIds3 == null) {
              warnNoConcept.computeIfAbsent(vocId, (key) -> new HashSet<>()).add(codeId);
            } else {
              for (String conceptId : conceptIds3) {
                Concept concept = mapping.concepts.get(conceptId);
                assert concept != null;
                boolean hasCode =
                    concept.codes.getOrDefault(vocId, new HashSet<>()).contains(codeId);
                if (!hasCode) {
                  warnWrongConcept.computeIfAbsent(vocId, (key) -> new HashSet<>()).add(codeId);
                }
              }
            }
          }
        }
      }

      // add tags
      for (String vocId : codeTags.keySet()) {
        for (String codeId : codeTags.get(vocId).keySet()) {
          String tag = codeTags.get(vocId).get(codeId).trim();
          if (tag.isEmpty()) {
            continue;
          }
          mapping.codes.get(vocId).get(codeId).tag = tag;
        }
      }

      // move tags from codes to concepts where possible
      for (Concept concept : mapping.concepts.values()) {
        List<Code> codes =
            concept.codes.entrySet().stream()
                .flatMap(
                    (e) -> e.getValue().stream().map((id) -> mapping.codes.get(e.getKey()).get(id)))
                .filter((code) -> code != null)
                .collect(Collectors.toList());
        Set<String> tags =
            codes.stream()
                .map((code) -> code.tag)
                .filter((tag) -> tag != null)
                .filter(
                    (tag) ->
                        codes.stream().allMatch((code) -> !code.enabled || tag.equals(code.tag)))
                .collect(Collectors.toSet());
        if (tags.size() == 1) {
          String tag = tags.iterator().next();
          for (Code code : codes) {
            if (code.enabled && !tag.equals(code.tag)) {
              logger.error(String.format("Expected code tag %s, found %s", tag, code.tag));
            }
            code.tag = null;
          }
          concept.tag = tag;
        }
      }

      Collection<String> warnings = new LinkedList<>();
      if (mapping.concepts.containsKey(CUSTOM_CUI)) {
        int numCodes =
            mapping.concepts.get(CUSTOM_CUI).codes.values().stream()
                .mapToInt((v) -> v.size())
                .sum();
        warnings.add(
            ""
                + numCodes
                + " codes without valid concept were associated to a custom concept called "
                + CUSTOM_NAME);
      }
      for (String vocId : warnNoConcept.keySet()) {
        String codes = warnNoConcept.get(vocId).stream().collect(Collectors.joining(", "));
        warnings.add(
            "In coding system " + vocId + " the code(s) " + codes + " have no associated concept");
      }
      for (String vocId : warnWrongConcept.keySet()) {
        String codes = warnWrongConcept.get(vocId).stream().collect(Collectors.joining(", "));
        warnings.add(
            "In coding system "
                + vocId
                + " the code(s) "
                + codes
                + " are associated to different concepts than in the UMLS");
      }

      // Attach warnings as comment on custom CUI
      if (!warnings.isEmpty()) {
        String content = warnings.stream().collect(Collectors.joining("\n"));
        mapping.concepts.computeIfAbsent(CUSTOM_CUI, k -> customConcept);
        messagesByConcept.computeIfAbsent(CUSTOM_CUI, k -> new LinkedList<>()).add(content);
      }

      for (String cui1 : retired.keySet()) {
        for (String cui2 : retired.get(cui1)) {
          messagesByConcept
              .computeIfAbsent(cui2, k -> new LinkedList<>())
              .add(String.format("Changed from retired CUI %s", cui1));
        }
      }

      AllTopics allTopics = new AllTopics();
      for (String cui : messagesByConcept.keySet()) {
        String date =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").format(LocalDateTime.now());
        Topic topic = new Topic(0, "CSV import", new Action(importAuthor, date), null);
        for (String content : messagesByConcept.get(cui)) {
          Message msg = new Message(messageIx++, importAuthor, date, content, false);
          topic.messages.add(msg);
        }
        allTopics.byConcept.computeIfAbsent(cui, k -> new Topics()).put(0, topic);
      }
      for (String voc : topicByCode.keySet()) {
        allTopics.byCode.put(voc, new HashMap<>());
        for (String code : topicByCode.get(voc).keySet()) {
          Topic topic = topicByCode.get(voc).get(code);
          Topics topics = new Topics();
          topics.put(topic.id, topic);
          allTopics.byCode.get(voc).put(code, topics);
        }
      }

      return new ImportedMapping(mapping, allTopics, warnings);
    } catch (CsvValidationException | IOException e) {
      throw CodeMapperException.user("cannot parse CSV file", e);
    }
  }
}
