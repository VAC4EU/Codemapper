package org.biosemantics.codemapper.umls_ext;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.sql.DataSource;

import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.CodingSystem;
import org.biosemantics.codemapper.SourceConcept;
import org.biosemantics.codemapper.Utils;
import org.biosemantics.codemapper.rest.CodeMapperApplication;

public class Rcd2CodingSystem implements ExtCodingSystem {

	private static final String REFERENCE_CODING_SYSTEM = "RCD";
    public final String ABBREVIATION = "RCD2";
	public final String NAME = "Read thesaurus, version 2";
	public final String FAMILY = "Read thesaurus, version 2";

    public final String QUERY_3to2_FMT =
            "SELECT DISTINCT CTV3_CONCEPTID, V2_CONCEPTID FROM RCD_V3_to_V2 "
            // Make CTV3_CONCEPTID case sensitive!
            + "WHERE CAST(CTV3_CONCEPTID AS CHAR CHARACTER SET latin1) COLLATE latin1_general_cs IN (%s) "
            + "AND V2_CONCEPTID NOT IN ('_DRUG', '_NONE')";

    public final String QUERY_2to3_FMT =
            "SELECT DISTINCT V2_CONCEPTID, CTV3_CONCEPTID FROM RCD_V3_to_V2 "
            // Make CTV3_CONCEPTID case sensitive!
            + "WHERE CAST(V2_CONCEPTID AS CHAR CHARACTER SET latin1) COLLATE latin1_general_cs IN (%s) "
            + "AND V2_CONCEPTID NOT IN ('_DRUG', '_NONE')";

	private DataSource umlsExtConnectionPool;

	public Rcd2CodingSystem(DataSource umlsExtConnectionPool) {
		this.umlsExtConnectionPool = umlsExtConnectionPool;
	}

	@Override
	public CodingSystem getCodingSystem() {
		return new CodingSystem(ABBREVIATION, NAME, FAMILY);
	}

	@Override
	public Collection<String> getReferenceCodingSystems() {
		return Collections.singleton(REFERENCE_CODING_SYSTEM);
	}
	
	@Override
    public List<String> getKnownCodes(List<String> codes) throws CodeMapperException {
	    String queryFormat = "SELECT DISTINCT `V2_CONCEPTID` FROM `RCD_V3_to_V2` "
	            + "WHERE CAST(V2_CONCEPTID AS CHAR CHARACTER SET latin1) COLLATE latin1_general_cs IN (%s)";
        String query = String.format(queryFormat, Utils.sqlPlaceholders(codes.size()));
        try (Connection connection = umlsExtConnectionPool.getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
            int offset = 1;
            for (Iterator<String> iter = codes.iterator(); iter.hasNext(); offset++)
                statement.setString(offset, iter.next());
            ResultSet result = statement.executeQuery();
            List<String> knownCodes = new LinkedList<>();
            while (result.next()) {
                String code = result.getString(1);
                knownCodes.add(code);
            }
            return knownCodes;
        } catch (SQLException e) {
            throw CodeMapperException.server("Cannot retrieve known codes", e);
        }
    }

	@Override
	public Map<String, Map<String, List<SourceConcept>>> mapCodes(Map<String, List<SourceConcept>> referenceCodes) throws CodeMapperException {

		/** referenceCodes {CUI: [SourceConcept3]} */

		Set<String> codes = new HashSet<>();
		Map<String, String> preferredTerms = new HashMap<>();
		for (List<SourceConcept> referenceCodesForCui: referenceCodes.values())
			for (SourceConcept referenceCode: referenceCodesForCui) {
				codes.add(referenceCode.getId());
				preferredTerms.put(referenceCode.getId(), referenceCode.getPreferredTerm());
			}

		if (codes.isEmpty())
			return new HashMap<>();

		Map<String, List<String>> mapping = translate(codes, Direction.From3to2);

		/** res: {CUI: {Code3: [SourceConcept2]}} */
		Map<String, Map<String, List<SourceConcept>>> res = new HashMap<>();
		for (String cui: referenceCodes.keySet()) {
			res.put(cui, new HashMap<String, List<SourceConcept>>());
			for (SourceConcept sourceConceptRcd3: referenceCodes.get(cui)) {
			    assert(REFERENCE_CODING_SYSTEM.equals(sourceConceptRcd3.getCodingSystem()));
				String code3 = sourceConceptRcd3.getId();
				String preferredTerm = preferredTerms.containsKey(code3) ? preferredTerms.get(code3) : null;
				List<SourceConcept> sourceConceptsRcd2 = new LinkedList<>();
				if (mapping.containsKey(code3))
					for (String code2: mapping.get(code3)) {
						SourceConcept sourceConcept2 = new SourceConcept(cui, ABBREVIATION, code2, preferredTerm);
						sourceConceptsRcd2.add(sourceConcept2);
					}
				if (!sourceConceptsRcd2.isEmpty())
					res.get(cui).put(code3, sourceConceptsRcd2);
			}
		}
		return res;
	}
	
	private static enum Direction { From2to3, From3to2 };
	
	public Map<String, List<String>> translate(Collection<String> codes, Direction direction) throws CodeMapperException {
	    String queryFormat = null;
	    switch (direction) {
	        case From2to3:
	            queryFormat = QUERY_2to3_FMT;
	            break;
	        case From3to2:
	            queryFormat = QUERY_3to2_FMT;
	            break;
	        default:
	            assert false;
	    }
        String query = String.format(queryFormat, Utils.sqlPlaceholders(codes.size()));
        try (Connection connection = umlsExtConnectionPool.getConnection();
             PreparedStatement statement = connection.prepareStatement(query)) {
            int offset = 1;
            for (Iterator<String> iter = codes.iterator(); iter.hasNext(); offset++)
                statement.setString(offset, iter.next());

            Map<String, List<String>> mapping = new HashMap<>();
            ResultSet result = statement.executeQuery();
            while (result.next()) {
                String sourceCode = result.getString(1);
                String targetCode = result.getString(2);
                if (!mapping.containsKey(sourceCode))
                    mapping.put(sourceCode, new LinkedList<String>());
                mapping.get(sourceCode).add(targetCode);
            }
            return mapping;
        } catch (SQLException e) {
            throw CodeMapperException.server("Cannot execute query to map from READ " + direction, e);
        }
	}

    @Override
    public List<String> getCuisForCodes(List<String> codes) throws CodeMapperException {
        if (codes == null || codes.isEmpty())
            return new LinkedList<>();
        Set<String> codes3 = new HashSet<>();
        for (List<String> cs3 : translate(codes, Direction.From2to3).values())
            codes3.addAll(cs3);
        return CodeMapperApplication.getUmlsApi().getCuisByCodes(new LinkedList<>(codes3), REFERENCE_CODING_SYSTEM);
    }
}