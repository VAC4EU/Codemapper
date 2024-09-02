package org.biosemantics.codemapper.rest;

import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.core.Response;
import javax.ws.rs.ext.ExceptionMapper;
import javax.ws.rs.ext.Provider;

@Provider
public class InternalErrorExceptionMapper implements ExceptionMapper<InternalServerErrorException> {
  @Override
  public Response toResponse(InternalServerErrorException e) {
    return Response.status(e.getResponse().getStatus()).entity(e.getMessage()).build();
  }
}
