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
import java.util.stream.Stream;
import javax.xml.bind.annotation.XmlRootElement;
import org.biosemantics.codemapper.MappingData;
import org.biosemantics.codemapper.MappingData.Code;
import org.biosemantics.codemapper.MappingData.Concept;
import org.biosemantics.codemapper.descendants.DescendersApi.Descendants;
import org.biosemantics.codemapper.persistency.MappingRevision;
import org.biosemantics.codemapper.persistency.PersistencyApi.MappingInfo;

public class WriteCsvApi {
  static final String NO_CODE = "-";

  public static final String FILE_EXTENSION = "csv";
  public static final String MIME_TYPE = "text/csv";
  static final String[] MAPPING_HEADERS = {"Mapping"};
  static final String[] HEADERS = {
    "Coding system", "Code", "Code name", "Concept", "Concept name", "Tag", "Origin"
  };

  public void writeMappingCSV(OutputStream output, Mapping mapping, String url) throws IOException {
    writeMappingHeader(output, mapping.info, url, mapping.revision.getVersion());
    writeHeaders(output, false);
    PreparedMapping prepared = prepare(mapping.info, mapping.data, mapping.descendants);
    writePrepared(output, prepared, false);
  }

  public void writeProjectCSV(
      OutputStream output,
      String project,
      Collection<Mapping> mappings,
      String formattedTime,
      String url)
      throws IOException {
    writeProjectHeader(output, project, mappings, formattedTime, url);
    writeHeaders(output, true);
    for (Mapping mapping : mappings) {
      PreparedMapping prepared = prepare(mapping.info, mapping.data, mapping.descendants);
      writePrepared(output, prepared, true);
    }
  }

  public static class Mapping {
    MappingInfo info;
    MappingRevision revision;
    MappingData data;
    Map<String, Descendants> descendants;

    String meta() {
      return String.format("%s@v%d", info.mappingName, revision.getVersion());
    }
  }

  @XmlRootElement
  public static class PreparedMapping {
    public String mappingName;
    public Map<String, Map<String, PreparedConcept>> data =
        new HashMap<>(); // voc -> cui -> forConcept
    public Map<String, Set<String>> disablad = new HashMap<>(); // voc -> set(code)

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
    public Collection<Code> descendants = new LinkedList<>(); // descendants (voc from mapping.data)
  }

  @XmlRootElement
  public static class PreparedCode {
    public Code code;
    public Collection<Code> descendants = new LinkedList<>();
    public String comments;
  }

  PreparedMapping prepare(
      MappingInfo info, MappingData mapping, Map<String, Descendants> descendants) {
    PreparedMapping prepared = new PreparedMapping();
    prepared.mappingName = info.mappingName;
    for (String voc : mapping.getVocabularies().keySet()) {
      Map<String, PreparedConcept> vocData =
          prepared.data.computeIfAbsent(voc, key -> new HashMap<>());
      for (String cui : mapping.getConcepts().keySet()) {
        PreparedConcept concept = new PreparedConcept();
        concept.concept = mapping.getConcepts().get(cui);
        for (String code0 : concept.concept.getCodes().getOrDefault(voc, new LinkedList<>())) {
          Code code1 = mapping.getCodes().get(voc).get(code0);
          if (code1.isEnabled()) {
            Collection<Code> codeDescendants =
                descendants
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

  void writePrepared(OutputStream output, PreparedMapping prepared, boolean writeMappingName)
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
          writeRow(
              output,
              writeMappingName,
              prepared.mappingName,
              voc,
              code.code.getId(),
              code.code.getTerm(),
              concept.concept.getId(),
              concept.concept.getName(),
              tag,
              "");
          writtenCodes.add(code0);
          wroteCode = true;
          for (Code code1 : code.descendants) {
            if (disabled.contains(code0)) continue;
            if (writtenCodes.contains(code1.getId())) continue;
            if (conceptCodes.contains(code1.getId())) continue;
            String origin = String.format("Desc: code %s", code0);
            writeRow(
                output,
                writeMappingName,
                prepared.mappingName,
                voc,
                code1.getId(),
                code1.getTerm(),
                "-",
                "-",
                tag,
                origin);
            writtenCodes.add(code1.getId());
          }
        }
        for (Code code : concept.descendants) {
          if (disabled.contains(code.getId())) continue;
          if (writtenCodes.contains(code.getId())) continue;
          if (conceptCodes.contains(code.getId())) continue;
          String origin = String.format("Desc: concept %s", cui);
          writeRow(
              output,
              writeMappingName,
              prepared.mappingName,
              voc,
              code.getId(),
              code.getTerm(),
              "-",
              "-",
              concept.concept.getTag(),
              origin);
          writtenCodes.add(code.getId());
        }
        if (!wroteCode) {
          writeRow(
              output,
              writeMappingName,
              prepared.mappingName,
              voc,
              NO_CODE,
              "",
              cui,
              concept.concept.getName(),
              concept.concept.getTag(),
              "Concept without codes in " + voc);
        }
      }
    }
  }

  void writeRow(
      OutputStream output,
      boolean writeMappingName,
      String mapping,
      String voc,
      String code,
      String term,
      String concept,
      String conceptName,
      String tag,
      String origin)
      throws IOException {
    if (writeMappingName) {
      writeRawRow(output, mapping, voc, code, term, concept, conceptName, tag, origin);
    } else {
      writeRawRow(output, voc, code, term, concept, conceptName, tag, origin);
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

  private void writeMappingHeader(OutputStream output, MappingInfo info, String url, int version)
      throws IOException {
    String meta =
        String.format(
            "# Mapping: %s, version: %d, project: %s, created with CodeMapper: %s\n",
            info.mappingName, version, info.projectName, url);
    output.write(meta.getBytes());
  }

  public void writeProjectHeader(
      OutputStream output,
      String project,
      Collection<Mapping> mappings,
      String formattedTime,
      String url)
      throws IOException {
    String mappingMetas = mappings.stream().map(Mapping::meta).collect(Collectors.joining(", "));
    String meta =
        String.format(
            "# Project: %s, timestamp: %s, created with CodeMapper: %s, mappings: %s\n",
            project, formattedTime, url, mappingMetas);
    output.write(meta.getBytes());
  }

  void writeHeaders(OutputStream output, boolean writeMappingName) throws IOException {
    String[] headers;
    if (writeMappingName) {
      headers =
          Stream.concat(Arrays.stream(MAPPING_HEADERS), Arrays.stream(HEADERS))
              .toArray(String[]::new);
    } else {
      headers = HEADERS;
    }
    writeRawRow(output, headers);
  }

  /** Auxiliary to format an array of tags in the export file. */
  static String formatTags(Collection<String> tagsArray) {
    if (tagsArray == null) return "";
    else return String.join(", ", tagsArray);
  }
}
