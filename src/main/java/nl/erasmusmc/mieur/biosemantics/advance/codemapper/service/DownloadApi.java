package nl.erasmusmc.mieur.biosemantics.advance.codemapper.service;

import java.io.IOException;
import java.io.OutputStream;
import java.text.DateFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

import javax.ws.rs.WebApplicationException;

import org.apache.log4j.Logger;
import org.apache.poi.ss.usermodel.Hyperlink;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.hssf.usermodel.HSSFCell;
import org.apache.poi.hssf.usermodel.HSSFCellStyle;
import org.apache.poi.hssf.usermodel.HSSFFont;
import org.apache.poi.hssf.usermodel.HSSFRow;
import org.apache.poi.hssf.usermodel.HSSFSheet;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.json.JSONArray;
import org.json.JSONObject;

import nl.erasmusmc.mieur.biosemantics.advance.codemapper.CodeMapperException;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.Comment;
import nl.erasmusmc.mieur.biosemantics.advance.codemapper.rest.CodeMapperApplication;

public class DownloadApi {
	
	private static Logger logger = Logger.getLogger("DownloadApi");
	
	public JSONObject getCaseDefinition(String project, String caseDefinition) throws CodeMapperException {

		String jsonState = CodeMapperApplication.getPersistencyApi().getCaseDefinition(project, caseDefinition);
		if (jsonState == null)
			return null;
		JSONObject state = new JSONObject(jsonState);
		return state;
	}
	
	
	public void caseDefinitionToXls(JSONObject state, List<Comment> comments, String name, String url, OutputStream output) {

		try (HSSFWorkbook workbook = new HSSFWorkbook()) {
			caseDefinitionToXls(state, comments, name, url, workbook);
			workbook.write(output);
		} catch (IOException e) {
			logger.error("Cannot create workbook", e);
		}
	}
	
	public void caseDefinitionToXls(JSONObject state, List<Comment> comments, String name, String url, HSSFWorkbook workbook) throws IOException, WebApplicationException {

		info(state, name, url, workbook.createSheet("Info"));
		codes(state, workbook.createSheet("Codes"));
		history(state, workbook.createSheet("History"));
		comments(state, comments, workbook.createSheet("Comments"));
		caseDefinition(state, workbook.createSheet("Case definition"));
	}
	
	public void bold(List<HSSFCell> row, HSSFSheet sheet) {

		HSSFCellStyle style = sheet.getWorkbook().createCellStyle();
		HSSFFont font = sheet.getWorkbook().createFont();
		font.setBold(true);
		style.setFont(font);
		for (HSSFCell cell : row)
			cell.setCellStyle(style);
	}


	private void comments(JSONObject state, List<Comment> comments, HSSFSheet sheet) {
		
		DateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX");
		
		int rowIx = 0;
		
		List<HSSFCell> header = setRow(sheet.createRow(rowIx++), "Date", "User", "Concept", "CUI", "Message");
		bold(header, sheet);
		
		Map<String, String> conceptNames = new HashMap<>();
		JSONArray concepts = state.getJSONObject("mapping").getJSONArray("concepts");
		for (int conceptIx = 0; conceptIx < concepts.length(); conceptIx++) {
			JSONObject concept = concepts.getJSONObject(conceptIx);
			conceptNames.put(concept.getString("cui"), concept.getString("preferredName"));
		}

		for (Comment comment : comments) {
			String dateString = comment.getTimestamp();
			Date date = null;
			try {
				date = dateFormat.parse(dateString);
			} catch (ParseException e) {
				logger.error("Couldn't parse date", e);
			}
			String concept = conceptNames.get(comment.getCui());
			List<HSSFCell> row = setRow(sheet.createRow(rowIx++), dateString, comment.getAuthor(), concept, comment.getCui(), comment.getContent());
			if (date != null) {
				row.get(0).setCellValue(date);
				HSSFCellStyle style = sheet.getWorkbook().createCellStyle();
				short format = sheet.getWorkbook().getCreationHelper().createDataFormat().getFormat("m/d/yy hh:mm");
				style.setDataFormat(format);
				row.get(0).setCellStyle(style);		
			}
		}
		
		sheet.setAutoFilter(new CellRangeAddress(0, rowIx-1, 0, header.size()-1));
	}


	private void history(JSONObject state, HSSFSheet sheet) {
		int rowIx = 0;
		
		DateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
		
		List<HSSFCell> header = setRow(sheet.createRow(rowIx++), "Date", "Operation", "Argument", "Result");
		bold(header, sheet);
		
		JSONArray steps = state.getJSONObject("mapping").optJSONArray("history");
		for (int stepIx = 0; stepIx < steps.length(); stepIx++) {
			JSONObject step = steps.getJSONObject(stepIx);
			String dateString = step.getString("date");
			Date date = null;
			try {
				date = dateFormat.parse(dateString);
			} catch (ParseException e) {
				logger.error("Couldn't parse date", e);
			}
			String operation = step.getString("operation");
			String argument = historyDatumToString(step.get("argument"));
			String result = historyDatumToString(step.get("result"));
			List<HSSFCell> row = setRow(sheet.createRow(rowIx++), dateString, operation, argument, result);
			if (date != null) {
				row.get(0).setCellValue(date);
				HSSFCellStyle style = sheet.getWorkbook().createCellStyle();
				short format = sheet.getWorkbook().getCreationHelper().createDataFormat().getFormat("m/d/yy hh:mm");
				style.setDataFormat(format);
				row.get(0).setCellStyle(style);
			}
		}
		sheet.setAutoFilter(new CellRangeAddress(0, rowIx-1, 0, header.size()-1));
	}
	
	
	private static String historyDatumToString(Object data) {
		if (data.equals(JSONObject.NULL))
			return "";
		if (data instanceof JSONObject) {
			JSONObject concept = (JSONObject) data;
			return concept.getString("preferredName");
		}
		if (data instanceof String)
			return (String) data;
		if (data instanceof JSONArray) {
			StringBuffer sb = new StringBuffer();
			JSONArray array = (JSONArray) data;
			for (int ix = 0; ix < array.length(); ix++) {
				JSONObject concept = array.getJSONObject(ix);
				if (ix != 0)
					sb.append(", ");
				sb.append(concept.getString("preferredName"));
			}
			return sb.toString();
		}
		logger.error(String.format("Cannot convert history datum %s of class %s", data, data.getClass()));
		return null;
	}


	private List<HSSFCell> setRow(HSSFRow row, String... cells) {
		List<HSSFCell> result = new LinkedList<>();
		for (int ix = 0; ix < cells.length; ix++) {
			HSSFCell cell = row.createCell(ix);
			cell.setCellValue(cells[ix]);
			result.add(cell);
		}
		return result;
	}


	private void info(JSONObject state, String name, String url, HSSFSheet sheet) {
		int rowIx = 0;

		Hyperlink hyperlink = sheet.getWorkbook().getCreationHelper().createHyperlink(Hyperlink.LINK_URL);
		hyperlink.setAddress(url);
		
		setRow(sheet.createRow(rowIx++), "Case definition:", name);
		setRow(sheet.createRow(rowIx++), "URL:", url)
			.get(1).setHyperlink(hyperlink);
		rowIx++;
		setRow(sheet.createRow(rowIx++), "Case definition created with ADVANCE Code Mapper");
		setRow(sheet.createRow(rowIx++), "Concepts, history, comments and original wording of the case definitions are in separate sheets.");
		
	}
	
	private void caseDefinition(JSONObject state, HSSFSheet sheet) {
		int rowIx = 0;
		String text = state.getJSONObject("indexing").getString("caseDefinition");
		HSSFCellStyle style = sheet.getWorkbook().createCellStyle();
//		style.setWrapText(true);
		HSSFRow row = sheet.createRow(rowIx++);
		setRow(row, text)
		.get(0).setCellStyle(style);
		row.setHeight((short)-1);
	}


	private void codes(JSONObject state, HSSFSheet sheet) {
		int rowIx = 0;
		
		List<HSSFCell> header = setRow(sheet.createRow(rowIx++), "Coding system", "Code", "Code name", "Concept", "Concept name");//, "Origin", "Root concept");
		bold(header, sheet);
		
		JSONArray codingSystems = state.getJSONObject("mapping").getJSONArray("codingSystems");
		for (int codingSystemIx = 0; codingSystemIx < codingSystems.length(); codingSystemIx++) {
			String codingSystem = codingSystems.getString(codingSystemIx);
		
			JSONArray concepts = state.getJSONObject("mapping").getJSONArray("concepts");
			for (int conceptIx = 0; conceptIx < concepts.length(); conceptIx++) {
				JSONObject concept = concepts.getJSONObject(conceptIx);
			
				JSONArray codes = concept.getJSONObject("codes").getJSONArray(codingSystem);
				for (int codeIx = 0; codeIx < codes.length(); codeIx++) {
					JSONObject code = codes.getJSONObject(codeIx);
					
//					String origin;
//					switch (concept.getJSONObject("origin").getString("type")) {
//					case "spans":
//						origin = "\"" + concept.getJSONObject("origin").getJSONObject("data").getString("text") + "\"";
//						break;
//					case "hyponym":
//						origin = "< " + concept.getJSONObject("origin").getJSONObject("data").getString("cui");
//						break;
//					case "hypernym":
//						origin = "> " + concept.getJSONObject("origin").getJSONObject("data").getString("cui");
//						break;
//					case "search":
//						origin = "? " + concept.getJSONObject("origin").getString("data");
//						break;
//					case "add":
//						origin = "+";
//						break;
//					default:
//						origin = "";
//						break;
//					}
//					String root = "";
//					if (!concept.getJSONObject("origin").isNull("root"))
//						root = concept.getJSONObject("origin").getJSONObject("root").getString("cui");
					setRow(sheet.createRow(rowIx++), codingSystem, code.getString("id"),code.getString("preferredTerm"),
							concept.getString("cui"), concept.getString("preferredName"));//, origin, root);
				}
			}
		}
		sheet.setAutoFilter(new CellRangeAddress(0, rowIx-1, 0, header.size()-1));
	}
}