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

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.ForbiddenException;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import org.biosemantics.codemapper.CodeMapperException;
import org.biosemantics.codemapper.authentification.AuthentificationApi;
import org.biosemantics.codemapper.authentification.ProjectPermission;
import org.biosemantics.codemapper.authentification.User;
import org.biosemantics.codemapper.persistency.PersistencyApi;
import org.biosemantics.codemapper.persistency.PersistencyApi.MappingInfo;
import org.biosemantics.codemapper.review.ReviewApi;
import org.biosemantics.codemapper.review.ReviewApi.AllTopics;
import org.biosemantics.codemapper.review.ReviewApi.TopicInfo;

@Path("review")
public class ReviewResource {
  @GET
  @Path("topics/{mappingShortkey}")
  @Produces(MediaType.APPLICATION_JSON)
  public AllTopics getTopicsByCui(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("mappingShortkey") String mappingShortkey) {
    try (PersistencyApi persistency = CodeMapperApplication.createPersistencyApi();
        ReviewApi review = CodeMapperApplication.createReviewApi()) {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingShortkey, ProjectPermission.Reviewer, persistency);
      return review.getAll(mappingShortkey, user.getUsername());
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("topic/{mappingShortkey}")
  @Produces(MediaType.APPLICATION_JSON)
  public int postNewTopic(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("mappingShortkey") String mappingShortkey,
      @QueryParam("cui") String cui,
      @QueryParam("sab") String sab,
      @QueryParam("code") String code,
      @FormParam("heading") String heading) {
    try (PersistencyApi persistency = CodeMapperApplication.createPersistencyApi();
        ReviewApi review = CodeMapperApplication.createReviewApi()) {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingShortkey, ProjectPermission.Reviewer, persistency);
      return review.newTopic(mappingShortkey, cui, sab, code, heading, user.getUsername(), null);
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("message/{mappingShortkey}/{topicId}")
  @Produces(MediaType.APPLICATION_JSON)
  public void newMessage(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("mappingShortkey") String mappingShortkey,
      @PathParam("topicId") int topicId,
      @FormParam("content") String content) {
    try (PersistencyApi persistency = CodeMapperApplication.createPersistencyApi();
        ReviewApi review = CodeMapperApplication.createReviewApi()) {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingShortkey, ProjectPermission.Reviewer, persistency);
      TopicInfo topic = review.getTopicInfo(topicId);
      if (!topic.mappingShortkey.equals(mappingShortkey)) {
        throw CodeMapperException.user("mapping does not belong to topic");
      }
      if (topic.isResolved) {
        throw CodeMapperException.user("cannot create message on resolved topic");
      }
      review.newMessage(mappingShortkey, topicId, content, user.getUsername(), null);
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
    }
  }

  @PUT
  @Path("message/{mappingShortkey}/{topicId}")
  @Produces(MediaType.APPLICATION_JSON)
  public void editMessage(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("mappingShortkey") String mappingShortkey,
      @PathParam("topicId") int topicId,
      @FormParam("messageId") int messageId,
      @FormParam("content") String content) {
    try (PersistencyApi persistency = CodeMapperApplication.createPersistencyApi();
        ReviewApi review = CodeMapperApplication.createReviewApi()) {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingShortkey, ProjectPermission.Reviewer, persistency);
      TopicInfo topic = review.getTopicInfo(topicId);
      if (!topic.mappingShortkey.equals(mappingShortkey)) {
        throw CodeMapperException.user("mapping does not belong to topic");
      }
      if (topic.isResolved) {
        throw CodeMapperException.user("cannot edit message on resolved topic");
      }
      review.editMessage(messageId, user.getUsername(), content);
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("topic-resolve/{mappingShortkey}/{topicId}")
  @Produces(MediaType.APPLICATION_JSON)
  public void resolveTopic(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("mappingShortkey") String mappingShortkey,
      @PathParam("topicId") int topicId) {
    try (ReviewApi review = CodeMapperApplication.createReviewApi();
        PersistencyApi persistencyApi = CodeMapperApplication.createPersistencyApi(); ) {
      TopicInfo topic = review.getTopicInfo(topicId);
      if (!topic.mappingShortkey.equals(mappingShortkey)) {
        throw CodeMapperException.user("mapping does not belong to topic");
      }
      MappingInfo mapping = persistencyApi.getMappingInfo(mappingShortkey);
      Map<String, ProjectPermission> permissions =
          persistencyApi.getProjectPermissions(user.getUsername());
      ProjectPermission perm = permissions.get(mapping.projectName);
      String createdBy = review.getTopicCreatedBy(topicId);
      if (!perm.implies(ProjectPermission.Reviewer)
          && createdBy != null
          && !user.getUsername().equals(createdBy)) {
        throw new ForbiddenException();
      }
      review.resolveTopic(topicId, user.getUsername(), null);
      review.resetReadMarkers(topicId);
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("topic-mark-read/{mappingShortkey}/{topicId}")
  @Produces(MediaType.APPLICATION_JSON)
  public void markRead(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("mappingShortkey") String mappingShortkey,
      @PathParam("topicId") int topicId) {
    try (PersistencyApi persistency = CodeMapperApplication.createPersistencyApi();
        ReviewApi review = CodeMapperApplication.createReviewApi(); ) {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingShortkey, ProjectPermission.Reviewer, persistency);
      TopicInfo topic = review.getTopicInfo(topicId);
      if (!topic.mappingShortkey.equals(mappingShortkey)) {
        throw CodeMapperException.user("mapping does not belong to topic");
      }
      review.markRead(topicId, user.getUsername());
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
    }
  }

  @POST
  @Path("topics/{mappingShortkey}")
  @Produces(MediaType.APPLICATION_JSON)
  public void saveReviews(
      @Context HttpServletRequest request,
      @Context User user,
      @PathParam("mappingShortkey") String mappingShortkey,
      @FormParam("allTopics") String allTopicsJson) {
    try (ReviewApi review = CodeMapperApplication.createReviewApi();
        PersistencyApi persistency = CodeMapperApplication.createPersistencyApi(); ) {
      AuthentificationApi.assertMappingProjectRolesImplies(
          user, mappingShortkey, ProjectPermission.Reviewer, persistency);
      ObjectMapper mapper = new ObjectMapper();
      mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
      AllTopics allTopics = mapper.readValue(allTopicsJson, AllTopics.class);
      review.saveReviews(mappingShortkey, allTopics);
    } catch (CodeMapperException e) {
      e.printStackTrace();
      throw e.asWebApplicationException();
    } catch (Exception e) {
      throw new InternalServerErrorException(e);
    }
  }
}
