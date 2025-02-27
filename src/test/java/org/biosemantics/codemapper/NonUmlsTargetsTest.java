package org.biosemantics.codemapper;

import java.sql.SQLException;
import java.util.Arrays;
import java.util.Collection;
import java.util.Map;
import java.util.TreeSet;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.biosemantics.codemapper.MappingData.Code;
import org.biosemantics.codemapper.rest.CodeMapperApplication;
import org.biosemantics.codemapper.rest.NonUmlsTargets;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class NonUmlsTargetsTest {

  @Test
  public void testGetDescendantsLexicographical() throws SQLException, CodeMapperException {
    DataSource connectionPool = CodeMapperApplication.getCodeMapperConnectionPool();
    NonUmlsTargets targets = new NonUmlsTargets(connectionPool);
    Collection<String> codes = Arrays.asList("L22", "L233");
    Map<String, Collection<Code>> descs = targets.getDescendantsLexicographical("ICD10DA", codes);
    Collection<String> keysExpected = new TreeSet<>(Arrays.asList("L22", "L233"));
    Collection<String> keysActual = new TreeSet<>(descs.keySet());
    Assertions.assertIterableEquals(keysExpected, keysActual);
    String l22Expected = "L22, L229, L229A, L229B, L229C";
    String l22Actual = descs.get("L22").stream().map(Code::getId).collect(Collectors.joining(", "));
    Assertions.assertEquals(l22Expected, l22Actual);
    String l23Expected = "L233, L233A";
    String l23Actual =
        descs.get("L233").stream().map(Code::getId).collect(Collectors.joining(", "));
    Assertions.assertEquals(l23Expected, l23Actual);
  }
}
