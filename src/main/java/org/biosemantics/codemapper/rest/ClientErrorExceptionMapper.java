package org.biosemantics.codemapper.rest;

import javax.ws.rs.ClientErrorException;
import javax.ws.rs.core.Response;
import javax.ws.rs.ext.ExceptionMapper;
import javax.ws.rs.ext.Provider;

@Provider
public class ClientErrorExceptionMapper implements ExceptionMapper<ClientErrorException> {
  @Override
  public Response toResponse(ClientErrorException e) {
    return Response.status(e.getResponse().getStatus()).entity(e.getMessage()).build();
  }
}
