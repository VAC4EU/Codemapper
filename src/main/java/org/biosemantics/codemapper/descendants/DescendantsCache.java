package org.biosemantics.codemapper.descendants;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

import javax.sql.DataSource;

import org.apache.logging.log4j.util.Strings;

public class DescendantsCache {
    DataSource connectionPool;

	public DescendantsCache(DataSource connectionPool) {
		this.connectionPool = connectionPool;
	}
	
	public Map<String, Collection<String>> getDescendants(String vsab, Collection<String> codes) throws SQLException {
		String query = "SELECT code, descendants FROM get_cached_descendants(?, ?)";
	    Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query);
    	statement.setString(1, vsab);
    	statement.setArray(2, connection.createArrayOf("varchar", codes.toArray()));
    	Map<String, Collection<String>> result = new HashMap<>();
    	ResultSet results = statement.executeQuery();
    	while (results.next()) {
    		String code = results.getString(1);
    		String descendants = results.getString(2);
    		result.put(code, Arrays.asList(descendants.split(",")));
    	}
    	return result;
    }
	
	public void setDescendants(String vsab, String code, Collection<String> descendants) throws SQLException {
		String query = "SELECT cache_descendants(?, ?, ?)";
		Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query);
        statement.setString(1, vsab);
        statement.setString(2, code);
        statement.setString(3, Strings.join(descendants, ','));
	}
	
	public void evict(int n) throws SQLException {
		String query = "SELECT evict_cached_descendants(?)";
		Connection connection = connectionPool.getConnection();
        PreparedStatement statement = connection.prepareStatement(query);
    	statement.setInt(1, n);
    	statement.execute();
	}
}
