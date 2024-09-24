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

import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.MappingData.Code;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.rest.NonUmlsTargets;

public class DescendantsApi {

  public static interface SpecificDescender {

    /** Returns the coding system for which the specific descender retrieves codes */
    public String getCodingSystem();

    /** Returns a mapping of each of the argument codes to a collection of descendant codes. */
    public Map<String, Collection<SourceConcept>> getDescendants(Collection<String> codes)
        throws CodeMapperException;
  }

  public static interface GeneralDescender {

    /** Returns a mapping of each of the argument codes to a collection of descendant codes. */
    public Map<String, Collection<SourceConcept>> getDescendants(
        Collection<String> codes, String codingSystem) throws CodeMapperException;
  }

  Map<String, SpecificDescender> specificDescenders;
  GeneralDescender generalDescender;
  NonUmlsTargets nonUmls;

  public DescendantsApi(GeneralDescender generalDescender, NonUmlsTargets nonUmls) {
    this.generalDescender = generalDescender;
    this.specificDescenders = new HashMap<>();
    this.nonUmls = nonUmls;
  }

  public void add(SpecificDescender specificDescender) {
    this.specificDescenders.put(specificDescender.getCodingSystem(), specificDescender);
  }

  /* Returns map from root codes to descendant source concepts */
  public Descendants getCodeDescendants(String codingSystem, Collection<String> codes)
      throws CodeMapperException {
    Descendants res = new Descendants();
    if (specificDescenders.containsKey(codingSystem)) {
      Map<String, Collection<SourceConcept>> descendants2 =
          specificDescenders.get(codingSystem).getDescendants(codes);
      for (String code : descendants2.keySet()) {
        List<Code> descs =
            descendants2.get(code).stream().map(SourceConcept::toCode).collect(Collectors.toList());
        res.merge(
            code,
            descs,
            (v1, v2) -> {
              v1.addAll(v2);
              return v1;
            });
      }
    } else if (nonUmls.is(codingSystem)) {
      Map<String, Collection<String>> cuisByCodes = nonUmls.getCuisForCodes(codingSystem, codes);
      Collection<String> cuis = new HashSet<>();
      for (Collection<String> cuis1 : cuisByCodes.values()) {
        cuis.addAll(cuis1);
      }
      Map<String, Collection<Code>> descsByCui = nonUmls.getDescendants(cuis, codingSystem);
      for (String code : cuisByCodes.keySet()) {
        for (String cui : cuisByCodes.get(code)) {
          Collection<Code> descs =
              descsByCui.getOrDefault(cui, Collections.emptyList()).stream()
                  .collect(Collectors.toList());
          if (descs == null) {
            continue;
          }
          res.computeIfAbsent(code, (key) -> new HashSet<>()).addAll(descs);
        }
      }

    } else {
      Map<String, Collection<SourceConcept>> descendants2 =
          generalDescender.getDescendants(codes, codingSystem);
      for (String code : descendants2.keySet()) {
        List<Code> descs =
            descendants2.get(code).stream().map(SourceConcept::toCode).collect(Collectors.toList());
        res.merge(
            code,
            descs,
            (v1, v2) -> {
              v1.addAll(v2);
              return v1;
            });
      }
    }
    return res;
  }

  /* Codes to descendant codes */
  public static class Descendants extends HashMap<String, Collection<Code>> {
    public Descendants() {}

    public Descendants(Map<String, Collection<Code>> map) {
      this.putAll(map);
    }

    private static final long serialVersionUID = 1L;
  }

  public Map<String, Descendants> getDescendants(Map<String, Map<String, Code>> codesByVoc)
      throws CodeMapperException {
    Map<String, Collection<String>> codes = new HashMap<>();
    for (String voc : codesByVoc.keySet()) {
      codes.put(voc, codesByVoc.get(voc).keySet());
    }
    return getDescendantCodes(codes);
  }

  public Map<String, Descendants> getDescendantCodes(Map<String, Collection<String>> codesByVoc)
      throws CodeMapperException {
    HashMap<String, Descendants> descendants = new HashMap<>();
    for (String codingSystem : codesByVoc.keySet()) {
      Collection<String> codes = codesByVoc.get(codingSystem);
      descendants.put(codingSystem, getCodeDescendants(codingSystem, codes));
    }
    return descendants;
  }
}
