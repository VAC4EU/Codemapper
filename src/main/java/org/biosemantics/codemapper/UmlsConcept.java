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

import java.util.LinkedList;
import java.util.List;
import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class UmlsConcept {
  private String cui = null;
  private String preferredName = null;
  private String definition = null;
  private List<SourceConcept> sourceConcepts = new LinkedList<>();;
  private List<String> semanticTypes = new LinkedList<>();

  public UmlsConcept() {}

  public UmlsConcept(
      String cui,
      String preferredName,
      String definition,
      List<String> semanticTypes,
      List<SourceConcept> sourceConcepts) {
    this.cui = cui;
    this.preferredName = preferredName;
    this.definition = definition;
    this.semanticTypes = semanticTypes;
    this.sourceConcepts = sourceConcepts;
  }

  public String toString() {
    return String.format("%s (%s)", preferredName, cui);
  }

  public UmlsConcept(String cui, String preferredName) {
    this.cui = cui;
    this.preferredName = preferredName;
  }

  public String getCui() {
    return cui;
  }

  public void setCui(String cui) {
    this.cui = cui;
  }

  public String getPreferredName() {
    return preferredName;
  }

  public void setPreferredName(String preferredName) {
    this.preferredName = preferredName;
  }

  public String getDefinition() {
    return definition;
  }

  public void setDefinition(String definition) {
    this.definition = definition;
  }

  public List<String> getSemanticTypes() {
    return semanticTypes;
  }

  public void setSemanticTypes(List<String> semanticTypes) {
    this.semanticTypes = semanticTypes;
  }

  public List<SourceConcept> getSourceConcepts() {
    return sourceConcepts;
  }

  public void setSourceConcepts(List<SourceConcept> sourceConcepts) {
    this.sourceConcepts = sourceConcepts;
  }
}
