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

import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonSubTypes.Type;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;

/** The state as stored on the client. */
public class ClientState {

  private ObjectMapper mapper = new ObjectMapper();

  public ClientState() {
    mapper.setVisibility(PropertyAccessor.ALL, Visibility.NONE);
    mapper.setVisibility(PropertyAccessor.FIELD, Visibility.ANY);
  }

  public State ofJson(String string) throws JsonProcessingException {
    return mapper.readValue(string, State.class);
  }

  public static class ShortConcept {
    public String cui, preferredName;
  }

  public static class Span {
    public int start, end;
    public String text, id, label;
  }

  public static class Indexing {
    public String caseDefinition;
    public Span[] spans;
    public UmlsConcept[] concepts;
    public Map<String, UmlsConcept> conceptsByCui;
  }

  public static class SourceConcept {
    public String cui, codingSystem, id, preferredTerm;
    public boolean selected;
  }

  public static class Semantic {
    public String[] types;
    public String[] groups;
  }

  public static class Concept {
    public String cui;
    public String preferredName;
    public String definition;
    public String[] semanticTypes;
    public SourceConcept[] sourceConcepts;
    public Map<String, SourceConcept[]> codes;
    public int sourceConceptsCount;
    public Semantic semantic;
    public Origin<?> origin;
    public Object[] comments;
    public String[] tags;
  }

  public static class Mapping {
    public Concept[] concepts;
    public HistoryEntry<?, ?>[] history;
  }

  public static class State {
    public Indexing indexing;
    public Mapping mapping;
    public String[] codingSystems;
    public Map<String, String> cuiAssignment;
    public Map<String, String[]> targetDatabases;
    public Map<String, Boolean> showVocabularies;
  }

  @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
  @JsonSubTypes({
    @Type(value = OriginBroader.class, name = "broader"),
    @Type(value = OriginBroader.class, name = "hypernym"),
    @Type(value = OriginNarrower.class, name = "narrower"),
    @Type(value = OriginNarrower.class, name = "hyponym"),
    @Type(value = OriginAdd.class, name = "add"),
    @Type(value = OriginSearch.class, name = "search"),
    @Type(value = OriginSuggested.class, name = "suggested"),
    @Type(value = OriginSpans.class, name = "spans")
  })
  public static class Origin<Data> {
    public String type;
    public ShortConcept root;
    public Data data;
  }

  public static class OriginBroader extends Origin<ShortConcept> {}

  public static class OriginNarrower extends Origin<ShortConcept> {}

  public static class OriginSuggested extends Origin<ShortConcept> {}

  public static class OriginAdd extends Origin<String> {}

  public static class OriginSpans extends Origin<Span> {}

  public static class OriginSearch extends Origin<String> {}

  @JsonTypeInfo(
      use = JsonTypeInfo.Id.NAME,
      include = JsonTypeInfo.As.PROPERTY,
      property = "operation")
  @JsonSubTypes({
    @Type(value = HistoryEntryAdd.class, name = "Add"),
    @Type(value = HistoryEntrySearch.class, name = "Search"),
    @Type(value = HistoryEntryDelete.class, name = "Delete"),
    @Type(value = HistoryEntryEditCodes.class, name = "Edit codes"),
    @Type(value = HistoryEntrySummarize.class, name = "Summarize"),
    @Type(value = HistoryEntryAutomaticCoding.class, name = "Automatic coding"),
    @Type(value = HistoryEntrySuggest.class, name = "suggest"),
    @Type(value = HistoryEntryReloadMapping.class, name = "Reload mapping"),
    @Type(value = HistoryEntrySetTags.class, name = "Set tags"),
    @Type(value = HistoryEntryNull.class, name = "Change target databases"),
    @Type(value = HistoryEntryChangeCodingSystems.class, name = "Change coding systems"),
    @Type(value = HistoryEntryExpandMoreGeneral.class, name = "Expand to more general"),
    @Type(value = HistoryEntryExpandMoreGeneral.class, name = "Expand concepts to broader"),
    @Type(value = HistoryEntryExpandMoreSpecific.class, name = "Expand to more specific"),
    @Type(value = HistoryEntryExpandMoreSpecific.class, name = "Expand concepts to narrower")
  })
  public static class HistoryEntry<Argument, Result> {
    public String date;
    public String user;
    public Argument argument;
    public Result result;
  }

  public static class HistoryEntryNull extends HistoryEntry<Object, Object> {}

  public static class HistoryEntryAdd extends HistoryEntry<Object, ShortConcept> {}

  public static class HistoryEntrySearch extends HistoryEntry<String, ShortConcept[]> {}

  public static class HistoryEntryDelete extends HistoryEntry<ShortConcept[], Object> {}

  public static class HistoryEntryEditCodes extends HistoryEntry<ShortConcept[], String> {}

  public static class HistoryEntrySetTags extends HistoryEntry<ShortConcept[], String> {}

  public static class HistoryEntrySuggest extends HistoryEntry<ShortConcept[], ShortConcept[]> {}

  public static class HistoryEntrySummarize extends HistoryEntry<String, Object> {}

  public static class HistoryEntryAutomaticCoding extends HistoryEntry<Object, ShortConcept[]> {}

  public static class HistoryEntryReloadMapping extends HistoryEntry<Object, Object> {}

  public static class HistoryEntryExpandMoreGeneral
      extends HistoryEntry<ShortConcept[], ShortConcept[]> {}

  public static class HistoryEntryExpandMoreSpecific
      extends HistoryEntry<ShortConcept[], ShortConcept[]> {}

  public static class HistoryEntryChangeCodingSystems extends HistoryEntry<String, String> {}

  /**
   * Test the conversion of client JSON states to ClientState$State on all mappings in the database.
   */
  /*
  public static void main(String[] args) throws Exception {
    DataSource codeMapperConnectionPool = CodeMapperApplication.getConnectionPool("code-mapper-db");
    PersistencyApi persistencyApi = new PersistencyApi(codeMapperConnectionPool);
    ObjectMapper mapper = new ObjectMapper();
    mapper.setVisibility(PropertyAccessor.ALL, Visibility.NONE);
    mapper.setVisibility(PropertyAccessor.FIELD, Visibility.ANY);
    for (String project : persistencyApi.getProjects()) {
      for (String casedef : persistencyApi.getCaseDefinitionsNames(project)) {
        String string = persistencyApi.getCaseDefinition(project, casedef);
        try {
          State state = mapper.readValue(string, State.class);
          System.out.println(
              "OK " + project + "/" + casedef + ": " + state.mapping.concepts.length);
        } catch (MismatchedInputException e) {
          System.out.println(mapper.readTree(string).toPrettyString());
          //					throw remapMismatchedInputException(e, RuntimeException.class);				}
          throw e;
        }
      }
    }
  }
  */
}
