/** */
package org.biosemantics.codemapper;

import static org.junit.jupiter.api.Assertions.*;

import java.io.StringReader;
import java.util.Collections;
import java.util.Set;
import jersey.repackaged.com.google.common.collect.Sets;
import org.biosemantics.codemapper.MappingData.Code;
import org.biosemantics.codemapper.UmlsApi.ImportedMapping;
import org.biosemantics.codemapper.rest.CodeMapperApplication;
import org.biosemantics.codemapper.rest.NonUmlsTargets;
import org.junit.jupiter.api.Test;

/** */
class CsvImportTest {

  static String csvInput =
      "event_definition,coding_system,code,code_name,concept,concept_name,tags,origin,system,event_abbreviation,type\n"

          // no concept
          + "Multisystem immflamatory syndrome,MEDCODEID,309384013,[X]Other specified localized connective tissue disorders,,,exclude,,O,MIS,AESI\n"

          // with concept
          + "Multisystem immflamatory syndrome,MEDCODEID,309391011,\"[X]Localised connective tissue disorder, unspecified\",C0009782,,exclude,,O,MIS,AESI\n"

          // wrong concept
          + "Multisystem immflamatory syndrome,MEDCODEID,312574017,Disorder of connective tissue,C0036981,,exclude,,O,MIS,AESI\n"

          // custom code, no concept
          + "Multisystem immflamatory syndrome,MEDCODEID,7662811000006112,Cytokine release syndrome,,,exclude,,O,MIS,AESI\n"

          // custom code, assigned concept
          + "Multisystem immflamatory syndrome,MEDCODEID,14168691000006114,Multisystem inflammatory syndrome in adults,C0009782,,narrow,,O,MIS,AESI\n"

          //

          + "";

  @Test
  void test() throws Exception {
    new CodeMapperApplication();
    try (NonUmlsTargets nonUmlsTargets = CodeMapperApplication.createNonUmlsTargets();
        UmlsApi api = CodeMapperApplication.createUmlsApi(nonUmlsTargets)) {

      String dbProp = CodeMapperApplication.getProp("code-mapper-db-uri");
      assertEquals(dbProp, "jdbc:postgresql://127.0.0.1/codemapper");

      ImportedMapping imported =
          api.importCompatCSV(
              new StringReader(csvInput),
              Collections.emptyList(),
              Collections.emptyList(),
              null,
              null,
              null);
      MappingData mapping = imported.mapping;

      //    ObjectMapper mapper = new ObjectMapper();
      //    System.out.println(mapper.writeValueAsString(mapping));
      //    System.out.println(mapper.writeValueAsString(imported.allTopics));

      assertEquals(mapping.codes.keySet(), Collections.singleton("MEDCODEID"));
      Set<String> csvCodes =
          Sets.newHashSet(
              "309384013 309391011 312574017 7662811000006112 14168691000006114".split(" "));
      Set<String> csvCustoms = Sets.newHashSet("7662811000006112 14168691000006114".split(" "));
      for (Code code : mapping.codes.get("MEDCODEID").values()) {
        assertEquals(code.enabled, csvCodes.contains(code.id));
        assertEquals(code.custom, csvCustoms.contains(code.id));
      }
      assertEquals(mapping.concepts.keySet(), Sets.newHashSet("C0009782", "C0000000"));
      assertTrue(mapping.concepts.get("C0009782").codes.get("MEDCODEID").contains("309384013"));
      assertTrue(mapping.concepts.get("C0009782").codes.get("MEDCODEID").contains("309391011"));
      assertTrue(mapping.concepts.get("C0009782").codes.get("MEDCODEID").contains("312574017"));
      assertTrue(
          mapping.concepts.get("C0009782").codes.get("MEDCODEID").contains("14168691000006114"));

      assertTrue(
          mapping.concepts.get("C0000000").codes.get("MEDCODEID").contains("7662811000006112"));

      String message2 =
          imported
              .allTopics
              .byCode
              .get("MEDCODEID")
              .get("312574017")
              .values()
              .iterator()
              .next()
              .messages
              .iterator()
              .next()
              .getContent();
      assertEquals(message2, "changed concept from C0036981 to C0009782");
      String message3 = imported.warnings.iterator().next();
      assertEquals(
          message3,
          "1 codes with invalid concept were associated to a custom concept called Unassociated custom codes");

      ImportedMapping imported0 =
          api.importCompatCSV(
              new StringReader(csvInput),
              Collections.emptyList(),
              Collections.emptyList(),
              "A",
              "B",
              "C");
      assertTrue(imported0.mapping.concepts.isEmpty());
      assertTrue(imported0.mapping.codes.isEmpty());
    }
  }
}
