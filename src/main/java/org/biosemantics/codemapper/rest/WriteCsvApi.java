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

import java.io.IOException;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import javax.xml.bind.annotation.XmlRootElement;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.MappingData;
import org.biosemantics.codemapper.MappingData.Code;
import org.biosemantics.codemapper.MappingData.Concept;
import org.biosemantics.codemapper.descendants.DescendantsApi.Descendants;
import org.biosemantics.codemapper.persistency.PersistencyApi.MappingInfo;
import org.biosemantics.codemapper.persistency.PersistencyApi.MappingMeta;
import org.biosemantics.codemapper.persistency.PersistencyApi.Revision;

public class WriteCsvApi {
  static final String NO_CODE = "-";

  public static final String FILE_EXTENSION = "csv";
  public static final String MIME_TYPE = "text/csv";
  static final String[] CODELIST_HEADERS = {
    "event_definition",
    "coding_system",
    "code",
    "code_name",
    "concept",
    "concept_name",
    "tags",
    "origin",
    "system",
    "event_abbreviation",
    "type"
  };
  static final String[] META_HEADERS = {
    "system",
    "abbreviation",
    "type",
    "definition",
    "version",
    "umls_version",
    "descendant_codes",
    "coding_systems",
    "url"
  };
  static final String[] CODING_SYSTEMS_HEADERS = {
    "umls_version", "coding_system", "coding_system_version"
  };

  public void writeProjectCSV(
      OutputStream output,
      String project,
      Collection<Mapping> mappings,
      boolean compatibilityFormat)
      throws IOException, CodeMapperException {
    Collection<PreparedMapping> prepareds = new LinkedList<>();
    for (Mapping mapping : mappings) {
      prepareds.add(prepare(mapping));
    }
    writeHeaders(output);
    for (PreparedMapping prepared : prepareds) {
      writePrepared(output, prepared);
    }
  }

  public void writeMetaCSV(OutputStream output, String projectName, Collection<Mapping> mappings)
      throws IOException {
    writeRawRow(output, META_HEADERS);
    for (Mapping mapping : mappings) {
      String url =
          CodeMapperApplication.getCodeMapperURL() + "/mapping/" + mapping.info.mappingShortkey;
      String codingSystems =
          mapping.data.getVocabularies().entrySet().stream()
              .map(e -> String.format("%s@%s", e.getKey(), e.getValue().getVersion()))
              .collect(Collectors.joining(" "));
      writeRawRow(
          output,
          mapping.info.meta.system,
          mapping.info.mappingName,
          mapping.info.meta.type,
          mapping.info.meta.definition,
          "" + mapping.revision.version,
          mapping.data.getMeta().getUmlsVersion(),
          "" + mapping.data.getMeta().isIncludeDescendants(),
          codingSystems,
          url);
    }
  }

  public void writeCodingSystems(OutputStream output, Collection<Mapping> mappings)
      throws IOException {
    writeRawRow(output, CODING_SYSTEMS_HEADERS);
    Map<String, Map<String, String>> info = new HashMap<>();
    for (Mapping mapping : mappings) {
      String umlsVersion = mapping.data.getMeta().getUmlsVersion();
      info.computeIfAbsent(umlsVersion, k -> new HashMap<>());
      for (String codingSystem : mapping.data.getVocabularies().keySet()) {
        String version = mapping.data.getVocabularies().get(codingSystem).getVersion();
        info.get(umlsVersion).computeIfAbsent(codingSystem, k -> version);
      }
    }
    for (String umlsVersion : info.keySet()) {
      for (String codingSystem : info.get(umlsVersion).keySet()) {
        String version = info.get(umlsVersion).get(codingSystem);
        writeRawRow(output, umlsVersion, codingSystem, version);
      }
    }
  }

  public static class Mapping {
    MappingInfo info;
    Revision revision;
    MappingData data;
    Map<String, Descendants> descendants;
    boolean includeDescendants;
  }

  @XmlRootElement
  public static class PreparedMapping {
    public Mapping mapping;
    public Map<String, Map<String, PreparedConcept>> data =
        new HashMap<>(); // voc -> cui -> forConcept
    public Map<String, Map<String, Set<String>>> tags = new HashMap<>(); // voc -> code -> tags
    public Map<String, Set<String>> disabled = new HashMap<>(); // voc -> set(code)

    Set<String> getConceptCodes(String voc) {
      return data.getOrDefault(voc, new HashMap<>()).entrySet().stream()
          .flatMap(e -> e.getValue().data.keySet().stream())
          .collect(Collectors.toSet());
    }
  }

  @XmlRootElement
  public static class PreparedConcept {
    public Concept concept;
    public Map<String, PreparedCode> data = new HashMap<>(); // code -> prepared code
  }

  @XmlRootElement
  public static class PreparedCode {
    public Code code;
    public Collection<Code> descendants = new LinkedList<>();
    public String comments;
  }

  PreparedMapping prepare(Mapping mapping) {
    PreparedMapping prepared = new PreparedMapping();
    prepared.mapping = mapping;
    for (String voc : mapping.data.getVocabularies().keySet()) {
      Map<String, PreparedConcept> vocData =
          prepared.data.computeIfAbsent(voc, key -> new HashMap<>());
      for (String cui : mapping.data.getConcepts().keySet()) {
        PreparedConcept concept = new PreparedConcept();
        concept.concept = mapping.data.getConcepts().get(cui);
        for (String code0 : concept.concept.getCodes().getOrDefault(voc, new LinkedList<>())) {
          Code code1 = mapping.data.getCodes().get(voc).get(code0);
          if (code1.isEnabled()) {
            Collection<Code> codeDescendants =
                mapping
                    .descendants
                    .getOrDefault(voc, new Descendants())
                    .getOrDefault(code0, new LinkedList<>());
            PreparedCode code = new PreparedCode();
            code.code = code1;
            code.descendants.addAll(codeDescendants);
            concept.data.put(code0, code);

            // unify tags
            String tag = code1.getTag();
            if (tag != null) {
              prepared
                  .tags
                  .computeIfAbsent(voc, key -> new HashMap<>())
                  .computeIfAbsent(code0, key -> new HashSet<>())
                  .add(tag);
            }
          } else {
            prepared.disabled.computeIfAbsent(voc, key -> new HashSet<>()).add(code0);
          }
        }
        vocData.put(cui, concept);
      }
    }
    return prepared;
  }

  void writePrepared(OutputStream output, PreparedMapping prepared) throws IOException {
    for (String voc : prepared.data.keySet()) {
      Set<String> disabled = prepared.disabled.getOrDefault(voc, new HashSet<>());
      Set<String> writtenCodes = new HashSet<>(); // write each code only once
      Set<String> conceptCodes =
          prepared.getConceptCodes(voc); // don't write codes from concepts as descendant codes
      for (String cui : prepared.data.get(voc).keySet()) {
        boolean wroteCode = false;
        PreparedConcept concept = prepared.data.get(voc).get(cui);
        for (String code0 : concept.data.keySet()) {
          if (disabled.contains(code0)) continue;
          if (writtenCodes.contains(code0)) continue;
          PreparedCode code = concept.data.get(code0);
          Set<String> tags =
              prepared
                  .tags
                  .getOrDefault(voc, new HashMap<>())
                  .getOrDefault(code.code.getId(), new HashSet<>());
          String tag = String.join(",", tags);
          writeCodeRow(
              output,
              voc,
              code.code.getId(),
              code.code.getTerm(),
              concept.concept.getId(),
              concept.concept.getName(),
              tag,
              "",
              prepared);
          writtenCodes.add(code0);
          wroteCode = true;
          for (Code code1 : code.descendants) {
            if (disabled.contains(code0)) continue;
            if (writtenCodes.contains(code1.getId())) continue;
            if (conceptCodes.contains(code1.getId())) continue;
            String origin = String.format("Desc: code %s", code0);
            writeCodeRow(
                output, voc, code1.getId(), code1.getTerm(), "-", "-", tag, origin, prepared);
            writtenCodes.add(code1.getId());
          }
        }
        /*
        if (!wroteCode) {
          writeCodeRow(
              output,
              voc,
              NO_CODE,
              "",
              cui,
              concept.concept.getName(),
              "-",
              "Concept without codes in " + voc,
              prepared);
        }
        */
      }
    }
  }

  void writeCodeRow(
      OutputStream output,
      String voc,
      String code,
      String term,
      String concept,
      String conceptName,
      String tag,
      String origin,
      PreparedMapping prepared)
      throws IOException {
    MappingMeta meta = prepared.mapping.info.meta;
    writeRawRow(
        output,
        meta != null && meta.definition != null ? meta.definition : "",
        voc,
        code,
        term,
        concept,
        conceptName,
        tag,
        origin,
        meta != null && meta.system != null ? meta.system : "",
        prepared.mapping.info.mappingName,
        meta != null && meta.type != null ? meta.type : "");
  }

  private void writeRawRow(OutputStream output, String... args) throws IOException {
    String[] args1 = new String[args.length];
    for (int i = 0; i < args.length; i++) {
      String arg = args[i];
      if (arg == null) {
        arg = "";
      }
      if (arg.contains("\"") || arg.contains(",")) {
        args1[i] = "\"" + arg.replaceAll("\"", "\"\"") + "\"";
      } else {
        args1[i] = arg;
      }
    }
    String line = String.join(",", Arrays.asList(args1)) + "\n";
    output.write(line.getBytes());
  }

  void writeHeaders(OutputStream output) throws IOException {
    writeRawRow(output, CODELIST_HEADERS);
  }

  /** Auxiliary to format an array of tags in the export file. */
  static String formatTags(Collection<String> tagsArray) {
    if (tagsArray == null) return "";
    else return String.join(", ", tagsArray);
  }
}
