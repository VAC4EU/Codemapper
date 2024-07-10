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
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import javax.xml.bind.annotation.XmlRootElement;
import org.biosemantics.codemapper.Comment;
import org.biosemantics.codemapper.MappingData;
import org.biosemantics.codemapper.MappingData.Code;
import org.biosemantics.codemapper.MappingData.Concept;
import org.biosemantics.codemapper.descendants.DescendersApi.Descendants;
import org.biosemantics.codemapper.persistency.PersistencyApi.MappingInfo;

public class WriteTsvApi {
  static final String NO_CODE = "-";

  public static final String FILE_EXTENSION = "csv";
  public static final String MIME_TYPE = "text/csv";
  static final String[] CODES_HEADERS = {
    "Coding system", "Code", "Term", "Concept", "Concept name", "Tag", "Origin"
    //"coding_system", "code", "term", "concept", "concept_name", "tag", "comment"
  };

  @XmlRootElement
  public static class PreparedMapping {
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

  PreparedMapping prepare(MappingData mapping, Map<String, Descendants> descendants) {
    PreparedMapping prepared = new PreparedMapping();
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

  void writePrepared(OutputStream output, PreparedMapping prepared) throws IOException {
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
              voc,
              code.code.getId(),
              code.code.getTerm(),
              concept.concept.getId(),
              concept.concept.getName(),
              tag,
              "-");
          writtenCodes.add(code0);
          wroteCode = true;
          for (Code code1 : code.descendants) {
            if (disabled.contains(code0)) continue;
            if (writtenCodes.contains(code1.getId())) continue;
            if (conceptCodes.contains(code1.getId())) continue;
            String origin = String.format("Desc: code %s", code0);
            writeRow(output, voc, code1.getId(), code1.getTerm(), "-", "-", tag, origin);
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

  public void write(
      OutputStream output,
      MappingData mapping,
      Map<String, Descendants> descendants,
      List<Comment> comments,
      MappingInfo info,
      int version,
      String url)
      throws IOException {
    writeInfo(output, info, url, version);
    writeHeader(output, CODES_HEADERS);
    PreparedMapping prepared = prepare(mapping, descendants);
    writePrepared(output, prepared);
  }

  private void writeHeader(OutputStream output, String... args) throws IOException {
    String line = String.join(",", Arrays.asList(args)) + "\n";
    output.write(line.getBytes());
  }

  private void writeRow(OutputStream output, String... args) throws IOException {
    String[] args1 = new String[args.length];
    for (int i = 0; i < args.length; i++) {
      String arg = args[i];
      if (arg == null) {
        arg = "";
      }
      args1[i] = "\"" + arg.replaceAll("\"", "\"\"") + "\"";
    }
    String line = String.join(",", Arrays.asList(args1)) + "\n";
    output.write(line.getBytes());
  }

  private void writeInfo(OutputStream output, MappingInfo info, String url, int version)
      throws IOException {
    String line =
        String.format(
            "# Mapping: %s, version: %d, project: %s, created with CodeMapper: %s\n",
            info.mappingName, version, info.projectName, url);
    output.write(line.getBytes());
  }
  /** Auxiliary to format an array of tags in the export file. */
  static String formatTags(Collection<String> tagsArray) {
    if (tagsArray == null) return "";
    else return String.join(", ", tagsArray);
  }
}
