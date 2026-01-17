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

import com.mchange.v2.c3p0.DataSources;
import java.io.IOException;
import java.io.InputStream;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Properties;
import java.util.Set;
import javax.servlet.ServletContext;
import javax.servlet.http.HttpSession;
import javax.sql.DataSource;
import javax.ws.rs.ApplicationPath;
import javax.ws.rs.core.Context;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.core.config.Configurator;
import org.apache.logging.log4j.core.config.builder.api.ConfigurationBuilder;
import org.apache.logging.log4j.core.config.builder.api.ConfigurationBuilderFactory;
import org.apache.logging.log4j.core.config.builder.impl.BuiltConfiguration;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.UmlsApi;
import org.biosemantics.codemapper.UtsApi;
import org.biosemantics.codemapper.authentification.AuthentificationApi;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.descendants.DescendantsApi;
import org.biosemantics.codemapper.descendants.DescendantsApi.GeneralDescender;
import org.biosemantics.codemapper.descendants.DescendantsCache;
import org.biosemantics.codemapper.descendants.UmlsDescender;
import org.biosemantics.codemapper.persistency.PersistencyApi;
import org.biosemantics.codemapper.review.ReviewApi;
import org.glassfish.hk2.utilities.binding.AbstractBinder;
import org.glassfish.jersey.server.ResourceConfig;

@ApplicationPath("rest")
public class CodeMapperApplication extends ResourceConfig {

  private static Logger logger = LogManager.getLogger(CodeMapperApplication.class);

  private static final String CODE_MAPPER_PROPERTIES = "/code-mapper.properties";
  private static final String CODE_MAPPER_CONFIG_PROPERTIES = "/code-mapper-config.properties";

  // Property names
  private static final String AVAILABLE_CODING_SYSTEMS = "available-coding-systems";
  private static final String CODE_MAPPER_DB = "code-mapper-db";
  private static final String CODEMAPPER_UMLS_VERSION = "codemapper-umls-version";
  private static final String CODEMAPPER_PROJECT_VERSION = "project.version";
  private static final String CODEMAPPER_CONTACT_EMAIL = "codemapper-contact-email";
  private static final String CODEMAPPER_URL = "codemapper-url";
  private static final String CODING_SYSTEMS_WITH_DEFINITION = "coding-systems-with-definition";
  private static final String DB_PASSWORD_SUFFIX = "-password";
  private static final String DB_URI_SUFFIX = "-uri";
  private static final String DB_USERNAME_SUFFIX = "-username";
  private static final String PEREGRINE_RESOURCE_URL = "peregrine-resource-url";
  private static final String UMLS_DB = "umls-db";
  private static final String UTS_API_KEY = "uts-api-key";
  private static final String DEFAULT_ALLOWED_TAGS = "default-allowed-tags";
  private static final String DEFAULT_IGNORE_TERM_TYPES = "default-ignore-term-types";
  private static final String DEFAULT_IGNORE_SEMANTIC_TYPES = "default-ignore-semantic-types";
  private static final String DEFAULT_VOCABULARIES = "default-vocabularies";

  private static Properties properties;
  private static Properties propertiesConfig;
  private static String peregrineResourceUrl;
  private static String umlsVersion;
  private static UmlsApi.Config umlsApi;
  private static PersistencyApi.Config persistencyApi;
  private static AuthentificationApi.Config authentificationApi;
  private static UtsApi utsApi;
  private static ReviewApi.Config reviewApi;
  private static DescendantsCache.Config descendantsCacheApi;
  private static NonUmlsTargets.Config nonUmlsTargets;
  private static UmlsDescender.Config umlsDescender;

  static {
    properties = new Properties();
    try (InputStream stream =
        CodeMapperApplication.class.getResourceAsStream(CODE_MAPPER_PROPERTIES)) {
      properties.load(stream);
    } catch (IOException e) {
      logger.error("Cannot load " + CODE_MAPPER_PROPERTIES);
      e.printStackTrace();
    }
    propertiesConfig = new Properties();
    try (InputStream stream =
        CodeMapperApplication.class.getResourceAsStream(CODE_MAPPER_CONFIG_PROPERTIES)) {
      propertiesConfig.load(stream);
    } catch (IOException e) {
      logger.error("Cannot load " + CODE_MAPPER_CONFIG_PROPERTIES);
      e.printStackTrace();
    }
  }

  public CodeMapperApplication(@Context ServletContext context) {
    this();
  }

  public CodeMapperApplication() {
    initialize(); // before packages/register
    packages(getClass().getPackage().getName());
    register(
        new AbstractBinder() {
          @Override
          protected void configure() {
            bindFactory(HttpSessionFactory.class).to(HttpSession.class);
            bindFactory(UserFactory.class).to(User.class);
          }
        });
  }

  public static void initialize() {
    DataSource umlsConnectionPool, codeMapperConnectionPool;

    // Try loading the database driver. Necessary, otherwise database connections
    // will fail with exception java.sql.SQLException: No suitable driver
    try {
      Class.forName("org.postgresql.Driver");
    } catch (LinkageError | ClassNotFoundException e) {
      logger.error("Can't load MYSQL JDBC driver");
      e.printStackTrace();
      return;
    }

    try {
      umlsConnectionPool = getConnectionPool(UMLS_DB);
      codeMapperConnectionPool = getCodeMapperConnectionPool();
      nonUmlsTargets = new NonUmlsTargets.Config(codeMapperConnectionPool);
    } catch (SQLException e) {
      logger.error("Cannot create pooled data source");
      e.printStackTrace();
      return;
    }

    String availableCodingSystemsStr = propertiesConfig.getProperty(AVAILABLE_CODING_SYSTEMS);
    List<String> availableCodingSystems = null;
    if (availableCodingSystemsStr != null)
      availableCodingSystems = Arrays.asList(availableCodingSystemsStr.split(",\\s*"));

    List<String> codingSystemsWithDefinition =
        Arrays.asList(propertiesConfig.getProperty(CODING_SYSTEMS_WITH_DEFINITION).split(",\\s*"));

    peregrineResourceUrl = propertiesConfig.getProperty(PEREGRINE_RESOURCE_URL);
    umlsVersion = properties.getProperty(CODEMAPPER_UMLS_VERSION);

    Set<String> defaultVocabularies =
        new HashSet<>(
            Arrays.asList(propertiesConfig.getProperty(DEFAULT_VOCABULARIES).split(",\\s*")));
    defaultVocabularies.remove("");
    Set<String> defaultAllowedTags =
        new HashSet<>(
            Arrays.asList(propertiesConfig.getProperty(DEFAULT_ALLOWED_TAGS).split(",\\s*")));
    defaultAllowedTags.remove("");
    Set<String> defaultIgnoreTermTypes =
        new HashSet<>(
            Arrays.asList(propertiesConfig.getProperty(DEFAULT_IGNORE_TERM_TYPES).split(",\\s*")));
    defaultIgnoreTermTypes.remove("");
    Set<String> defaultIgnoreSemanticTypes =
        new HashSet<>(
            Arrays.asList(
                propertiesConfig.getProperty(DEFAULT_IGNORE_SEMANTIC_TYPES).split(",\\s*")));
    defaultIgnoreSemanticTypes.remove("");

    String url = properties.getProperty(CODEMAPPER_URL);
    String contactEmail = propertiesConfig.getProperty(CODEMAPPER_CONTACT_EMAIL);
    String projectVersion = propertiesConfig.getProperty(CODEMAPPER_PROJECT_VERSION);
    ServerInfo versionInfo =
        new ServerInfo(
            umlsVersion,
            url,
            contactEmail,
            projectVersion,
            defaultVocabularies,
            defaultAllowedTags,
            defaultIgnoreTermTypes,
            defaultIgnoreSemanticTypes);

    umlsApi =
        new UmlsApi.Config(
            umlsConnectionPool,
            availableCodingSystems,
            codingSystemsWithDefinition,
            defaultIgnoreTermTypes,
            versionInfo);

    persistencyApi = new PersistencyApi.Config(codeMapperConnectionPool);
    authentificationApi = new AuthentificationApi.Config(codeMapperConnectionPool);

    String utsApiKey = propertiesConfig.getProperty(UTS_API_KEY);
    utsApi = new UtsApi(utsApiKey);

    reviewApi = new ReviewApi.Config(codeMapperConnectionPool);

    descendantsCacheApi = new DescendantsCache.Config(codeMapperConnectionPool);

    umlsDescender = new UmlsDescender.Config(umlsConnectionPool);
  }

  public static String getCodeMapperURL() {
    return umlsApi.getServerInfo().getUrl();
  }

  public static DataSource getConnectionPool(String prefix) throws SQLException {
    String uri = properties.getProperty(prefix + DB_URI_SUFFIX);
    System.out.println("DB " + prefix + ": " + uri);
    if (uri == null) {
      return null;
    }
    String username = properties.getProperty(prefix + DB_USERNAME_SUFFIX);
    String password = properties.getProperty(prefix + DB_PASSWORD_SUFFIX);
    logger.info("Get connection pool " + prefix);
    DataSource dataSource = DataSources.unpooledDataSource(uri, username, password);
    return DataSources.pooledDataSource(dataSource);
  }

  public static DataSource getCodeMapperConnectionPool() throws SQLException {
    return getConnectionPool(CODE_MAPPER_DB);
  }

  public static String getProp(String str) {
    return properties.getProperty(str);
  }

  public static String getPropConfig(String str) {
    return propertiesConfig.getProperty(str);
  }

  public static String getPeregrineResourceUrl() {
    return peregrineResourceUrl;
  }

  public static String getUmlsVersion() {
    return umlsVersion;
  }

  public static UmlsApi createUmlsApi(NonUmlsTargets nonUmlsTargets) throws CodeMapperException {
    try {
      return umlsApi.createApi(nonUmlsTargets);
    } catch (SQLException e) {
      throw CodeMapperException.server("create UMLS API", e);
    }
  }

  public static UtsApi getUtsApi() {
    return utsApi;
  }

  public static void reconfigureLog4j2(Level level) {
    ConfigurationBuilder<BuiltConfiguration> builder =
        ConfigurationBuilderFactory.newConfigurationBuilder();
    builder.add(
        builder
            .newAppender("stdout", "Console")
            .add(
                builder
                    .newLayout("PatternLayout")
                    .addAttribute("pattern", "%level: %logger{1} - %msg%n%throwable")));
    builder.add(builder.newRootLogger(level).add(builder.newAppenderRef("stdout")));
    Configurator.reconfigure(builder.build());
  }

  public static DescendantsApi createDescendantsApi(
      NonUmlsTargets nonUmls, GeneralDescender generalDescender) throws CodeMapperException {
    return DescendantsApi.createApi(nonUmls, generalDescender);
  }

  public static PersistencyApi createPersistencyApi() throws CodeMapperException {
    try {
      return persistencyApi.createApi();
    } catch (SQLException e) {
      throw CodeMapperException.server("create persistency API", e);
    }
  }

  public static DescendantsCache createDescendantsCacheApi() throws CodeMapperException {
    try {
      return descendantsCacheApi.createApi();
    } catch (SQLException e) {
      throw CodeMapperException.server("create descendants cache API", e);
    }
  }

  public static ReviewApi createReviewApi() throws CodeMapperException {
    try {
      return reviewApi.createApi();
    } catch (SQLException e) {
      throw CodeMapperException.server("create review API", e);
    }
  }

  public static AuthentificationApi createAuthentificationApi() throws CodeMapperException {
    try {
      return authentificationApi.createApi();
    } catch (SQLException e) {
      throw CodeMapperException.server("create authentification API", e);
    }
  }

  public static NonUmlsTargets createNonUmlsTargets() throws CodeMapperException {
    try {
      return nonUmlsTargets.createApi();
    } catch (SQLException e) {
      throw CodeMapperException.server("create non umls targets API", e);
    }
  }

  public static GeneralDescender createGeneralDescender() throws CodeMapperException {
    try {
      return umlsDescender.createApi();
    } catch (SQLException e) {
      throw CodeMapperException.server("create UMLS descender API", e);
    }
  }
}
