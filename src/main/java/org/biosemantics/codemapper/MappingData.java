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

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class MappingData {
  Map<String, Object> start;

  Map<String, Concept> concepts; // cui -> concept
  Map<String, Map<String, Code>> codes; // voc -> code -> code info
  Map<String, Vocabulary> vocabularies; // voc -> voc info
  String umlsVersion;

  public MappingData() {
    this(null, null, null, null);
  }

  public MappingData(
      Map<String, Concept> concepts,
      Map<String, Map<String, Code>> codes,
      Map<String, Vocabulary> vocabularies,
      String umlsVersion) {
    this.concepts = concepts;
    this.codes = codes;
    this.vocabularies = vocabularies;
    this.umlsVersion = umlsVersion;
  }

  public static MappingData fromUmlsConcepts(
      Map<String, UmlsConcept> umlsConcepts,
      Map<String, Vocabulary> vocabularies,
      String umlsVersion) {

    Map<String, Concept> concepts = new HashMap<>();
    Map<String, Map<String, Code>> codes = new HashMap<>();

    for (String cui : umlsConcepts.keySet()) {
      UmlsConcept umlsConcept = umlsConcepts.get(cui);
      String name = umlsConcept.getPreferredName();
      String definition = umlsConcept.getDefinition();
      Map<String, Collection<String>> conceptCodes = new HashMap<>();
      for (SourceConcept sourceConcept : umlsConcept.getSourceConcepts()) {
        Code code =
            new Code(sourceConcept.getId(), sourceConcept.getPreferredTerm(), false, true, null);
        String codingSystem = sourceConcept.getCodingSystem();
        conceptCodes.computeIfAbsent(codingSystem, k -> new HashSet<>()).add(code.id);
        codes.computeIfAbsent(codingSystem, k -> new HashMap<>()).putIfAbsent(code.id, code);
      }
      Concept concept = new Concept(cui, name, definition, conceptCodes, null);
      concepts.put(cui, concept);
    }

    return new MappingData(concepts, codes, vocabularies, umlsVersion);
  }

  public void setCodeEnabled(String vocId, String codeId, boolean enabled)
      throws CodeMapperException {
    Map<String, Code> codes = this.codes.get(vocId);
    if (codes == null) {
      throw CodeMapperException.user("Cannot disable code in non-existing in vocabulary " + vocId);
    }
    Code code = codes.get(codeId);
    if (code == null) {
      throw CodeMapperException.user(
          "Cannot disable non-existing code " + codeId + " in vocabulary " + vocId);
    }
    codes.put(codeId, new Code(code.id, code.term, code.custom, enabled, code.tag));
  }

  public Map<String, Concept> getConcepts() {
    return concepts;
  }

  public void setConcepts(Map<String, Concept> concepts) {
    this.concepts = concepts;
  }

  public Map<String, Map<String, Code>> getCodes() {
    return codes;
  }

  public void setCodes(Map<String, Map<String, Code>> codes) {
    this.codes = codes;
  }

  public Map<String, Vocabulary> getVocabularies() {
    return vocabularies;
  }

  public void setVocabularies(Map<String, Vocabulary> vocabularies) {
    this.vocabularies = vocabularies;
  }

  public String getUmlsVersion() {
    return umlsVersion;
  }

  public void setUmlsVersion(String umlsVersion) {
    this.umlsVersion = umlsVersion;
  }

  public Map<String, Object> getStart() {
    return start;
  }

  public void setStart(Map<String, Object> start) {
    this.start = start;
  }

  @XmlRootElement
  public static class Vocabulary {
    String id;
    String name;
    String version;
    boolean custom;

    public Vocabulary() {
      this(null, null, null, false);
    }

    public Vocabulary(String id, String name, String version, boolean custom) {
      this.id = id;
      this.name = name;
      this.version = version;
      this.custom = custom;
    }

    public String getId() {
      return id;
    }

    public void setId(String id) {
      this.id = id;
    }

    public String getName() {
      return name;
    }

    public void setName(String name) {
      this.name = name;
    }

    public String getVersion() {
      return version;
    }

    public void setVersion(String version) {
      this.version = version;
    }

    public boolean isCustom() {
      return custom;
    }

    public void setCustom(boolean custom) {
      this.custom = custom;
    }
  }

  @XmlRootElement
  public static class Concept {
    String id;
    String name;
    String definition;
    Map<String, Collection<String>> codes; // vocID -> {codeId}
    String tag;

    public Concept() {
      this(null, null, null, null, null);
    }

    public Concept(
        String id,
        String name,
        String definition,
        Map<String, Collection<String>> codes,
        String tag) {
      this.id = id;
      this.name = name;
      this.definition = definition;
      this.codes = codes;
      this.tag = tag;
    }

    public String getId() {
      return id;
    }

    public void setId(String id) {
      this.id = id;
    }

    public String getName() {
      return name;
    }

    public void setName(String name) {
      this.name = name;
    }

    public String getDefinition() {
      return definition;
    }

    public void setDefinition(String definition) {
      this.definition = definition;
    }

    public Map<String, Collection<String>> getCodes() {
      return codes;
    }

    public void setCodes(Map<String, Collection<String>> codes) {
      this.codes = codes;
    }

    public String getTag() {
      return tag;
    }

    public void setTag(String tag) {
      this.tag = tag;
    }
  }

  @XmlRootElement
  public static class Code {
    String id;
    String term;
    boolean custom;
    boolean enabled;
    String tag;

    public Code() {
      this(null, null, false, true, null);
    }

    public Code(String id, String term, boolean custom, boolean enabled, String tag) {
      this.id = id;
      this.term = term;
      this.custom = custom;
      this.enabled = enabled;
      this.tag = tag;
    }

    public SourceConcept toSourceConcept(String cui, String codingSystem) {
      SourceConcept res = new SourceConcept();
      res.setCui(cui);
      res.setCodingSystem(codingSystem);
      res.setPreferredTerm(term);
      res.setId(id);
      return res;
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

    public boolean isCustom() {
      return custom;
    }

    public void setCustom(boolean custom) {
      this.custom = custom;
    }

    public boolean isEnabled() {
      return enabled;
    }

    public void setEnabled(boolean enabled) {
      this.enabled = enabled;
    }

    public String getTag() {
      return tag;
    }

    public void setTag(String tag) {
      this.tag = tag;
    }
  }
}