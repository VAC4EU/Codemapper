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
import org.biosemantics.codemapper.persistency.MappingRevision;
import org.biosemantics.codemapper.persistency.PersistencyApi.MappingInfo;
import org.biosemantics.codemapper.persistency.PersistencyApi.ParsedMappingName;

public class WriteCsvApi {
  static final String NO_CODE = "-";

  public static final String FILE_EXTENSION = "csv";
  public static final String MIME_TYPE = "text/csv";
  static final String[] HEADERS = {
    "mapping", "coding_system", "code", "code_name", "concept", "concept_name", "tag", "origin"
  };
  static final String[] COMPATIBILITY_HEADERS = {
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
    if (!compatibilityFormat) {
      writeProjectHeader(output, project, prepareds);
    }
    writeHeaders(output, compatibilityFormat);
    for (PreparedMapping prepared : prepareds) {
      writePrepared(output, prepared, compatibilityFormat);
    }
  }

  public static class Mapping {
    MappingInfo info;
    MappingRevision revision;
    MappingData data;
    Map<String, Descendants> descendants;
    boolean includeDescendants;
  }

  @XmlRootElement
  public static class PreparedMapping {
    public Mapping mapping;
    public ParsedMappingName parsedName;
    public Map<String, Map<String, PreparedConcept>> data =
        new HashMap<>(); // voc -> cui -> forConcept
    public Map<String, Set<String>> disablad = new HashMap<>(); // voc -> set(code)

    Set<String> getConceptCodes(String voc) {
      return data.getOrDefault(voc, new HashMap<>()).entrySet().stream()
          .flatMap(e -> e.getValue().data.keySet().stream())
          .collect(Collectors.toSet());
    }

    String mappingID() {
      if (parsedName != null) {
        return parsedName.withoutDefinition();
      } else {
        return mapping.info.mappingName;
      }
    }
  }

  @XmlRootElement
  public static class PreparedConcept {
    public Concept concept;
    public Map<String, PreparedCode> data = new HashMap<>(); // code -> prepared code
    public Collection<Code> descendants = new LinkedList<>(); // descendants (voc from mapping.data)
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
    prepared.parsedName = mapping.info.parseName();
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
          } else {
            prepared.disablad.computeIfAbsent(voc, key -> new HashSet<>()).add(code0);
          }
        }
        vocData.put(cui, concept);
      }
    }
    return prepared;
  }

  void writePrepared(OutputStream output, PreparedMapping prepared, boolean compatibilityFormat)
      throws IOException {
    for (String voc : prepared.data.keySet()) {
      Set<String> disabled = prepared.disablad.getOrDefault(voc, new HashSet<>());
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
          String tag = code.code.getTag();
          if (tag == null) {
            tag = concept.concept.getTag();
          }
          writeCodeRow(
              output,
              voc,
              code.code.getId(),
              code.code.getTerm(),
              concept.concept.getId(),
              concept.concept.getName(),
              tag,
              "",
              compatibilityFormat,
              prepared);
          writtenCodes.add(code0);
          wroteCode = true;
          for (Code code1 : code.descendants) {
            if (disabled.contains(code0)) continue;
            if (writtenCodes.contains(code1.getId())) continue;
            if (conceptCodes.contains(code1.getId())) continue;
            String origin = String.format("Desc: code %s", code0);
            writeCodeRow(
                output,
                voc,
                code1.getId(),
                code1.getTerm(),
                "-",
                "-",
                tag,
                origin,
                compatibilityFormat,
                prepared);
            writtenCodes.add(code1.getId());
          }
        }
        for (Code code : concept.descendants) {
          if (disabled.contains(code.getId())) continue;
          if (writtenCodes.contains(code.getId())) continue;
          if (conceptCodes.contains(code.getId())) continue;
          String origin = String.format("Desc: concept %s", cui);
          writeCodeRow(
              output,
              voc,
              code.getId(),
              code.getTerm(),
              "-",
              "-",
              concept.concept.getTag(),
              origin,
              compatibilityFormat,
              prepared);
          writtenCodes.add(code.getId());
        }
        if (!wroteCode) {
          writeCodeRow(
              output,
              voc,
              NO_CODE,
              "",
              cui,
              concept.concept.getName(),
              concept.concept.getTag(),
              "Concept without codes in " + voc,
              compatibilityFormat,
              prepared);
        }
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
      boolean compatibilityFormat,
      PreparedMapping prepared)
      throws IOException {
    ParsedMappingName parsed = prepared.parsedName;
    if (compatibilityFormat) {
      writeRawRow(
          output,
          parsed != null ? parsed.definition : "",
          voc,
          code,
          term,
          concept,
          conceptName,
          tag,
          origin,
          parsed != null ? parsed.system : "",
          parsed != null ? parsed.abbreviation : prepared.mapping.info.mappingName,
          parsed != null ? parsed.type : "");
    } else {
      writeRawRow(output, prepared.mappingID(), voc, code, term, concept, conceptName, tag, origin);
    }
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

  public void writeProjectHeader(
      OutputStream output, String project, Collection<PreparedMapping> prepareds)
      throws IOException {
    String url = CodeMapperApplication.getCodeMapperURL() + "/folder/" + project;
    String meta =
        String.format(
            "# Folder: %s, exported-mappings: %d, url: %s\n", project, prepareds.size(), url);
    output.write(meta.getBytes());
    for (PreparedMapping prepared : prepareds) {
      url =
          CodeMapperApplication.getCodeMapperURL()
              + "/mapping/"
              + prepared.mapping.info.mappingShortkey;
      String descendants = prepared.mapping.includeDescendants ? "true" : "false";
      String infos = "";
      if (prepared.parsedName != null) {
        if (prepared.parsedName.system != null) {
          infos += String.format(", system: %s", prepared.parsedName.system);
        }
        if (prepared.parsedName.type != null) {
          infos += String.format(", type: %s", prepared.parsedName.type);
        }
        if (prepared.parsedName.abbreviation != null) {
          infos += String.format(", abbr: %s", prepared.parsedName.abbreviation);
        }
        if (prepared.parsedName.definition != null) {
          infos +=
              String.format(
                  ", definition: \"%s\"", prepared.parsedName.definition.replaceAll("\"", ""));
        }
      }
      meta =
          String.format(
              "# Mapping: %s%s, version: %d, descendants: %s, url: %s\n",
              prepared.mappingID(),
              infos,
              prepared.mapping.revision.getVersion(),
              descendants,
              url);
      output.write(meta.getBytes());
    }
  }

  void writeHeaders(OutputStream output, boolean compatibilityFormat) throws IOException {
    if (compatibilityFormat) {
      writeRawRow(output, COMPATIBILITY_HEADERS);
    } else {
      writeRawRow(output, HEADERS);
    }
  }

  /** Auxiliary to format an array of tags in the export file. */
  static String formatTags(Collection<String> tagsArray) {
    if (tagsArray == null) return "";
    else return String.join(", ", tagsArray);
  }
}
