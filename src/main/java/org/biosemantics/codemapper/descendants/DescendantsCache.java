package org.biosemantics.codemapper.descendants;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.Map;

import javax.sql.DataSource;

import org.apache.logging.log4j.util.Strings;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.CodingSystem;
import org.biosemantics.codemapper.MappingData.Code;
import org.biosemantics.codemapper.descendants.DescendantsApi.Descendants;

public class DescendantsCache {
    DataSource connectionPool;

	public DescendantsCache(DataSource connectionPool) {
		this.connectionPool = connectionPool;
	}
	
	public Map<String, Collection<Code>> getDescendants(String vsab, Collection<String> codes) throws CodeMapperException {
	    try {
			String query = "SELECT code, descendants FROM get_cached_descendants(?, ?)";
	    	Connection connection = connectionPool.getConnection();
	        PreparedStatement statement = connection.prepareStatement(query);
	    	statement.setString(1, vsab);
	    	statement.setArray(2, connection.createArrayOf("varchar", codes.toArray()));
	    	Map<String, Collection<Code>> result = new HashMap<>();
	    	ResultSet results = statement.executeQuery();
	    	while (results.next()) {
	    		String code = results.getString(1);
	    		String descendants = results.getString(2);
	    		for (String codeStr : descendants.split(",")) {
	    			String[] codeStrs = codeStr.split(":", 1);
	    			if (codeStrs.length != 2) {
	    				throw CodeMapperException.server("descendants code has not two parts");
	    			}
	    			String id = codeStrs[0];
	    			String term = codeStrs[1];
	    			Code desc = new Code();
	    			desc.setId(id);
	    			desc.setTerm(term);
	    			result.computeIfAbsent(code, key -> new LinkedList<>())
	    			.add(desc);
	    		}
	    		result.put(code, Arrays.asList());
	    	}
	    	return result;
	    } catch (SQLException e) {
	    	throw CodeMapperException.server("cannot get descendants", e); 
	    }
    }
	
	public void setDescendants(String vsab, String code, Collection<Code> descendants) throws SQLException {
		Collection<String> descendantStrs = descendants.stream().map(c -> c.getId() + ":" + c.getTerm()).toList();
		String query = "SELECT cache_descendants(?, ?, ?)";
		Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query);
        statement.setString(1, vsab);
        statement.setString(2, code);
        statement.setString(3, Strings.join(descendantStrs, ','));
	}
	
	public void evict(int n) throws SQLException {
		String query = "SELECT evict_cached_descendants(?)";
		Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query);
    	statement.setInt(1, n);
    	statement.execute();
	}

	public Map<String, Descendants> getDescendants(Map<String, Collection<String>> codesByVoc,
			Map<String, CodingSystem> codingSystems, DescendantsApi descendantsApi) {
		// TODO Auto-generated method stub
		return null;
	}
}
