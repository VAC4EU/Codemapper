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

package org.biosemantics.codemapper.rest;

import java.util.Set;

public class ServerInfo {
  String umlsVersion;
  String url;
  String contactEmail;
  String projectVersion;
  Set<String> defaultVocabularies;
  Set<String> defaultAllowedTags;
  Set<String> defaultIgnoreTermTypes;
  Set<String> defaultIgnoreSemanticTypes;

  public ServerInfo(
      String umlsVersion,
      String url,
      String contactEmail,
      String projectVersion,
      Set<String> defaultVocabularies,
      Set<String> defaultAllowedTags,
      Set<String> defaultIgnoreTermTypes,
      Set<String> defaultIgnoreSemanticTypes) {
    this.umlsVersion = umlsVersion;
    this.url = url;
    this.contactEmail = contactEmail;
    this.projectVersion = projectVersion;
    this.defaultVocabularies = defaultVocabularies;
    this.defaultAllowedTags = defaultAllowedTags;
    this.defaultIgnoreTermTypes = defaultIgnoreTermTypes;
    this.defaultIgnoreSemanticTypes = defaultIgnoreSemanticTypes;
  }

  public Set<String> getDefaultVocabularies() {
    return defaultVocabularies;
  }

  public void setDefaultVocabularies(Set<String> defaultVocabularies) {
    this.defaultVocabularies = defaultVocabularies;
  }

  public Set<String> getDefaultAllowedTags() {
    return defaultAllowedTags;
  }

  public void setDefaultAllowedTags(Set<String> defaultAllowedTags) {
    this.defaultAllowedTags = defaultAllowedTags;
  }

  public Set<String> getDefaultIgnoreSemanticTypes() {
    return defaultIgnoreSemanticTypes;
  }

  public void setDefaultIgnoreSemanticTypes(Set<String> defaultIgnoreSemanticTypes) {
    this.defaultIgnoreSemanticTypes = defaultIgnoreSemanticTypes;
  }

  public String getUmlsVersion() {
    return umlsVersion;
  }

  public String getUrl() {
    return url;
  }

  public String getContactEmail() {
    return contactEmail;
  }

  public String getProjectVersion() {
    return projectVersion;
  }

  public Set<String> getIgnoreTermTypes() {
    return defaultIgnoreTermTypes;
  }
}
