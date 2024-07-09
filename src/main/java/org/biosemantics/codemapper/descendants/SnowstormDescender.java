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

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.github.benmanes.caffeine.cache.AsyncLoadingCache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.AbstractMap;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;
import javax.ws.rs.ProcessingException;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status.Family;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.descendants.DescendersApi.SpecificDescender;
import org.biosemantics.codemapper.rest.CodeMapperApplication;

public class SnowstormDescender implements SpecificDescender {

  private static final int MAX_RESOLVE_DEPTH = 10;

  private static final int DESCENDANTS_CACHE_MAX_SIZE = 25_000;

  private static final int RESOLVE_ACTIVE_MAX_CACHE_SIZE = 25_000;

  private static Logger logger = LogManager.getLogger(SnowstormDescender.class);

  private final String codingSystem;
  private final String baseUri;
  private final String branch;

  public SnowstormDescender(String codingSystem, String baseUri, String branch) {
    this.codingSystem = codingSystem;
    this.baseUri = baseUri;
    this.branch = branch;
  }

  public String getCodingSystem() {
    return codingSystem;
  }

  @Override
  public Map<String, Collection<SourceConcept>> getDescendants(Collection<String> conceptIds)
      throws CodeMapperException {
    logger.debug("get descendants: {}", conceptIds);
    try {
      return conceptIds
          .parallelStream()
          .map(
              conceptId -> {
                try {
                  Collection<String> resolved = resolveDeep(conceptId);
                  logger.debug("concept: {}, resolved: {}", conceptId, resolved);
                  Map<String, Collection<CachedConcept>> cachedDescendants =
                      descendentsCache.getAll(resolved).get();
                  Collection<SourceConcept> descendents =
                      cachedDescendants.values().stream()
                          .flatMap(Collection::stream)
                          .map(cc -> cc.toSourceConcept())
                          .collect(Collectors.toList());
                  return new AbstractMap.SimpleEntry<>(conceptId, descendents);
                } catch (CodeMapperException e) {
                  throw new RuntimeException(e);
                } catch (InterruptedException e) {
                  String msg = "computation of descendants was interrupted";
                  Exception e1 = null;
                  if (e.getCause() instanceof Exception) {
                    e1 = (Exception) e.getCause();
                  }
                  throw new RuntimeException(CodeMapperException.server(msg, e1));
                } catch (ExecutionException e) {
                  String msg = "computation of descendants couldn't be executed";
                  Exception e1 = null;
                  if (e.getCause() instanceof Exception) {
                    e1 = (Exception) e.getCause();
                  }
                  throw new RuntimeException(CodeMapperException.server(msg, e1));
                }
              })
          .collect(Collectors.toMap(Entry::getKey, Entry::getValue));
    } catch (RuntimeException e) {
      if (e.getCause() instanceof CodeMapperException) {
        throw (CodeMapperException) e.getCause();
      } else {
        throw e;
      }
    }
  }

  private AsyncLoadingCache<String, Collection<CachedConcept>> descendentsCache =
      Caffeine.newBuilder()
          .maximumSize(DESCENDANTS_CACHE_MAX_SIZE)
          .buildAsync(id -> loadDescendants(id));

  private Collection<CachedConcept> loadDescendants(String conceptId) throws CodeMapperException {
    logger.debug("load descendants " + conceptId);
    Client client = ClientBuilder.newClient();
    String uri = String.format("%s/%s/concepts/%s/descendants", baseUri, branch, conceptId);
    Collection<CachedConcept> result = new TreeSet<>();
    int total = 0, offset = 0;
    do {
      final Response response =
          client
              .target(uri)
              .queryParam("offset", offset)
              .queryParam("limit", 150)
              .request(MediaType.APPLICATION_JSON)
              .get();
      if (response.getStatusInfo().getFamily() == Family.CLIENT_ERROR) {
        SnowstormError err = response.readEntity(SnowstormError.class);
        logger.trace(
            "descendants not found for "
                + conceptId
                + ": "
                + response.getStatusInfo().getReasonPhrase()
                + " - "
                + err);
        break; // stop paging
      }
      if (response.getStatusInfo().getFamily() != Family.SUCCESSFUL) {
        throw createException("get descendants", response);
      }
      DescendantsResult res = response.readEntity(DescendantsResult.class);
      result.addAll(
          res.items.stream().map(dc -> new CachedConcept(dc)).collect(Collectors.toList()));
      total = res.total;
      offset = res.offset + res.items.size();
    } while (result.size() < total);
    logger.trace("descendants found for " + conceptId);
    return result;
  }

  /** Associations that are used to resolve inactive concepts. */
  private static Set<String> ACTIVE_ASSOCIATIONS =
      new HashSet<>(Arrays.asList("POSSIBLY_EQUIVALENT_TO", "SAME_AS", "REPLACED_BY"));

  private Collection<String> loadResolveActive(String conceptId) throws CodeMapperException {
    logger.debug("load resolved active {}", conceptId);
    String uri = String.format("%s/browser/%s/concepts/%s", baseUri, branch, conceptId);
    Client client = ClientBuilder.newClient();
    Response response = client.target(uri).request(MediaType.APPLICATION_JSON).get();
    if (response.getStatus() == 404) {
      logger.trace("concept not found: " + conceptId);
      return null;
    }
    if (response.getStatusInfo().getFamily() != Family.SUCCESSFUL) {
      throw createException("get concept", response);
    }
    BrowserConcept concept = response.readEntity(BrowserConcept.class);
    if (concept.active) {
      logger.trace("keep active concept " + concept.conceptId);
      return null;
    }
    if (concept.associationTargets == null) {
      logger.trace("No association targets");
      return null;
    }
    Collection<String> res = new HashSet<>();
    for (String key : concept.associationTargets.keySet()) {
      if (ACTIVE_ASSOCIATIONS.contains(key)) {
        for (String associated : concept.associationTargets.get(key)) {
          res.add(associated);
        }
      }
    }
    return res;
  }

  private AsyncLoadingCache<String, Collection<String>> resolveActiveCache =
      Caffeine.newBuilder()
          .maximumSize(RESOLVE_ACTIVE_MAX_CACHE_SIZE)
          .buildAsync(id -> loadResolveActive(id));

  /**
   * Resolve inactive concepts to active concepts using the association targets of the concept.
   * Association targets may be in turn be inactive, and are further resolved until the given
   * depth..
   */
  private Collection<String> resolveDeep(String conceptId)
      throws CodeMapperException, InterruptedException, ExecutionException {
    Set<String> res = new HashSet<>();
    Map<String, Integer> todo = new HashMap<>();
    todo.put(conceptId, 0);
    while (!todo.isEmpty()) {
      res.addAll(todo.keySet());
      Collection<String> ids =
          todo.entrySet().stream()
              .filter(e -> e.getValue() < MAX_RESOLVE_DEPTH)
              .map(Entry::getKey)
              .collect(Collectors.toSet());
      Map<String, Integer> newTodo = new HashMap<>();
      Map<String, Collection<String>> allResolved = resolveActiveCache.getAll(ids).get();
      for (String id : allResolved.keySet()) {
        Integer depth = todo.get(id);
        for (String resolved : allResolved.get(id)) {
          if (!res.contains(resolved)) newTodo.put(resolved, depth + 1);
        }
      }
      todo = newTodo;
    }
    return res;
  }

  private class CachedConcept implements Comparable<CachedConcept> {
    String id;
    String term;

    CachedConcept(DescendentsConcept dc) {
      this.id = dc.conceptId;
      this.term = dc.fsn.term;
    }

    SourceConcept toSourceConcept() {
      SourceConcept res = new SourceConcept();
      res.setCodingSystem(codingSystem);
      res.setId(id);
      res.setPreferredTerm(term);
      return res;
    }

    @Override
    public int compareTo(CachedConcept other) {
      return id.compareTo(other.id);
    }

    @Override
    public int hashCode() {
      return id.hashCode();
    }

    @Override
    public boolean equals(Object obj) {
      if (this == obj) return true;
      if (obj == null) return false;
      if (getClass() != obj.getClass()) return false;
      CachedConcept other = (CachedConcept) obj;
      return Objects.equals(id, other.id);
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class SnowstormError {
    String error;
    String message;

    @Override
    public String toString() {
      return error + ": " + message;
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class BrowserConcept {
    boolean active;
    String conceptId;
    Map<String, String[]> associationTargets;
  }

  public static class Fsn {
    String lang;
    String term;
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class DescendentsConcept {
    String conceptId;
    Fsn fsn;
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class DescendantsResult {
    Collection<DescendentsConcept> items;
    int limit;
    int offset;
    int total;
  }

  private CodeMapperException createException(String descr, Response response) {
    SnowstormError err = null;
    try {
      err = response.readEntity(SnowstormError.class);
    } catch (ProcessingException e) {
    }
    return CodeMapperException.server(
        "Cannot "
            + descr
            + " from Snowstorm: "
            + response.getStatusInfo().getReasonPhrase()
            + (err != null ? " (" + err + ")" : ""));
  }

  public static void main(String[] args) throws CodeMapperException {
    CodeMapperApplication.reconfigureLog4j2(Level.DEBUG);
    SnowstormDescender descender =
        new SnowstormDescender(
            "SNOMEDCT_US", "https://snowstorm.test-nictiz.nl", "MAIN/2021-07-31");
    //		SnowstormDescenderOriginal descenderOriginal = new SnowstormDescenderOriginal("SNOMEDCT_US",
    // "https://snowstorm.test-nictiz.nl",
    //				"MAIN/2021-07-31");
    List<String> conceptIds = Arrays.asList("158164000", "23853001", "138748005");
    logger.info(
        "MEMORY: {}", Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory());

    logger.info("GET DESCENDANTS");
    Map<String, Collection<SourceConcept>> res = descender.getDescendants(conceptIds);
    for (String id : res.keySet()) logger.info("DESCENDANTS {}: {}", id, res.get(id).size());
    logger.info("DESC CACHE: {}", descender.descendentsCache.synchronous().estimatedSize());
    logger.info("RSLV CACHE: {}", descender.resolveActiveCache.synchronous().estimatedSize());
    logger.info(
        "MEMORY: {}", Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory());

    //		logger.info("GET DESCENDANTS SEQ");
    //		Map<String, Collection<SourceConcept>> resSeq =
    // descenderOriginal.getDescendantsSequential(conceptIds);
    //		logger.info("SEQ COUNT: {}", resSeq.values().stream().collect(Collectors.summingInt(c ->
    // c.size())));
    //		logger.info("MEMORY: {}", Runtime.getRuntime().totalMemory() -
    // Runtime.getRuntime().freeMemory());

    //		logger.info("GET DESCENDANTS CACHED");
    //		logger.info("MEMORY: {}", Runtime.getRuntime().totalMemory() -
    // Runtime.getRuntime().freeMemory());
    //		Map<String, Collection<SourceConcept>> resCached =
    // descenderOriginal.getDescendantsConcurrentCached(conceptIds,
    //				4);
    //		logger.info("CACHED COUNT: {}", resCached.values().stream().collect(Collectors.summingInt(c
    // -> c.size())));
    //		logger.info("MEMORY: {}", Runtime.getRuntime().totalMemory() -
    // Runtime.getRuntime().freeMemory());
    //		descenderOriginal.cache.clear();
    //		System.gc();
    //		logger.info("CLEAR MEMORY: {}", Runtime.getRuntime().totalMemory() -
    // Runtime.getRuntime().freeMemory());

    //		if (res.equals(resSeq))
    //			logger.info("RES == RES SEQ");
    //		else
    //			logger.info("RES != RES SEQ: {} -- {}", res, resSeq);
    //		if (res.equals(resCached))
    //			logger.info("RES == RES CACHED");
    //		else
    //			logger.info("RES != RES CACHED: {} -- {}", res, resCached);
    //		if (resSeq.equals(resCached))
    //			logger.info("RES SEQ == RES CACHED");
    //		else
    //			logger.info("RES SEQ != RES CACHED: {} -- {}", resSeq, resCached);
    System.exit(0);
  }
}
