package org.biosemantics.codemapper.rest;

import javax.ws.rs.BadRequestException;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.ext.ExceptionMapper;
import javax.ws.rs.ext.Provider;

@Provider
public class BadRequestExceptionMapper implements ExceptionMapper<BadRequestException> {
  @Override
  public Response toResponse(BadRequestException e) {
    return Response.status(e.getResponse().getStatus())
        .entity(e.getMessage())
        .type(MediaType.TEXT_PLAIN)
        .build();
  }
}
