package org.biosemantics.codemapper.rest;

import javax.ws.rs.core.Response;
import javax.ws.rs.ext.ExceptionMapper;
import javax.ws.rs.ext.Provider;

@Provider
public class UnauthorizedExceptionErrorHandler implements ExceptionMapper<UnauthorizedException> {
  @Override
  public Response toResponse(UnauthorizedException e) {
    return Response.status(e.getResponse().getStatus()).entity(e.getMessage()).build();
  }
}
