package nl.erasmusmc.mieur.biosemantics.advance.codemapper.persistency;

import java.io.IOException;
import java.io.StringReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.LinkedList;
import java.util.List;
import java.util.regex.Pattern;

import javax.json.Json;
import javax.json.JsonException;

import org.apache.log4j.Logger;

public class PersistencyApi {

	private static Logger logger = Logger.getLogger("CodeMapperWebService");

	private static final String CASE_DEFINITIONS_FOLDER = "case-definitions";
	private static final String JSON_SUFFIX = ".json";
	private Path caseDefinitionsPath;

	public PersistencyApi(Path directory) throws IOException {
		this.caseDefinitionsPath = directory.resolve(CASE_DEFINITIONS_FOLDER);
		System.out.println(caseDefinitionsPath.toAbsolutePath());
		if (!Files.exists(caseDefinitionsPath))
			Files.createDirectories(caseDefinitionsPath);
	}

	public List<String> getCaseDefinitionsNames() {
		final List<String> names = new LinkedList<>();
		try {
			for (Path path: Files.newDirectoryStream(caseDefinitionsPath))
				names.add(path.getFileName().toString().replaceFirst(Pattern.quote(JSON_SUFFIX) + "$", ""));
			return names;
		} catch (IOException e) {
			e.printStackTrace();
			return null;
		}
	}

	public String getCaseDefinition(String name) {
		Path path = caseDefinitionsPath.resolve(name + JSON_SUFFIX);
		try {
			StringBuffer sb = new StringBuffer();
			for (byte b: Files.readAllBytes(path))
				sb.append(b);
			return sb.toString();
		} catch (IOException e) {
			logger.error("Cannot read case definition: " + path);
			e.printStackTrace();
			return null;
		}
	}

	public void setCaseDefinition(String name, String json)  {
		Path path = caseDefinitionsPath.resolve(name + JSON_SUFFIX);
		try {
			Json.createReader(new StringReader(json)).readObject();
			Files.write(path, json.getBytes(), StandardOpenOption.CREATE);
		} catch (JsonException e) {
			logger.error("Cannot parse json: " + json);
		} catch (IOException e) {
			logger.error("Cannot store case definition: " + path);
			e.printStackTrace();
		}
	}
}