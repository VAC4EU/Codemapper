package org.biosemantics.codemapper.descendants;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Map;

import javax.sql.DataSource;

import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.CodingSystem;
import org.biosemantics.codemapper.UmlsApi;
import org.biosemantics.codemapper.MappingData.Code;
import org.biosemantics.codemapper.descendants.DescendantsApi.Descendants;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;


public class DescendantsCache {

	static class CachedCode {
		String id;
		String term;
		public CachedCode(Code c) {
			//TODO Auto-generated constructor stub
		}
		Code toCode() {
			Code code = new Code();
			code.setId(id);
			code.setTerm(term);
			return code;
		}
	}

	static class CachedCodes {
		Collection<CachedCode> codes;
	}

    DataSource connectionPool;

	public DescendantsCache(DataSource connectionPool) {
		this.connectionPool = connectionPool;
	}
	
	public Descendants getDescendants(String vsab, Collection<String> codes) throws CodeMapperException {
	    try {
			String query = "SELECT code, descendants FROM get_cached_descendants(?, ?)";
	    	Connection connection = connectionPool.getConnection();
	        PreparedStatement statement = connection.prepareStatement(query);
	    	statement.setString(1, vsab);
	    	statement.setArray(2, connection.createArrayOf("varchar", codes.toArray()));
	    	Descendants result = new Descendants();
	    	ResultSet results = statement.executeQuery();
	    	while (results.next()) {
	    		String code = results.getString(1);
	    		String descendantsJson = results.getString(2);
				ObjectMapper mapper = new ObjectMapper();
				CachedCodes cachedCodes = mapper.readValue(descendantsJson, CachedCodes.class);
				for (CachedCode cachedCode : cachedCodes.codes) {
	    			result.computeIfAbsent(code, key -> new LinkedList<>())
	    			.add(cachedCode.toCode());
	    		}
	    		result.put(code, Arrays.asList());
	    	}
	    	return result;
	    } catch (SQLException | JsonProcessingException e) {
	    	throw CodeMapperException.server("cannot get cached descendants", e); 
	    }
    }
	
	public void setDescendants(String vsab, String code, Collection<Code> descendants) throws CodeMapperException {
		CachedCodes cachedCodes = new CachedCodes();
		cachedCodes.codes = descendants.stream().map(c -> new CachedCode(c)).toList();
		ObjectMapper mapper = new ObjectMapper();
		String query = "SELECT cache_descendants(?, ?, ?)";
		try {
			String descendendsJson = mapper.writeValueAsString(cachedCodes);
			Connection connection = connectionPool.getConnection();
			PreparedStatement statement = connection.prepareStatement(query);
			statement.setString(1, vsab);
			statement.setString(2, code);
			statement.setString(3, descendendsJson);
		} catch (SQLException | JsonProcessingException e) {
			throw CodeMapperException.server("could not cache descendants", e);
		}
	}
	
	public void evict(int n) throws CodeMapperException {
		String query = "SELECT evict_cached_descendants(?)";
		try {
			Connection connection = connectionPool.getConnection();
			PreparedStatement statement = connection.prepareStatement(query);
			statement.setInt(1, n);
			statement.execute();
		} catch (SQLException e) {
			throw CodeMapperException.server("could not evict cached descendants", e);
		}
	}

	public Map<String, Descendants> getDescendants(Map<String, Collection<String>> codesByVoc,
			Map<String, CodingSystem> codingSystems, DescendantsApi descendantsApi, UmlsApi umlsApi) throws CodeMapperException {
		Map<String, Descendants> res = new HashMap<>();
		for (String voc : codesByVoc.keySet()) {
			Collection<String> codes = codesByVoc.get(voc);
			CodingSystem codingSystem = codingSystems.get(voc);
			String vsab = codingSystem.getAbbreviation() + ":" + codingSystem.getVersion();
			Descendants descendants = getDescendants(vsab, codes);
			Collection<String> missing = new HashSet<>(codes);
			missing.removeAll(descendants.keySet());
			if (!missing.isEmpty()) {
				Descendants missingDescendants = descendantsApi.getCodeDescendants(voc, missing);
				descendants.putAll(missingDescendants);
				for (String code : missingDescendants.keySet()) {
					setDescendants(vsab, code, missingDescendants.get(code));
				}
			}
			res.put(voc, descendants);
		}
		return res;
	}
}
