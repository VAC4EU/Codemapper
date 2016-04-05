package org.biosemantics.codemapper.umls_ext;

import java.util.Collection;
import java.util.List;
import java.util.Map;

import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.CodingSystem;
import org.biosemantics.codemapper.SourceConcept;

public interface ExtCodingSystem {

	/** Extended coding system. */
	public CodingSystem getCodingSystem();

	/** Abbreviation of the reference coding system in UMLS. */
	public Collection<String> getReferenceCodingSystems();

	/**
	 * Map codes in reference coding system to codes in extended coding
	 * system.
	 *
	 * @param codes
	 *            A mapping from CUIs to codes in the reference coding
	 *            system.
	 * @return A mapping from CUIs to a mapping from codes in the reference
	 *         coding systems to source concepts in the extended coding
	 *         system
	 * @throws CodeMapperException
	 */
	public Map<String, Map<String, List<SourceConcept>>> mapCodes(Map<String, List<SourceConcept>> codes) throws CodeMapperException;

	/** Create a mapping from codes in the extended mapping to CUIs that correspond to the codes 
	 * @throws CodeMapperException */
    public List<String> getCuisForCodes(List<String> codes) throws CodeMapperException;

    /** Filter the given codes to codes known in the extended coding system. */
    public List<String> getKnownCodes(List<String> codes) throws CodeMapperException;
}